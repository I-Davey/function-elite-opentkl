/** Versioned user-space device host. A failed or timed-out write is never replayed. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { performance } from 'node:perf_hooks';
export type Operation =
  | '--enumerate'
  | '--version'
  | '--connection'
  | '--sensors'
  | '--current'
  | '--state'
  | '--snap'
  | '--lighting'
  | '--actuation'
  | '--apply-field'
  | '--apply-actuation'
  | '--apply-lighting'
  | '--apply-runtime-lighting'
  | '--remaps'
  | '--apply-remap'
  | '--apply-remaps'
  | '--apply-snap'
  | '--apply-software-actuation';
export type DeviceResult = Record<string, unknown>;
interface Task {
  id: number;
  operation: Operation;
  payload?: unknown;
  enqueued: number;
  started: number;
  resolve(value: DeviceResult): void;
  reject(error: Error): void;
  timer?: NodeJS.Timeout;
}
export class DeviceHostError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly requestId?: number,
  ) {
    super(message);
    this.name = 'DeviceHostError';
  }
}
const LIMIT = 1_048_576;
const MODES = new Set<string>([
  '--enumerate',
  '--version',
  '--connection',
  '--sensors',
  '--current',
  '--state',
  '--snap',
  '--lighting',
  '--actuation',
  '--apply-field',
  '--apply-actuation',
  '--apply-lighting',
  '--apply-runtime-lighting',
  '--remaps',
  '--apply-remap',
  '--apply-remaps',
  '--apply-snap',
  '--apply-software-actuation',
]);

/** One process/one in-flight command. Scheduling yields sensor traffic to configuration. */
export class DeviceHost {
  private child: ChildProcessWithoutNullStreams | null = null;
  private ready = false;
  private queue: Task[] = [];
  private pending: Task | null = null;
  private nextId = 0;
  private startupTimer?: NodeJS.Timeout;
  private idleTimer?: NodeJS.Timeout;
  private samples: { operation: string; queueMs: number; operationMs: number }[] = [];
  private launches = 0;
  constructor(
    private readonly executable: () => string,
    private readonly timeoutMs = 8000,
    private readonly hostArgs: string[] = ['--serve'],
  ) {}

  request(operation: Operation, payload?: unknown): Promise<DeviceResult> {
    if (!MODES.has(operation))
      return Promise.reject(
        new DeviceHostError('Unsupported device operation', 'INVALID_OPERATION'),
      );
    if (this.queue.length >= 32)
      return Promise.reject(new DeviceHostError('Device request queue is full', 'QUEUE_FULL'));
    if (Buffer.byteLength(JSON.stringify(payload) ?? '') > LIMIT - 512)
      return Promise.reject(new DeviceHostError('Device payload too large', 'PAYLOAD_TOO_LARGE'));
    return new Promise((resolve, reject) => {
      this.queue.push({
        id: ++this.nextId,
        operation,
        payload,
        enqueued: performance.now(),
        started: 0,
        resolve,
        reject,
      });
      try {
        if (!this.child) this.start();
        this.pump();
      } catch (error) {
        this.stop(String(error));
      }
    });
  }

  stop(reason = 'Device host stopped'): void {
    clearTimeout(this.startupTimer);
    clearTimeout(this.idleTimer);
    const child = this.child;
    this.child = null;
    this.ready = false;
    const failed = [...(this.pending ? [this.pending] : []), ...this.queue];
    this.pending = null;
    this.queue = [];
    for (const task of failed) {
      clearTimeout(task.timer);
      task.reject(new DeviceHostError(reason, 'HOST_STOPPED', task.id));
    }
    if (child) {
      child.stdin.destroy();
      child.kill();
    }
  }

  diagnostics() {
    return {
      launches: this.launches,
      queued: this.queue.length,
      inFlight: this.pending?.operation ?? null,
      samples: this.samples.slice(),
    };
  }

