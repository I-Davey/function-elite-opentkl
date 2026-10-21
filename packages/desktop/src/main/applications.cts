import { execFile, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { promisify } from 'node:util';
import { executable } from '../../../backend/src/devices.cjs';
import type { App, Window } from '../../../contracts/desktop-platform.cjs';
import type { ApplicationSnapshot } from '../../../contracts/desktop-profiles.cjs';
import { object } from '../../../contracts/desktop.cjs';
const run = promisify(execFile);
function parse(text: string): ApplicationSnapshot {
  const value = object(JSON.parse(text));
  if (!Array.isArray(value.running) || value.running.length > 10000) throw Error('Invalid running applications');
  for (const app of [...value.running, ...(value.foreground ? [value.foreground] : [])]) {
    const row = object(app);
    if (typeof row.path !== 'string' || typeof row.name !== 'string' || typeof row.title !== 'string' || !Number.isInteger(row.pid)) throw Error('Invalid application');
  }
  return value as unknown as ApplicationSnapshot;
}
export async function applications(): Promise<ApplicationSnapshot> {
  const { stdout } = await run(executable(), ['--applications'], { windowsHide: true, timeout: 10000, maxBuffer: 8_000_000 });
  const snapshot=parse(stdout);
  if(snapshot.foreground?.path.toLowerCase()===path.resolve(process.execPath).toLowerCase())snapshot.keepProfile=true;
  return snapshot;
}
export function watchApplications(app: App, win: Window) {
  let closing = false;
  let child: ReturnType<typeof spawn> | undefined;
  let retry: NodeJS.Timeout | undefined;
  const send = (snapshot: ApplicationSnapshot) => { if (!win.isDestroyed()) win.webContents.send('keyboard:applications-event', snapshot); };
  const start = () => {
    if (closing) return;
    child = spawn(executable(), ['--watch-applications'], { windowsHide:true, stdio:['ignore','pipe','pipe'] });
    const lines = createInterface({ input: child.stdout! });
    lines.on('line', line => {
      try {
        const snapshot = parse(line);
        // Editing this application keeps the previous game's profile selected.
        if (snapshot.foreground?.path.toLowerCase() === path.resolve(process.execPath).toLowerCase()) snapshot.keepProfile=true;
        send(snapshot);
      } catch { send({ foreground:null, running:[], error:'Application detection unavailable' }); }
    });
    child.on('error', () => send({ foreground:null,running:[],error:'Application detection unavailable' }));
    child.on('exit', () => { lines.close(); if (!closing) retry = setTimeout(start, 2000); });
  };
  start();
  const stop = () => { closing = true; clearTimeout(retry); child?.kill(); };
  app.on('will-quit', stop); win.on('closed', stop);
}
