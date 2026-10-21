/** Shared application lifecycle. The desktop remains the sole owner of HID transactions. */
export type ConnectionPhase =
  'disconnected' | 'connecting' | 'hydrating' | 'ready' | 'recovering' | 'error';

export type ProfileSelection =
  | Readonly<{ kind: 'onboard'; wireIndex: number }>
  | Readonly<{ kind: 'software'; id: string; wireIndex: 4 }>;

export interface DeviceIdentity {
  readonly id: string;
  readonly firmware?: string;
}

/** Tokens describe the connection and selection for which asynchronous work began. */
export interface StateTicket {
  readonly connectionGeneration: number;
  readonly selectionRevision: number;
  readonly workEpoch: number;
}

export type VerificationEvidence = 'readback' | 'acknowledged' | 'none';
export type DesktopPhase = 'unknown' | 'ready' | 'closing' | 'closed';
export interface DesktopActivity {
  readonly phase: Exclude<DesktopPhase, 'unknown'>;
  readonly pendingTransactions: number;
}

export interface EditResult<T> {
  readonly value: T;
  readonly evidence: VerificationEvidence;
}

export interface PendingEdit {
  readonly id: number;
  readonly key: string;
  readonly status: 'scheduled' | 'queued' | 'running';
  /** A running command cannot be physically undone by invalidating its ticket. */
  readonly stale: boolean;
  readonly ticket: StateTicket;
}

export interface EditCompletion<T> {
  readonly id: number;
  readonly key: string;
  readonly evidence: VerificationEvidence;
  readonly value: T;
}

export interface RecoveryState {
  readonly status: 'idle' | 'waiting' | 'running' | 'complete' | 'failed';
  readonly reason: string | null;
  readonly error: string | null;
}

export interface ApplicationSnapshot<T> {
  readonly revision: number;
  readonly phase: ConnectionPhase;
  readonly device: Readonly<DeviceIdentity> | null;
  readonly connectionGeneration: number;
  readonly selectionRevision: number;
  readonly workEpoch: number;
  readonly selection: ProfileSelection | null;
  readonly hydrationDepth: number;
  /** Cached onboard reads belong to one physical connection, never a previous device. */
  readonly allProfilesLoaded: boolean;
  readonly writesSuspended: boolean;
  readonly pendingEdits: readonly PendingEdit[];
  /** Informational activity from the sole physical transaction queue in the desktop. */
  readonly desktopPhase: DesktopPhase;
  readonly desktopTransactionCount: number;
  readonly lastCompletion: Readonly<EditCompletion<T>> | null;
  readonly lastError: string | null;
  readonly recovery: RecoveryState;
  readonly disposed: boolean;
}

export interface HydrationScope {
  readonly ticket: StateTicket;
  /** Apply model changes only while the connection and selection still match. */
  commit<T>(update: () => T): T;
  close(): void;
}

export interface EditOptions<T> {
  readonly key: string;
  readonly delayMs?: number;
  /** E.g. merge actuation edits by physical key rather than losing earlier keys. */
  readonly merge?: (previous: T, next: T) => T;
}

export interface CoordinatorOptions<TEdit, TResult> {
  readonly execute: (input: TEdit, ticket: StateTicket) => Promise<EditResult<TResult>>;
  readonly coalesceMs?: number;
  readonly onObserverError?: (error: unknown) => void;
}

interface EditJob<T> {
  readonly id: number;
  readonly key: string;
  readonly ticket: StateTicket;
  input: T;
  status: PendingEdit['status'];
  timer: ReturnType<typeof setTimeout> | undefined;
}

export class StaleWorkError extends Error {
  constructor() {
    super('Keyboard connection or profile changed while the operation was pending');
    this.name = 'StaleWorkError';
  }
}

/**
 * Owns renderer edit intents, coalescing and lifecycle state. Calls execute only
 * after hydration and in order; execute delegates to the desktop's existing
 * transaction queue. It never opens a device or introduces another HID queue.
 */
export class ApplicationStateCoordinator<TEdit, TResult> {
  private readonly options: CoordinatorOptions<TEdit, TResult>;
  private readonly listeners = new Set<() => void>();
  private readonly jobs = new Map<number, EditJob<TEdit>>();
  private readonly scheduled = new Map<string, EditJob<TEdit>>();
  private readonly hydrationScopes = new Set<number>();
  private sequence = 0;
  private revision = 0;
  private generation = 0;
  private selectionRevision = 0;
  private epoch = 0;
  private phase: ConnectionPhase = 'disconnected';
  private device: Readonly<DeviceIdentity> | null = null;
  private selection: ProfileSelection | null = null;
  private lastCompletion: Readonly<EditCompletion<TResult>> | null = null;
  private lastError: string | null = null;
  private allProfilesLoaded = false;
  private desktopPhase: DesktopPhase = 'unknown';
  private desktopTransactionCount = 0;
  private recovery: RecoveryState = Object.freeze({ status: 'idle', reason: null, error: null });
  private disposed = false;
  private chain: Promise<void> = Promise.resolve();
  private snapshot: ApplicationSnapshot<TResult>;

