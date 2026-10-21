import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type * as C from './contracts.cjs';
import { nativeReply } from './native-replies.cjs';
type SensorMode = '--current' | '--sensors';
type SensorReply = (C.SensorSnapshot | C.CurrentSnapshot) & { transport?: string };
import { required } from './validation.cjs';
interface Pending {
  resolve: (value: SensorReply) => void;
  reject: (reason: unknown) => void;
  timer: NodeJS.Timeout;
  mode: SensorMode;
}
/** Warm read-only process; one request in flight, bounded replies and timeout.
 * The Rust process releases the device between requests and exits on pipe EOF. */
export class SensorWorker {
  resolveExecutable: () => string;
  child: ChildProcessWithoutNullStreams | null;
  pending: Pending | null;
  queue: Promise<unknown>;
  idle: NodeJS.Timeout | undefined;
  constructor(resolveExecutable: () => string) {
    this.resolveExecutable = resolveExecutable;
    this.child = null;
    this.pending = null;
    this.queue = Promise.resolve();
    this.idle = undefined;
  }
  stop(reason = 'Sensor reader stopped') {
    clearTimeout(this.idle);
    const child = this.child;
    this.child = null;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(Error(reason));
      this.pending = null;
    }
    if (child) {
      child.stdin.destroy();
      child.kill();
    }
  }
  request(mode: SensorMode) {
    if (!['--current', '--sensors'].includes(mode))
      return Promise.reject(Error('Unsupported sensor operation'));
    const result = this.queue.then(() => this.read(mode));
    this.queue = result.catch(() => {});
    return result;
  }
  read(mode: SensorMode): Promise<SensorReply> {
    clearTimeout(this.idle);
    return new Promise((resolve, reject) => {
      if (!this.child) {
        let buffer = '',
          stderr = '';
        const child = spawn(this.resolveExecutable(), ['--serve-sensors'], {
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.child = child;
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (data) => {
          stderr = (stderr + data).slice(-4000);
        });
        child.stdout.on('data', (data) => {
          if (this.child !== child) return;
          buffer += data;
          if (buffer.length > 1048576) {
            this.stop('Sensor response exceeded limit');
            return;
          }
          const end = buffer.indexOf('\n');
          if (end < 0) return;
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          const pending = this.pending;
          if (!pending) {
            this.stop('Unsolicited sensor response');
            return;
          }
          this.pending = null;
          clearTimeout(pending.timer);
          try {
            const value: unknown = JSON.parse(line);
            if (
              !value ||
              typeof value !== 'object' ||
              !('nativeLanguage' in value) ||
              value.nativeLanguage !== 'Rust'
            )
              throw Error('Invalid persistent sensor contract');
            pending.resolve({ ...nativeReply(pending.mode, value), transport: 'persistent-rust' });
          } catch (error) {
            pending.reject(error);
          }
          this.idle = setTimeout(() => this.stop(), 2000);
          this.idle.unref();
        });
        child.on('error', (error) => {
          if (this.child === child) this.stop(error.message);
        });
        child.on('exit', (code) => {
          if (this.child === child) this.stop(stderr || 'Sensor process exited: ' + code);
        });
      }
      this.pending = {
        mode,
        resolve,
        reject,
        timer: setTimeout(() => this.stop('Persistent sensor read timed out'), 7000),
      };
      required(this.child).stdin.write(mode + '\n', (error) => {
        if (error) this.stop(error.message);
      });
    });
  }
}
