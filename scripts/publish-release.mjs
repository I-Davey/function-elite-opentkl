import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const workspace = process.cwd(),
  candidate = JSON.parse(fs.readFileSync('dist/package-report.json', 'utf8')),
  verification = JSON.parse(fs.readFileSync('reports/release-verification.json', 'utf8'));
const checks = JSON.parse(fs.readFileSync('reports/offline-checks.json', 'utf8'));
if (checks.status !== 'passed') throw Error('Run the offline source checks before publishing');
if (verification.status !== 'passed' || verification.package !== candidate.output)
  throw Error('Verify this exact candidate before publishing');
for (const filename of ['release-live-verification.json']) {
  const acceptance = JSON.parse(fs.readFileSync(path.join(workspace, 'reports', filename), 'utf8'));
  if (acceptance.status !== 'passed' || acceptance.package !== candidate.output)
    throw Error('Verify this exact candidate before publishing: ' + filename);
  if (filename === 'release-live-verification.json' &&
      (acceptance.fingerprints?.match !== true || acceptance.pendingRecovery?.length))
    throw Error('Restore and verify device settings before publishing');
}
for (const item of candidate.files) {
  const file = path.resolve(candidate.output, item.file);
  if (!file.startsWith(path.resolve(candidate.output) + path.sep))
    throw Error('Invalid package path');
  if (crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== item.sha256)
    throw Error('Candidate changed since verification: ' + item.file);
}
const target = path.join(workspace, 'reports/published-release.json'),
  temporary = target + '.next';
if (fs.existsSync(target)) fs.copyFileSync(target, target + '.previous');
fs.writeFileSync(
  temporary,
  JSON.stringify(
    {
      ...candidate,
      status: 'published',
      publishedAt: new Date().toISOString(),
      verification: { offline: verification.uiChecks, report: 'reports/release-verification.json' },
    },
    null,
    2,
  ),
);
fs.renameSync(temporary, target);
console.log(
  JSON.stringify({
    status: 'published',
    output: candidate.output,
    offlineChecks: verification.uiChecks,
  }),
);