  constructor(options: CoordinatorOptions<TEdit, TResult>) {
    if (!Number.isFinite(options.coalesceMs ?? 180) || (options.coalesceMs ?? 180) < 0)
      throw new RangeError('Invalid edit coalescing delay');
    this.options = options;
    this.snapshot = this.makeSnapshot();
  }

  /** Stable references between changes make these methods usable by useSyncExternalStore. */
  readonly getSnapshot = (): ApplicationSnapshot<TResult> => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.ensureAlive();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Mirror actual desktop activity without adding intents or invalidating in-flight read tickets. */
  setDesktopActivity(activity: DesktopActivity): void {
    this.ensureAlive();
    if (!['ready', 'closing', 'closed'].includes(activity.phase))
      throw Error('Invalid desktop phase');
    if (!Number.isSafeInteger(activity.pendingTransactions) || activity.pendingTransactions < 0)
      throw Error('Invalid desktop transaction count');
    if (
      this.desktopPhase === activity.phase &&
      this.desktopTransactionCount === activity.pendingTransactions
    )
      return;
    this.desktopPhase = activity.phase;
    this.desktopTransactionCount = activity.pendingTransactions;
    this.publish();
  }

  ticket(): StateTicket {
    return Object.freeze({
      connectionGeneration: this.generation,
      selectionRevision: this.selectionRevision,
      workEpoch: this.epoch,
    });
  }

  isCurrent(ticket: StateTicket): boolean {
    return (
      !this.disposed &&
      ticket.connectionGeneration === this.generation &&
      ticket.selectionRevision === this.selectionRevision &&
      ticket.workEpoch === this.epoch
    );
  }

  assertCurrent(ticket: StateTicket): void {
    if (!this.isCurrent(ticket)) throw new StaleWorkError();
  }

  beginConnection(): StateTicket {
    this.ensureAlive();
    this.generation++;
    this.invalidateWork();
    this.device = null;
    this.allProfilesLoaded = false;
    this.phase = 'connecting';
    this.lastError = null;
    if (this.recovery.status === 'running')
      this.recovery = Object.freeze({ ...this.recovery, status: 'waiting' });
    this.publish();
    return this.ticket();
  }

  connected(device: DeviceIdentity, ticket?: StateTicket): void {
    this.ensureAlive();
    if (ticket) this.assertCurrent(ticket);
    if (!device.id.trim()) throw new Error('Device identity is required');
    if (this.phase !== 'connecting') throw new Error('Begin connection before accepting a device');
    this.device = Object.freeze({ ...device });
    this.phase = this.recovery.status === 'waiting' ? 'recovering' : 'ready';
    this.lastError = null;
    this.publish();
  }

  disconnect(): void {
    this.ensureAlive();
    this.generation++;
    this.invalidateWork();
    this.device = null;
    this.allProfilesLoaded = false;
    this.phase = 'disconnected';
    this.lastError = null;
    if (this.recovery.status === 'running')
      this.recovery = Object.freeze({ ...this.recovery, status: 'waiting' });
    this.publish();
  }

  markHardwareProfilesLoaded(ticket: StateTicket): void {
    this.assertCurrent(ticket);
    if (!this.device) throw new Error('Cannot cache profiles for a disconnected keyboard');
    this.allProfilesLoaded = true;
    this.publish();
  }

  invalidateHardwareCache(): void {
    this.ensureAlive();
    this.allProfilesLoaded = false;
    this.publish();
  }

  /** Changes desired selection; the caller explicitly schedules any user-originated write. */
  selectProfile(selection: ProfileSelection | null): StateTicket {
    this.ensureAlive();
    if (
      selection?.kind === 'onboard' &&
      (!Number.isInteger(selection.wireIndex) || selection.wireIndex < 0 || selection.wireIndex > 3)
    )
      throw new RangeError('Onboard profile index must be 0 through 3');
    if (selection?.kind === 'software' && (!selection.id.trim() || selection.wireIndex !== 4))
      throw new Error('A software profile needs an id and wire slot 4');
    const unchanged =
      this.selection?.kind === selection?.kind &&
      this.selection?.wireIndex === selection?.wireIndex &&
      (this.selection?.kind !== 'software' ||
        (selection?.kind === 'software' && this.selection.id === selection.id));
    if (unchanged) return this.ticket();
    this.selectionRevision++;
    this.invalidateWork();
    this.selection = selection ? Object.freeze({ ...selection }) : null;
    if (this.phase === 'hydrating') this.phase = this.device ? 'ready' : 'disconnected';
    this.publish();
    return this.ticket();
  }

