import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const started = performance.now();
const commands = [
  ['packages/desktop/build.mjs', '--emit'],
  [
    '--test',
    'tests/desktop-contracts.test.cjs',
    'tests/desktop-lifecycle.test.cjs',
    'tests/profile-store.test.cjs',
    'tests/shutdown.test.cjs',
  ],
];
const results = commands.map((args) => {
  const result = spawnSync(process.execPath, args, {
    cwd: workspace,
    encoding: 'utf8',
    windowsHide: true,
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  return {
    command: ['node', ...args].join(' '),
    passed: !result.error && result.status === 0,
    exitCode: result.status,
    error: result.error?.message,
  };
});
const report = {
  status: results.every((result) => result.passed) ? 'passed' : 'failed',
  hardwareAccess: false,
  at: new Date().toISOString(),
  durationMs: performance.now() - started,
  results,
};
const folder = path.join(workspace, 'reports');
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(path.join(folder, 'desktop-verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'passed') process.exitCode = 1;
