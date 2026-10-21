const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('publication requires matching UI and native passes with device restoration', () => {
  const directory = fs.mkdtempSync(path.resolve('.build/publish-release-'));
  fs.mkdirSync(path.join(directory, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'reports'));
  const write = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value));
  const run = () => spawnSync(process.execPath, [path.resolve('scripts/publish-release.mjs')], {
    cwd: directory, encoding: 'utf8', windowsHide: true,
  });
  write('dist/package-report.json', { output: directory, files: [] });
  write('reports/offline-checks.json', { status: 'passed' });
  write('reports/release-verification.json', { status: 'passed', package: directory, uiChecks: 13 });
  const native = { status: 'passed', package: directory, fingerprints: { match: true }, pendingRecovery: [] };
  write('reports/release-live-verification.json', { ...native, package: 'previous-build' });
  assert.notEqual(run().status, 0);
  write('reports/release-live-verification.json', { ...native, pendingRecovery: ['unfinished'] });
  assert.notEqual(run().status, 0);
  write('reports/release-live-verification.json', { ...native, fingerprints: { match: false } });
  assert.notEqual(run().status, 0);
  write('reports/release-live-verification.json', native);
  assert(!fs.existsSync(path.join(directory, 'reports/published-release.json')));
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'reports/published-release.json'))).status, 'published');
});