  beginHydration(ownerTicket?: StateTicket): HydrationScope {
    this.ensureAlive();
    if (!this.device || (this.phase !== 'ready' && this.phase !== 'hydrating'))
      throw new Error('A connected keyboard is required for hydration');
    if (ownerTicket) this.assertCurrent(ownerTicket);
    const active = [...this.jobs.values()].find(
      (job) => job.status === 'running' && this.isCurrent(job.ticket),
    );
    if (active && !ownerTicket)
      throw new Error('Wait for active device edits before hydrating models');
    // Queued user edits were based on the previous model snapshot and must not replay after reads.
    if (this.hydrationScopes.size === 0) {
      if (ownerTicket) {
        for (const job of [...this.jobs.values()])
          if (job.status !== 'running') this.removeJob(job);
      } else this.invalidateWork();
    }
    const id = ++this.sequence;
    const ticket = this.ticket();
    this.hydrationScopes.add(id);
    this.phase = 'hydrating';
    this.publish();
    let closed = false;
    return Object.freeze({
      ticket,
      commit: <T>(update: () => T): T => {
        if (closed || !this.hydrationScopes.has(id)) throw new StaleWorkError();
        this.assertCurrent(ticket);
        return update();
      },
      close: (): void => {
        if (closed) return;
        closed = true;
        if (!this.hydrationScopes.delete(id)) return;
        if (this.hydrationScopes.size === 0 && this.phase === 'hydrating') this.phase = 'ready';
        this.publish();
      },
    });
  }

  async withHydration<T>(
    read: (scope: HydrationScope) => Promise<T>,
    ownerTicket?: StateTicket,
  ): Promise<T> {
    const scope = this.beginHydration(ownerTicket);
    try {
      const result = await read(scope);
      this.assertCurrent(scope.ticket);
      return result;
    } finally {
      scope.close();
    }
  }

  /** Null means an observer fired during hydration/recovery/offline and no write was accepted. */
  scheduleEdit(input: TEdit, options: EditOptions<TEdit>): number | null {
    this.ensureAlive();
    if (this.phase !== 'ready' || this.hydrationScopes.size !== 0 || !this.device) return null;
    if (!options.key) throw new Error('An edit coalescing key is required');
    const delayMs = options.delayMs ?? this.options.coalesceMs ?? 180;
    if (!Number.isFinite(delayMs) || delayMs < 0) throw new RangeError('Invalid edit delay');
    const previous = this.scheduled.get(options.key) ??
      [...this.jobs.values()].find(job => job.key === options.key && job.status === 'queued');
    if (previous) {
      input = options.merge ? options.merge(previous.input, input) : input;
      this.removeJob(previous);
    }
    const job: EditJob<TEdit> = {
      id: ++this.sequence,
      key: options.key,
      ticket: this.ticket(),
      input,
      status: 'scheduled',
      timer: undefined,
    };
    this.jobs.set(job.id, job);
    this.scheduled.set(job.key, job);
    job.timer = setTimeout(() => this.enqueue(job), delayMs);
    this.publish();
    return job.id;
  }

  /** Submit deferred intents now and wait until the current serial intent chain settles. */
  async flush(): Promise<void> {
    this.ensureAlive();
    for (;;) {
      for (const job of [...this.scheduled.values()]) this.enqueue(job);
      const pending = this.chain;
      await pending;
      if (pending === this.chain && this.scheduled.size === 0) break;
    }
    if (this.lastError) throw new Error(this.lastError);
  }

  cancelPending(): void {
    this.ensureAlive();
    this.invalidateWork();
    if (this.phase === 'hydrating') this.phase = this.device ? 'ready' : 'disconnected';
    this.publish();
  }

  fail(error: unknown): void {
    this.ensureAlive();
    this.invalidateWork();
    this.lastError = errorMessage(error);
    this.phase = 'error';
    this.publish();
  }

  beginRecovery(reason: string): StateTicket {
    this.ensureAlive();
    this.invalidateWork();
    this.phase = 'recovering';
    this.lastError = null;
    this.recovery = Object.freeze({ status: 'running', reason, error: null });
    this.publish();
    return this.ticket();
  }

