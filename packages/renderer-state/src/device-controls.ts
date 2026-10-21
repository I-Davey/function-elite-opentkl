import type * as C from '../../backend/src/contracts.cjs';
import type {
  ApplicationStateCoordinator,
  EditResult,
  StateTicket,
} from '../../application-state/src/index.js';
import { StaleWorkError } from '../../application-state/src/index.js';

export type DeviceEditIntent =
  | ({ kind: 'field' } & C.FieldEdit)
  | { kind: 'software'; profile: C.ProfileInput; wireIndex: 4 }
  | { kind: 'profile'; profile: C.ProfileInput; wireIndex: number }
  | ({ kind: 'actuation' } & C.ActuationInput)
  | ({ kind: 'remap' } & C.RemapInput)
  | ({ kind: 'snap' } & C.SnapInput)
  | ({ kind: 'lighting' } & C.LightingInput);

export interface DeviceEditOutcome {
  readonly input: DeviceEditIntent;
  readonly receipt: C.EditResult;
}

/** Structural subset of KeyboardHost: renderer controls do not depend on host implementation. */
export interface DeviceControlHost {
  applySoftwareProfile(profile: C.ProfileInput): Promise<C.EditResult>;
  applyProfile(profile: C.ProfileInput): Promise<C.EditResult>;
  applySnap(input: C.SnapInput): Promise<C.EditResult>;
  applyRemap(input: C.RemapInput): Promise<C.EditResult>;
  applyActuation(input: C.ActuationInput): Promise<C.EditResult>;
  applyLighting(input: C.LightingInput): Promise<C.EditResult>;
  applyField(input: C.FieldEdit): Promise<C.EditResult>;
  releaseSoftwareProfile(): Promise<C.MutationResult>;
  restoreProfile(backup: string): Promise<C.EditResult>;
  restoreSnap(backup: string): Promise<C.EditResult>;
  restoreRemap(backup: string): Promise<C.EditResult>;
  restoreActuation(backup: string): Promise<C.EditResult>;
  restoreLighting(backup: string): Promise<C.EditResult>;
  restoreField(backup: string): Promise<C.EditResult>;
  connection(): Promise<C.Connection>;
}

/** A snapshot adapter keeps recovered model classes outside lifecycle ownership. */
export interface ControlSnapshot {
  readonly id: string;
  readonly slot: number | undefined;
  readonly brightnessKeys: number;
  readonly brightnessRing: number;
  readonly pollingRate: string;
  readonly gameMode: boolean;
  readonly fnLock: boolean;
  readonly idleMinutes: number;
  readonly snap: C.SnapConfig[];
  readonly remaps: Omit<C.RemapInput, 'wireIndex'>[];
  readonly hardware: C.ProfileInput[];
  readonly software: C.ProfileInput | null;
  readonly actuation: C.ActuationEdit[];
  readonly Base: C.Zone[];
  readonly Ring: C.Zone[];
  readonly Reactive: C.Zone[];
  readonly originatedFromDevice: ReadonlySet<string>;
}

export type LiveControls = C.Connection & {
  brightnessChannels: number[];
  gameModeEnabled: boolean;
  fnLockEnabled: boolean;
};

export interface ControlModelPort {
  /** Adapter must capture every nested field used by its MobX observation. */
  observe(
    effect: (next: ControlSnapshot, previous: ControlSnapshot | undefined) => void,
  ): () => void;
  syncHardwareProfiles(ownerTicket?: StateTicket): Promise<unknown>;
  syncLiveValues(value: LiveControls): void;
  depthActive(): boolean;
  activeWireSlot(): number;
  /** Mirrors optional diagnostic/native snapshots; lifecycle state belongs to coordinator. */
  didApply?(value: DeviceEditOutcome): void | Promise<void>;
}

export interface DeviceControlsContext {
  readonly state: ApplicationStateCoordinator<DeviceEditIntent, DeviceEditOutcome>;
  readonly host: DeviceControlHost;
  readonly model: ControlModelPort;
  readonly label: (message: string) => void;
  readonly report: () => void;
  readonly diagnostic: (value: { kind: string; error: string; field?: C.Field }) => void;
  readonly pollIntervalMs?: number;
}

export interface DeviceControls {
  readonly state: ApplicationStateCoordinator<DeviceEditIntent, DeviceEditOutcome>;
  readonly suspended: number;
  readonly disconnected: boolean;
  readonly software: boolean;
  readonly disposed: boolean;
  readonly last: (C.EditResult & { editKind: DeviceEditIntent['kind'] }) | null;
  readonly error: string | null;
  readonly supportedFields: readonly string[];
  /** Bind as the coordinator's execute callback; it is not a public second queue. */
  execute(input: DeviceEditIntent, ticket: StateTicket): Promise<EditResult<DeviceEditOutcome>>;
  schedule(input: DeviceEditIntent): number | null;
  flush(): Promise<void>;
  undo(): Promise<C.MutationResult>;
  busy(): boolean;
  pollNow(): Promise<void>;
  dispose(): void;
}

