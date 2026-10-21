import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { buildRendererChecks } from './build-renderer-checks.mjs';
const workspace = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
if (process.argv.includes('--bridge')) throw Error('The Windows bridge has been removed; no bridge checks are available.');
const source = process.argv.includes('--source');
const report = source ? { output: path.join(workspace, 'dist'), files: [] } : JSON.parse(
  fs.readFileSync(path.join(workspace, 'dist/package-report.json'), 'utf8'),
);
for (const entry of report.files) {
  const file = path.resolve(report.output, entry.file);
  if (!file.startsWith(path.resolve(report.output) + path.sep)) throw Error('Invalid package path');
  if (crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== entry.sha256)
    throw Error('Package changed: ' + entry.file);
}
if (!fs.readFileSync(path.join(report.output, 'app/main.cjs'), 'utf8')
  .includes('NZXT_HE_VERIFICATION_TOKEN'))
  throw Error('This host predates external verification. Build the current desktop host before verification.');
const root = path.join(workspace, source ? '.build/ui-verification' : '.build/release-verification');
const profile = path.join(root, 'test-profile');
fs.mkdirSync(profile, { recursive: true });
const testFile = path.join(profile, 'test-report.json');
if (fs.existsSync(testFile)) fs.renameSync(testFile, testFile + '.previous');
const checks = await buildRendererChecks();
// Local-resource policy already permits this isolated profile; no extra file roots are needed.
const checksFile = path.join(profile, 'checks-' + checks.sha256 + '.mjs');
fs.copyFileSync(checks.file, checksFile);
const verificationToken = crypto.randomUUID();
const env = {
  ...process.env,
  NZXT_HE_DATA_DIR: root,
  NZXT_HE_CHECKS_BUNDLE: checksFile,
  NZXT_HE_VERIFICATION_TOKEN: verificationToken,
  APPDATA: path.join(profile, 'appdata'),
  LOCALAPPDATA: path.join(profile, 'localappdata'),
  TEMP: path.join(profile, 'temp'),
  TMP: path.join(profile, 'temp'),
};
for (const folder of [env.APPDATA, env.LOCALAPPDATA, env.TEMP])
  fs.mkdirSync(folder, { recursive: true });
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
const live = process.argv.includes('--live');
const analogue = process.argv.includes('--analogue');
if (analogue && !live) throw Error('Analogue acceptance requires --live');
const start = performance.now();
const child = spawn(
  source ? require('electron') : path.join(report.output, 'runtime/Function Elite OpenTKL.exe'),
  [
    ...(source ? [path.join(report.output, 'app')] : []),
    '--keyboard-test',
    ...(live ? ['--keyboard-live-test'] : []),
    ...(analogue ? ['--keyboard-analogue-test'] : []),
    ...(process.argv.includes('--capture') ? ['--keyboard-capture'] : []),
    '--user-data-dir=' + path.join(profile, 'userData'),
  ],
  { env, windowsHide: true, stdio: 'ignore' },
);
const timeout = setTimeout(() => child.kill(), live ? 125000 : 65000);
await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => (code === 0 ? resolve() : reject(Error('Release exited ' + code))));
}).finally(() => clearTimeout(timeout));
const result = JSON.parse(fs.readFileSync(testFile, 'utf8'));
if (result.verificationToken !== verificationToken)
  throw Error('Verification result did not come from this run of the external check bundle');
const verification = {
  status: result.status,
  at: new Date().toISOString(),
  package: report.output,
  sourceBuild: source,
    analogue,
  verificationBundleSha256: checks.sha256,
  verificationBundlePath: checksFile,
  verificationBundleInputs: checks.inputs,
  rendererSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(report.output, 'app/renderer.js'))).digest('hex'),
  capture: process.argv.includes('--capture') ? path.join(profile, 'monitor-visible.png') : null,
  immutableFiles: report.files.length,
  uiChecks: result.cases.length,
  elapsedMs: performance.now() - start,
  hardwareWrites: live,
  changesRestoredByChecks: live && result.fingerprints?.match === true,
  suite:result.suite,
  fingerprints:result.fingerprints,
  pendingRecovery:result.pendingRecovery,
  softwareActuationEvidence:result.softwareActuationEvidence,
  cases: result.cases,
};
fs.mkdirSync(path.join(workspace, 'reports'), { recursive: true });
fs.writeFileSync(
  path.join(
    workspace,
    source
      ? analogue ? 'reports/analogue-live-verification.json' : live ? 'reports/ui-source-live-verification.json' : 'reports/ui-source-verification.json'
      : live
        ? 'reports/release-live-verification.json'
        : 'reports/release-verification.json',
  ),
  JSON.stringify(verification, null, 2),
);
console.log(
  JSON.stringify({
    status: verification.status,
    immutableFiles: verification.immutableFiles,
    uiChecks: verification.uiChecks,
    elapsedMs: verification.elapsedMs,
    hardwareWrites: live,
    failed: result.cases
      .filter((item) => item.status !== 'passed')
      .map(({ name, error }) => ({ name, error })),
  }),
);
if (result.status !== 'passed') process.exitCode = 1;