  /** A durable restore journal exists but recovery is waiting for a usable device. */
  requestRecovery(reason: string): void {
    this.ensureAlive();
    this.invalidateWork();
    this.recovery = Object.freeze({ status: 'waiting', reason, error: null });
    this.phase = this.device ? 'recovering' : 'disconnected';
    this.publish();
  }

  finishRecovery(ticket: StateTicket, error?: unknown): void {
    this.assertCurrent(ticket);
    if (this.recovery.status !== 'running') throw new Error('No recovery is running');
    const message = error === undefined ? null : errorMessage(error);
    this.recovery = Object.freeze({
      status: message ? 'failed' : 'complete',
      reason: this.recovery.reason,
      error: message,
    });
    this.lastError = message;
    this.phase = message ? 'error' : this.device ? 'ready' : 'disconnected';
    this.publish();
  }

  /** Stops accepting work. Already running hardware calls must be drained by desktop shutdown. */
  dispose(): void {
    if (this.disposed) return;
    this.invalidateWork();
    this.disposed = true;
    this.device = null;
    this.phase = 'disconnected';
    this.publish();
    this.listeners.clear();
  }

  private enqueue(job: EditJob<TEdit>): void {
    if (!this.jobs.has(job.id) || job.status !== 'scheduled') return;
    if (job.timer !== undefined) clearTimeout(job.timer);
    job.timer = undefined;
    this.scheduled.delete(job.key);
    job.status = 'queued';
    this.publish();
    this.chain = this.chain.then(async () => {
      if (!this.jobs.has(job.id) || !this.isCurrent(job.ticket)) {
        this.removeJob(job);
        return;
      }
      job.status = 'running';
      this.publish();
      try {
        const result = await this.options.execute(job.input, job.ticket);
        if (this.isCurrent(job.ticket)) {
          this.lastCompletion = Object.freeze({
            id: job.id,
            key: job.key,
            value: result.value,
            evidence: result.evidence,
          });
          this.lastError = null;
        }
      } catch (error) {
        if (this.isCurrent(job.ticket)) {
          this.invalidateWork();
          this.lastError = errorMessage(error);
          this.phase = 'error';
        }
      } finally {
        this.removeJob(job);
        this.publish();
      }
    });
  }

  private invalidateWork(): void {
    this.epoch++;
    this.lastCompletion = null;
    this.hydrationScopes.clear();
    for (const job of [...this.jobs.values()]) if (job.status !== 'running') this.removeJob(job);
  }

  private removeJob(job: EditJob<TEdit>): void {
    if (job.timer !== undefined) clearTimeout(job.timer);
    if (this.scheduled.get(job.key)?.id === job.id) this.scheduled.delete(job.key);
    this.jobs.delete(job.id);
  }

  private ensureAlive(): void {
    if (this.disposed) throw new Error('Application state is disposed');
  }

  private makeSnapshot(): ApplicationSnapshot<TResult> {
    return Object.freeze({
      revision: this.revision,
      phase: this.phase,
      device: this.device,
      connectionGeneration: this.generation,
      selectionRevision: this.selectionRevision,
      workEpoch: this.epoch,
      selection: this.selection,
      hydrationDepth: this.hydrationScopes.size,
      allProfilesLoaded: this.allProfilesLoaded,
      writesSuspended: this.phase !== 'ready' || this.hydrationScopes.size > 0,
      desktopPhase: this.desktopPhase,
      desktopTransactionCount: this.desktopTransactionCount,
      pendingEdits: Object.freeze(
        [...this.jobs.values()].map((job) =>
          Object.freeze({
            id: job.id,
            key: job.key,
            status: job.status,
            stale: !this.isCurrent(job.ticket),
            ticket: job.ticket,
          }),
        ),
      ),
      lastCompletion: this.lastCompletion,
      lastError: this.lastError,
      recovery: this.recovery,
      disposed: this.disposed,
    });
  }

  private publish(): void {
    this.revision++;
    this.snapshot = this.makeSnapshot();
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        // Presentation code cannot interrupt lifecycle cleanup or hardware completion.
        try {
          this.options.onObserverError?.(error);
        } catch {
          // Even an error reporter must not prevent other subscribers or cleanup.
        }
      }
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createApplicationState<TEdit, TResult>(
  options: CoordinatorOptions<TEdit, TResult>,
): ApplicationStateCoordinator<TEdit, TResult> {
  return new ApplicationStateCoordinator(options);
}