/** Named host calls preserve all existing backup/compare/readback transaction semantics. */
export function createDeviceEditExecutor(host: DeviceControlHost) {
  return async (input: DeviceEditIntent): Promise<EditResult<DeviceEditOutcome>> => {
    let receipt: C.EditResult;
    switch (input.kind) {
      case 'software':
        receipt = await host.applySoftwareProfile(input.profile);
        break;
      case 'profile':
        receipt = await host.applyProfile(input.profile);
        break;
      case 'snap':
        receipt = await host.applySnap({ wireIndex: input.wireIndex, configs: input.configs });
        break;
      case 'remap':
        receipt = await host.applyRemap({
          wireIndex: input.wireIndex,
          physicalKey: input.physicalKey,
          level: input.level,
          fnLayer: input.fnLayer,
          remap: input.remap,
        });
        break;
      case 'actuation':
        receipt = await host.applyActuation({ wireIndex: input.wireIndex, keys: input.keys });
        break;
      case 'lighting':
        receipt = await host.applyLighting({
          wireIndex: input.wireIndex,
          layer: input.layer,
          zones: input.zones,
        });
        break;
      case 'field':
        receipt = await host.applyField({
          wireIndex: input.wireIndex,
          field: input.field,
          value: input.value,
        });
        break;
    }
    return {
      value: { input, receipt },
      evidence: input.kind === 'software' ? 'acknowledged' : 'readback',
    };
  };
}

