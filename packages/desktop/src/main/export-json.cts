import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Electron } from '../../../contracts/desktop-platform.cjs';

/** Export a new file, then reveal it instead of leaving it in hidden application data. */
export function exportJson(name: string, value: unknown): string {
  const { app, shell }: Pick<Electron, 'app' | 'shell'> = require('electron');
  const directory = app.getPath('downloads');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${name}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}.json`);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  shell.showItemInFolder(file);
  return file;
}