  private start(): void {
    const child = spawn(this.executable(), this.hostArgs, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;
    this.launches++;
    let buffer = '',
      stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (data: string) => {
      stderr = (stderr + data).slice(-4000);
    });
    child.stdin.on('error', (error) => {
      if (this.child === child) this.stop(error.message);
    });
    child.stdout.on('data', (data: string) => {
      if (this.child !== child) return;
      buffer += data;
      if (Buffer.byteLength(buffer) > LIMIT) {
        this.stop('Device response exceeded limit');
        return;
      }
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        try {
          this.receive(JSON.parse(line));
        } catch (error) {
          this.stop('Invalid device host response: ' + String(error));
          return;
        }
      }
    });
    child.on('error', (error) => {
      if (this.child === child) this.stop(error.message);
    });
    child.on('exit', (code) => {
      if (this.child === child) this.stop(stderr || 'Device host exited: ' + code);
    });
    this.startupTimer = setTimeout(() => this.stop('Device host handshake timed out'), 3000);
  }

  private receive(value: unknown): void {
    if (!isRecord(value)) throw Error('Invalid response object');
    if (value.protocolVersion !== 1) throw Error('Unsupported protocol version');
    if (!this.ready) {
      if (
        value.event !== 'ready' ||
        value.nativeLanguage !== 'Rust' ||
        value.maxRequestBytes !== LIMIT
      )
        throw Error('Invalid handshake');
      this.ready = true;
      clearTimeout(this.startupTimer);
      this.pump();
      return;
    }
    const task = this.pending;
    if (!task || value.requestId !== task.id || typeof value.ok !== 'boolean')
      throw Error('Stale or unsolicited response');
    this.pending = null;
    clearTimeout(task.timer);
    this.samples.push({
      operation: task.operation,
      queueMs: task.started - task.enqueued,
      operationMs: performance.now() - task.started,
    });
    if (this.samples.length > 256) this.samples.shift();
    if (!value.ok) {
      task.reject(
        new DeviceHostError(
          isRecord(value.error) && typeof value.error.message === 'string'
            ? value.error.message
            : 'Device operation failed',
          isRecord(value.error) && typeof value.error.code === 'string'
            ? value.error.code
            : 'DEVICE_OPERATION_FAILED',
          task.id,
        ),
      );
      // Drop queued work after an ambiguous device failure. No automatic retry.
      this.stop('Device operation failed; queued work cancelled');
      return;
    }
    const result = value.result;
    const write = task.operation.startsWith('--apply-');
    if (
      !isRecord(result) ||
      result.nativeLanguage !== 'Rust' ||
      (task.operation === '--enumerate'
        ? result.reportIoPerformed !== false
        : write
          ? result.readOnly !== false
          : result.readOnly !== true || result.settingsWritePerformed !== false)
    ) {
      task.reject(
        new DeviceHostError('Device result contract changed', 'CONTRACT_CHANGED', task.id),
      );
      this.stop('Device result contract changed');
      return;
    }
    task.resolve(result);
    this.pump();
  }

  private pump(): void {
    clearTimeout(this.idleTimer);
    if (!this.ready || this.pending) return;
    if (!this.queue.length) {
      this.idleTimer = setTimeout(() => this.stop(), 30000);
      this.idleTimer.unref();
      return;
    }
    const configuration = this.queue.findIndex(
      (task) => !['--current', '--sensors'].includes(task.operation),
    );
    const task = this.queue.splice(configuration < 0 ? 0 : configuration, 1)[0];
    this.pending = task;
    task.started = performance.now();
    task.timer = setTimeout(
      () => this.stop('Device operation timed out; outcome may be unknown'),
      this.timeoutMs,
    );
    const envelope = {
      protocolVersion: 1,
      requestId: task.id,
      operation: task.operation,
      ...(task.payload === undefined ? {} : { payload: task.payload }),
    };
    this.child!.stdin.write(JSON.stringify(envelope) + '\n');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
