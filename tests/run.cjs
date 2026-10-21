const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const files = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith('.test.cjs'))
  .map((file) => path.join(__dirname, file));
const started = new Date().toISOString();
const result = spawnSync(process.execPath, ['--test', ...files], {
  encoding: 'utf8',
  windowsHide: true,
});
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
const summary = (label) =>
  Number(result.stdout?.match(new RegExp('(?:ℹ |# )' + label + ' (\\d+)'))?.[1] ?? 0);
fs.mkdirSync(path.join(__dirname, '../reports'), { recursive: true });
fs.writeFileSync(
  path.join(__dirname, '../reports/unit-tests.json'),
  JSON.stringify(
    {
      at: started,
      status: result.status === 0 ? 'passed' : 'failed',
      testFiles: files.map((file) => path.basename(file)),
      tests: summary('tests'),
      passed: summary('pass'),
      failed: summary('fail'),
      hardwareWrites: false,
    },
    null,
    2,
  ),
);
process.exit(result.status ?? 1);
