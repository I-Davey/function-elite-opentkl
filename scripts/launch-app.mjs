import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const application = path.join(root, 'dist/app');
if (!fs.existsSync(path.join(application, 'main.cjs'))) throw Error('Run npm run build before starting the app.');
const dataRoot = path.resolve(process.env.NZXT_HE_DATA_DIR || path.join(root, '..', 'NZXT-HE-Keyboard-Data'));
const profile = path.join(dataRoot, 'profile');
const environment = { ...process.env, NZXT_HE_DATA_DIR: dataRoot };
for (const [variable, directory] of Object.entries({ APPDATA: 'appdata', LOCALAPPDATA: 'localappdata', TEMP: 'temp', TMP: 'temp' })) {
  environment[variable] = path.join(profile, directory);
  fs.mkdirSync(environment[variable], { recursive: true });
}
delete environment.ELECTRON_RUN_AS_NODE;
delete environment.NODE_OPTIONS;
const started = Date.now();
const executable = require('electron');
const log = fs.openSync(path.join(profile, 'runtime.log'), 'a');
const child = spawn(executable, [application, '--user-data-dir=' + path.join(profile, 'userData'),
  ...(process.argv.includes('--analogue') ? ['--keyboard-analogue'] : []),
  ...(process.argv.includes('--profiles') ? ['--keyboard-profiles'] : []),
  ...(process.argv.includes('--capture') ? ['--keyboard-capture'] : [])], {
  env: environment, windowsHide: true, detached: true, stdio: ['ignore', log, log],
});
await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
fs.closeSync(log);
child.unref();
const receipt = path.join(root, 'reports/active-app.json');
let runtime;
while (Date.now() - started < 35000) {
  try {
    const current = JSON.parse(fs.readFileSync(path.join(profile, 'runtime-report.json'), 'utf8'));
    let belongsToLaunch = current.pid === child.pid && Date.parse(current.at) >= started;
    if (!belongsToLaunch && child.exitCode === 0 && fs.existsSync(receipt)) {
      const previous = JSON.parse(fs.readFileSync(receipt, 'utf8'));
      if (previous.pid === current.pid && previous.application === application && previous.executable === executable) {
        process.kill(current.pid, 0);
        belongsToLaunch = true;
      }
    }
    if (belongsToLaunch) {
      runtime = current;
      if (runtime.status === 'failed') throw Error(String(runtime.error));
      if (runtime.status === 'mounted' && runtime.applicationState?.phase === 'ready') break;
    }
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}
if (runtime?.status !== 'mounted') throw Error('The app did not mount; see ' + path.join(profile, 'runtime-report.json'));
const result = { at: new Date().toISOString(), pid: runtime.pid, application, executable, dataRoot,
  connected: !!runtime.applicationState?.device, hardwareSync: runtime.hardwareSync };
fs.mkdirSync(path.dirname(receipt), { recursive: true });
fs.writeFileSync(receipt, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