/** No global stores, device handles, manual suspension counters or independent write timers. */
export function createDeviceControls(context: DeviceControlsContext): DeviceControls {
  const { state, host, model, label, diagnostic, report } = context;
  const dispatch = createDeviceEditExecutor(host);
  const rates = ['Hz8000', 'Hz4000', 'Hz2000', 'Hz1000', 'Hz500', 'Hz250', 'Hz125'];
  let last: DeviceEditOutcome | null = null;
  let lastTicket: StateTicket | null = null;
  let disposed = false;
  let checking = false;
  let lastError: string | null = null;

  const schedule = (input: DeviceEditIntent, immediate = false): number | null =>
    state.scheduleEdit(input, {
      key: coalescingKey(input),
      ...(immediate ? {delayMs:0} : {}),
      merge(previous, next) {
        if (previous.kind !== 'actuation' || next.kind !== 'actuation') return next;
        const keys = new Map(previous.keys.map((key) => [key.physicalKey, key]));
        for (const key of next.keys) keys.set(key.physicalKey, key);
        return { ...next, keys: [...keys.values()] };
      },
    });

  const observe = model.observe((next, previous) => {
    if (disposed || !previous || state.getSnapshot().writesSuspended) return;
    if (next.id !== previous.id) {
      state.selectProfile(
        next.slot === undefined
          ? { kind: 'software', id: next.id, wireIndex: 4 }
          : { kind: 'onboard', wireIndex: next.slot },
      );
      if (next.originatedFromDevice.has('activeProfileId')) return;
      if (next.slot === undefined) {
        if (next.software) schedule({ kind: 'software', wireIndex: 4, profile: next.software }, true);
      } else
        schedule({ kind: 'field', field: 'activeProfile', wireIndex: next.slot, value: next.slot }, true);
      return;
    }
    if (next.slot === undefined) {
      for (const field of ['brightnessKeys', 'brightnessRing'] as const)
        if (next[field] !== previous[field] && next.software?.settings.keyBrightness===undefined)
          schedule({
            kind: 'field',
            field,
            wireIndex: model.activeWireSlot(),
            value: Math.round(next[field] * 100),
          });
      if (!equal(next.software, previous.software) && next.software)
        schedule({ kind: 'software', wireIndex: 4, profile: next.software });
      const old = new Map(previous.hardware.map((profile) => [profile.wireIndex, profile]));
      for (const profile of next.hardware)
        if (!equal(old.get(profile.wireIndex), profile))
          schedule({ kind: 'profile', wireIndex: profile.wireIndex, profile });
      return;
    }
    const oldRemaps = new Map(previous.remaps.map((remap) => [remapKey(remap), remap.remap]));
    for (const remap of next.remaps)
      if (!equal(oldRemaps.get(remapKey(remap)), remap.remap))
        schedule({ kind: 'remap', wireIndex: next.slot, ...remap });
    const oldActuation = new Map(previous.actuation.map((key) => [key.physicalKey, key]));
    const changedKeys = next.actuation.filter(
      (key) => !equal(oldActuation.get(key.physicalKey), key),
    );
    if (changedKeys.length)
      schedule({ kind: 'actuation', wireIndex: next.slot, keys: changedKeys });
    if (!equal(next.snap, previous.snap))
      schedule({ kind: 'snap', wireIndex: next.slot, configs: next.snap });
    for (const layer of ['Base', 'Ring', 'Reactive'] as const)
      if (!equal(next[layer], previous[layer]))
        schedule({ kind: 'lighting', wireIndex: next.slot, layer, zones: next[layer] });
    for (const field of [
      'brightnessKeys',
      'brightnessRing',
      'pollingRate',
      'gameMode',
      'fnLock',
      'idleMinutes',
    ] as const) {
      if (next[field] === previous[field]) continue;
      const origin =
        field === 'brightnessKeys'
          ? 'keyBrightness'
          : field === 'brightnessRing'
            ? 'perimeterBrightness'
            : field;
      if (next.originatedFromDevice.has(origin)) continue;
      const value =
        field === 'brightnessKeys' || field === 'brightnessRing'
          ? Math.round(next[field] * 100)
          : field === 'pollingRate'
            ? rates.indexOf(next.pollingRate)
            : field === 'gameMode' || field === 'fnLock'
              ? Number(next[field])
              : next.idleMinutes;
      schedule({ kind: 'field', field, wireIndex: next.slot, value });
    }
  });

  const unsubscribe = state.subscribe(() => {
    const snapshot = state.getSnapshot();
    if (snapshot.lastError && snapshot.lastError !== lastError) {
      lastError = snapshot.lastError;
      label(
        /found 0|not connected|device.*disconnected/i.test(lastError)
          ? 'Keyboard disconnected'
          : 'Could not apply keyboard setting',
      );
      diagnostic({ kind: 'device-edit-error', error: lastError });
    } else if (!snapshot.lastError) lastError = null;
  });

  const controls: DeviceControls = {
    state,
    get suspended() {
      return Number(state.getSnapshot().writesSuspended);
    },
    get disconnected() {
      return state.getSnapshot().phase === 'disconnected';
    },
    get software() {
      return model.activeWireSlot() === 4;
    },
    get disposed() {
      return disposed;
    },
    get last() {
      return undoAvailable() && last ? { ...last.receipt, editKind: last.input.kind } : null;
    },
    get error() {
      return state.getSnapshot().lastError;
    },
    supportedFields: Object.freeze([
      'brightnessKeys',
      'brightnessRing',
      'pollingRate',
      'gameMode',
      'fnLock',
      'idleMinutes',
      'activeProfile',
      'actuation',
      'lighting',
      'remaps',
      'macros',
    ]),
    async execute(input, ticket) {
      label('Applying keyboard setting…');
      const result = await dispatch(input);
      state.assertCurrent(ticket);
      last = result.value;
      lastTicket = ticket;
      await model.didApply?.(result.value);
      if (input.kind === 'field' && input.field === 'activeProfile') {
        await model.syncHardwareProfiles(ticket);
      }
      label(
        input.kind === 'software'
          ? 'Software profile active · live actuation acknowledged by firmware'
          : 'Keyboard connected · last device edit verified',
      );
      report();
      return result;
    },
    schedule,
    flush: () => state.flush(),
    busy: () => state.getSnapshot().pendingEdits.length > 0,
    async undo() {
      await state.flush();
      const saved = last;
      if (!undoAvailable() || !saved?.receipt.backup)
        throw Error('No verified device edit to undo');
      const recovery = state.beginRecovery('Restore previous device edit');
      let result: C.MutationResult;
      try {
        if (saved.input.kind === 'software') {
          result = await host.releaseSoftwareProfile();
        } else {
          const restore =
            saved.input.kind === 'profile'
              ? host.restoreProfile
              : saved.input.kind === 'snap'
                ? host.restoreSnap
                : saved.input.kind === 'remap'
                  ? host.restoreRemap
                  : saved.input.kind === 'actuation'
                    ? host.restoreActuation
                    : saved.input.kind === 'lighting'
                      ? host.restoreLighting
                      : host.restoreField;
          if (saved.input.kind === 'actuation' && saved.receipt.batches?.length) {
            let restored: C.MutationResult | undefined;
            for (const batch of [...saved.receipt.batches].reverse())
              restored = await restore(batch.backup);
            if (!restored) throw Error('Missing actuation undo batch');
            result = restored;
          } else result = await restore(saved.receipt.backup);
          if (model.activeWireSlot() === 4) await host.releaseSoftwareProfile();
        }
        state.assertCurrent(recovery);
        last = null;
        lastTicket = null;
        state.finishRecovery(recovery);
        await model.syncHardwareProfiles();
        label('Previous device setting restored and verified');
        report();
        return result;
      } catch (error) {
        if (state.isCurrent(recovery) && state.getSnapshot().recovery.status === 'running')
          state.finishRecovery(recovery, error);
        throw error;
      }
    },
    async pollNow() {
      const before = state.getSnapshot();
      if (
        disposed ||
        checking ||
        controls.busy() ||
        model.depthActive() ||
        before.phase === 'hydrating' ||
        before.phase === 'connecting' ||
        before.phase === 'recovering'
      )
        return;
      checking = true;
      const ticket = state.ticket();
      let operationGeneration = ticket.connectionGeneration;
      try {
        const connection = await host.connection();
        if (!state.isCurrent(ticket) || controls.busy()) return;
        const current = requireLiveControls(connection);
        const reconnecting = before.phase === 'disconnected' || before.phase === 'error';
        if (reconnecting) {
          const attempt = state.beginConnection();
          state.connected(
            { id: connection.devicePath ?? 'nzxt-function-elite', firmware: connection.firmware },
            attempt,
          );
          operationGeneration = state.getSnapshot().connectionGeneration;
          const reconnectHydration = state.beginHydration();
          try {
            await host.releaseSoftwareProfile();
            await model.syncHardwareProfiles();
          } finally {
            reconnectHydration.close();
          }
          label('Keyboard reconnected · settings refreshed');
          return;
        }
        if (reconnecting || current.activeProfileIndex !== model.activeWireSlot()) {
          await model.syncHardwareProfiles();
          label('Keyboard reconnected · settings refreshed');
          // Profile hydration already read current device controls. The connection
          // captured before software-session release may describe the former slot.
          return;
        }
        const hydration = state.beginHydration();
        try {
          hydration.commit(() => model.syncLiveValues(current));
        } finally {
          hydration.close();
        }
      } catch (error) {
        // A stale request must never disconnect the replacement connection.
        if (
          !disposed &&
          state.getSnapshot().connectionGeneration === operationGeneration &&
          !(error instanceof StaleWorkError)
        ) {
          state.disconnect();
          label('Keyboard disconnected');
          diagnostic({ kind: 'connection-error', error: errorMessage(error) });
        }
      } finally {
        checking = false;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(lifecycle);
      observe();
      unsubscribe();
      state.dispose();
    },
  };
  const lifecycle = setInterval(() => {
    void controls.pollNow();
  }, context.pollIntervalMs ?? 3000);
  if (state.getSnapshot().phase === 'ready') label('Keyboard connected · device controls linked');
  return controls;

  function undoAvailable(): boolean {
    const snapshot = state.getSnapshot();
    return (
      lastTicket !== null &&
      lastTicket.connectionGeneration === snapshot.connectionGeneration &&
      lastTicket.selectionRevision === snapshot.selectionRevision
    );
  }
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function remapKey(value: Pick<C.RemapInput, 'physicalKey' | 'level' | 'fnLayer'>): string {
  return `${value.physicalKey}:${value.level}:${value.fnLayer}`;
}

function coalescingKey(input: DeviceEditIntent): string {
  return (
    `${input.wireIndex}:${input.kind === 'field' ? input.field : input.kind}:` +
    (input.kind === 'lighting' ? input.layer : '') +
    ':' +
    (input.kind === 'remap' ? remapKey(input) : '')
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** connection() retains a compact transport type; validate optional control metadata here. */
function requireLiveControls(connection: C.Connection): LiveControls {
  const value: unknown = connection;
  if (!value || typeof value !== 'object') throw Error('Invalid live keyboard controls');
  const controls = value as Record<string, unknown>;
  if (
    !Array.isArray(controls.brightnessChannels) ||
    controls.brightnessChannels.length !== 2 ||
    !controls.brightnessChannels.every(
      (channel: unknown) =>
        typeof channel === 'number' && Number.isInteger(channel) && channel >= 0 && channel <= 100,
    ) ||
    typeof controls.gameModeEnabled !== 'boolean' ||
    typeof controls.fnLockEnabled !== 'boolean'
  )
    throw Error('Invalid live keyboard controls');
  return {
    ...connection,
    brightnessChannels: controls.brightnessChannels as number[],
    gameModeEnabled: controls.gameModeEnabled,
    fnLockEnabled: controls.fnLockEnabled,
  };
}
