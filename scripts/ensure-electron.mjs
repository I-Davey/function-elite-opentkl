import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { downloadArtifact } from '@electron/get';

const require = createRequire(import.meta.url);
if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('This release builds on Windows x64');
const electronDirectory = path.dirname(require.resolve('electron/package.json'));
const version = require('electron/package.json').version;
const destination = path.join(electronDirectory, 'dist');
const pathFile = path.join(electronDirectory, 'path.txt');
if (!fs.existsSync(pathFile) || !fs.existsSync(path.join(destination, 'electron.exe')) ||
  fs.readFileSync(path.join(destination, 'version'), 'utf8').trim().replace(/^v/, '') !== version) {
  const archive = await downloadArtifact({ version, artifactName: 'electron', platform: 'win32', arch: 'x64',
    checksums: require('electron/checksums.json'),
    cacheRoot: fileURLToPath(new URL('../.build/electron-cache', import.meta.url)),
  });
  fs.mkdirSync(destination, { recursive: true });
  // extract-zip 2 can exit after its first entry on Node 24; use Windows' ZIP reader.
  const result = spawnSync('tar.exe', ['-xf', archive, '-C', destination], { stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error('Electron runtime extraction failed');
  const definitions = path.join(destination, 'electron.d.ts');
  if (fs.existsSync(definitions)) { fs.copyFileSync(definitions, path.join(electronDirectory, 'electron.d.ts')); fs.unlinkSync(definitions); }
  fs.writeFileSync(pathFile, 'electron.exe');
}
// Check the entry point used by packaging, not just the download process exit code.
const executable = require('electron');
if (!fs.statSync(executable).isFile()) throw Error('Electron runtime executable is missing');
console.log(JSON.stringify({ electron: version, executable: path.basename(executable), status: 'ready' }));
