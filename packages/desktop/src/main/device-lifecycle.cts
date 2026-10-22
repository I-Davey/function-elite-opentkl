import type { App, RecordEvent, Serial } from '../../../contracts/desktop-platform.cjs';
import { errorMessage, type DesktopLifecycleSnapshot } from '../../../contracts/desktop.cjs';
export type DeviceLifecycle = Serial & {
  status(): DesktopLifecycleSnapshot;
  subscribe(listener: (snapshot: DesktopLifecycleSnapshot) => void): () => void;
  retryRecovery(): Promise<void>;
};
interface LifecycleOptions {
  app: Pick<App, 'on' | 'quit'>;
  profile: string;
  record: RecordEvent;
  beforeShutdown?: () => unknown | Promise<unknown>;
  recoverSessions?: () => Promise<unknown>;
}
import * as devicesModule from '../../../backend/src/devices.cjs';
import * as softwareProfilesModule from '../../../backend/src/software-profiles.cjs';
import * as profileReaderModule from '../../../backend/src/profile-reader.cjs';
import fs from 'node:fs';
import path from 'node:path';
import { restoreAnalogueKeys } from './analogue.cjs';
import { restoreAnalogueLighting } from './analogue-feedback.cjs';
/** Drain complete transactions before shutdown, then restore any interrupted sessions. */
export async function createDeviceLifecycle({
  app,
  profile,
  record,
  beforeShutdown,
  recoverSessions,
}: LifecycleOptions): Promise<DeviceLifecycle> {
  let tail = Promise.resolve(),
    closing = false,
    released = false;
  const backend = devicesModule;
  let pendingTransactions = 0;
  let recovery: DesktopLifecycleSnapshot['recovery'] = {
    status: 'complete',
    reason: null,
    error: null,
  };
  const listeners = new Set<(snapshot: DesktopLifecycleSnapshot) => void>();
  const status = (): DesktopLifecycleSnapshot => ({
    phase: released ? 'closed' : closing ? 'closing' : 'ready',
    pendingTransactions,
    recovery: { ...recovery },
  });
  const notify = (): void => {
    const snapshot = status();
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        record('lifecycle-observer-error', errorMessage(error));
      }
    }
  };
  const serial: Serial = <T,>(fn: () => T | PromiseLike<T>): Promise<T> => {
    if (closing) return Promise.reject(Error('Application is closing'));
    pendingTransactions++;
    notify();
    const result = tail.then(fn).finally(() => {
      pendingTransactions--;
      notify();
    });
    tail = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  const recover =
    recoverSessions ||
    (async () => {
      await restoreAnalogueKeys(profile);
      await restoreAnalogueLighting(profile);
      await softwareProfilesModule.release(profile);
      await profileReaderModule.recover(profile, backend);
    });
  const runRecovery = async (reason: string): Promise<void> => {
    recovery = { status: 'running', reason, error: null };
    notify();
    try {
      await recover();
      recovery = { status: 'complete', reason, error: null };
    } catch (error) {
      recovery = { status: 'failed', reason, error: errorMessage(error) };
      throw error;
    } finally {
      notify();
    }
  };
  if (
    fs.existsSync(path.join(profile, 'analogue-session.json')) ||
    fs.existsSync(path.join(profile, 'analogue-runtime-session.json')) ||
    fs.existsSync(path.join(profile, 'analogue-lighting-session.json')) ||
    fs.existsSync(path.join(profile, 'hardware-read-session.json')) ||
    fs.existsSync(path.join(profile, 'software-session.json'))
  ) {
    try {
      await runRecovery('Restore an interrupted keyboard session');
    } catch (error) {
      record('recovery-required', errorMessage(error));
      // Open the UI with writes blocked so reconnect/recovery remains possible.
    }
  }
  app.on('before-quit', (event) => {
    if (released) return;
    event.preventDefault();
    if (closing) return;
    closing = true;
    recovery = {
      status: 'waiting',
      reason: 'Finish pending keyboard operations before restoring sessions',
      error: null,
    };
    notify();
    tail
      .then(async () => {
        await beforeShutdown?.();
        await runRecovery('Restore keyboard sessions before closing');
      })
      .catch((error) => {
        if (recovery.status !== 'failed')
          recovery = {
            status: 'failed',
            reason: 'Keyboard shutdown cleanup failed',
            error: errorMessage(error),
          };
        record('device-recovery-pending', errorMessage(error));
        notify();
      })
      .finally(() => {
        released = true;
        notify();
        app.quit();
      });
  });
  return Object.assign(serial, {
    retryRecovery: () => serial(async () => { if (recovery.status === 'failed') await runRecovery('Retry keyboard session recovery'); }),
    status,
    subscribe(listener: (snapshot: DesktopLifecycleSnapshot) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
}
