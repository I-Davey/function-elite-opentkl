import { registrar } from '../../../contracts/desktop-channels.cjs';
import * as childProcess from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type {
  App,
  Window,
  IpcRegistrar,
  RecordEvent,
} from '../../../contracts/desktop-platform.cjs';
import { object, macroEvent, errorMessage } from '../../../contracts/desktop.cjs';
interface RecorderOptions {
  app: Pick<App, 'on'>;
  win: Window;
  ipcMain: IpcRegistrar;
  record: RecordEvent;
}
import * as devicesModule from '../../../backend/src/devices.cjs';
('use strict');
/** Recording is installed only by an explicit renderer action and cleaned up on exit. */
export function registerMacroRecorder({ app, win, ipcMain, record }: RecorderOptions): void {
  const handle = registrar(ipcMain);
  let macroRecorder: ChildProcessWithoutNullStreams | null = null;
  const stopRecording = () => {
    if (macroRecorder) {
      macroRecorder.stdin.end('quit\n');
      const process = macroRecorder;
      macroRecorder = null;
      const deadline = setTimeout(() => process.kill(), 1500);
      process.once('exit', () => clearTimeout(deadline));
    }
  };
  app.on('will-quit', stopRecording);
  win.on('closed', stopRecording);
  handle('keyboard:record-macro-start', () => {
    if (macroRecorder) throw Error('Macro recording already active');
    const { spawn } = childProcess;
    const backend = devicesModule;
    const child = spawn(backend.executable(), ['--record-macro'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    macroRecorder = child;
    const held = new Set<number>();
    child.stdout.setEncoding('utf8');
    child.stdin.on('error', (error) => record('macro-recorder-error', error.message));
    return new Promise<boolean>((resolve, reject) => {
      let buffer = '',
        ready = false;
      const deadline = setTimeout(() => {
        stopRecording();
        reject(Error('Macro recorder startup timed out'));
      }, 3000);
      child.stdout.on('data', (chunk: string) => {
        buffer += chunk;
        if (Buffer.byteLength(buffer) > 65536) {
          stopRecording();
          reject(Error('Macro recorder response exceeded limit'));
          return;
        }
        let end: number;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          try {
            const parsed = object(JSON.parse(line), 'recorder message');
            if (parsed.status === 'recording' && parsed.nativeLanguage === 'Rust') {
              ready = true;
              clearTimeout(deadline);
              resolve(true);
              continue;
            }
            if (!ready) continue;
            const value = macroEvent(parsed);
            if (value.state === 'Pressed') {
              if (held.has(value.hidKey)) continue;
              held.add(value.hidKey);
            } else held.delete(value.hidKey);
            if (!win.isDestroyed()) win.webContents.send('keyboard:macro-event', value);
          } catch (error) {
            record('macro-recorder-error', errorMessage(error));
          }
        }
      });
      child.once('error', (error) => {
        clearTimeout(deadline);
        reject(error);
      });
      child.once('exit', () => {
        clearTimeout(deadline);
        if (macroRecorder === child) macroRecorder = null;
        if (!ready) reject(Error('Macro recorder exited before startup'));
        if (!win.isDestroyed()) win.webContents.send('keyboard:macro-event', null);
      });
    });
  });
  handle('keyboard:record-macro-stop', () => {
    stopRecording();
    return true;
  });
}
