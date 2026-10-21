import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const installer = require.resolve('electron/install.js');
const environment = { ...process.env };
for (const key of Object.keys(environment)) {
  if (['ELECTRON_SKIP_BINARY_DOWNLOAD', 'ELECTRON_OVERRIDE_DIST_PATH'].includes(key.toUpperCase())) delete environment[key];
}
const result = spawnSync(process.execPath, [installer], { env: environment, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
if (result.status !== 0) throw Error('Electron runtime download failed');
// Check the same entry point used by packaging, not just the download process exit code.
const executable = require('electron');
if (!fs.statSync(executable).isFile()) throw Error('Electron runtime executable is missing');
console.log(JSON.stringify({ electron: require('electron/package.json').version, executable: path.basename(executable), status: 'ready' }));
