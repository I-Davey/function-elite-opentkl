import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const workspace = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
fs.mkdirSync(path.join(workspace, 'reports'), { recursive: true });
fs.mkdirSync(path.join(workspace, '.build'), { recursive: true });
const command = process.argv[2];
const node = (file, args = []) => {
  const result = spawnSync(process.execPath, [path.join(workspace, file), ...args], {
    cwd: workspace,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
const lint = () => {
  node('scripts/audit-source-types.mjs');
  node('node_modules/eslint/bin/eslint.js', [
    'eslint.config.mjs', 'scripts', 'tests', 'packages/renderer/checks',
  ]);
};
if (command === 'lint') {
  lint();
} else if (command === 'build') {
  node('node_modules/typescript/bin/tsc');
  node('scripts/build-native.mjs');
  const controller = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(workspace, 'scripts/build-controller.ps1')], { cwd: workspace, stdio: 'inherit', windowsHide: true });
  if (controller.error) throw controller.error;
  if (controller.status !== 0) process.exit(controller.status || 1);
  node('packages/backend/build.mjs');
  node('packages/desktop/build.mjs', ['--emit']);
  node('packages/ui-platform/build.mjs');
  node('node_modules/typescript/bin/tsc', ['-p', 'tsconfig.state.json']);
  node('node_modules/typescript/bin/tsc', ['-p', 'packages/renderer-state/tsconfig.json']);
  node('node_modules/typescript/bin/tsc', ['-p', 'tsconfig.sensor.json']);
  node('node_modules/typescript/bin/tsc', ['-p', 'tsconfig.renderer.json']);
  node('node_modules/typescript/bin/tsc', ['-p', 'tsconfig.verification.json']);
  node('scripts/build-renderer.mjs');
  node('scripts/renderer-notices.mjs');
} else if (command === 'check') {
  fs.writeFileSync(
    path.join(workspace, 'reports/offline-checks.json'),
    JSON.stringify({ status: 'running', at: new Date().toISOString() }),
  );
  node('node_modules/typescript/bin/tsc', ['--noEmit']);
  node('scripts/build-native.mjs', ['--check']);
  node('packages/backend/build.mjs', ['--check']);
  node('packages/desktop/build.mjs', ['--check']);
  node('packages/ui-platform/build.mjs', ['--check']);
  node('node_modules/typescript/bin/tsc', ['-p', 'tsconfig.state.json', '--noEmit']);
  node('node_modules/typescript/bin/tsc', [
    '-p',
    'packages/renderer-state/tsconfig.json',
    '--noEmit',
  ]);
  node('node_modules/typescript/bin/tsc', ['-p', 'tsconfig.sensor.json', '--noEmit']);
  node('node_modules/typescript/bin/tsc', ['-p', 'tsconfig.renderer.json', '--noEmit']);
  node('node_modules/typescript/bin/tsc', ['-p', 'tsconfig.verification.json', '--noEmit']);
  lint();
  node('tests/backend-migration.cjs');
  node('tests/backend-sensor-monitor.cjs');
  node('tests/backend-ui-platform.cjs');
  node('tests/settings-regressions.cjs');
  node('tests/run.cjs');
  fs.writeFileSync(
    path.join(workspace, 'reports/offline-checks.json'),
    JSON.stringify(
      {
        status: 'passed',
        at: new Date().toISOString(),
        strictTypes: JSON.parse(
          fs.readFileSync(path.join(workspace, 'reports/type-coverage.json'), 'utf8'),
        ),
        unit: JSON.parse(fs.readFileSync(path.join(workspace, 'reports/unit-tests.json'), 'utf8')),
        codecReport: 'reports/backend-migration.json',
        sensorReport: 'reports/sensor-source-migration.json',
        platformReport: 'reports/ui-platform.json',
        hardwareWrites: false,
      },
      null,
      2,
    ),
  );
} else if (command === 'package') {
  node('scripts/package-app.mjs');
} else
  throw Error(
    'Use: node scripts/workspace.mjs build | check | lint | package. Hardware checks are separate explicit commands.',
  );
