import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = [
  path.join(root, 'node_modules/typescript/bin/tsc'),
  '-p',
  path.join(root, 'tsconfig.backend.json'),
];
if (process.argv.includes('--check')) args.push('--noEmit');
const result = spawnSync(process.execPath, args, {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
});
process.exitCode = result.status ?? 1;
