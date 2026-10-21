const assert = require('node:assert/strict'),
  path = require('node:path'),
  fs = require('node:fs');
const root = path.resolve(__dirname, '..'),
  folder = path.join(root, 'dist/platform'),
  load = (name) => require(path.join(folder, name + '.cjs'));
(async () => {
  const logger = load('logger'),
    logs = [];
  logger.configureLogger((event) => logs.push(event));
  logger.scope('fixture').info('message', 17);
  logger.error('x'.repeat(4000));
  assert.deepEqual(logs[0], { kind: 'log.info', detail: 'message 17' });
  assert.equal(logs[1].detail.length, 3000);
  logger.configureLogger(null);
  logger.warn('ignored');
  assert.equal(logs.length, 2);
  const { i18n } = load('i18n');
  await i18n.init({
    initImmediate: false,
    lng: 'en',
    fallbackLng: false,
    resources: { en: { translation: { fixture: 'Key {{key}}' } } },
  });
  assert.equal(i18n.t('fixture', { key: 'S' }), 'Key S');
  assert.equal(load('i18n').i18n, i18n);
  const diagnostics = load('brightness-diagnostics');
  assert.equal(diagnostics.getKeyBrightnessControl(), null);
  let applied = 0;
  diagnostics.recordKeyBrightnessControl({
    apply: (level) => (applied = level),
    selected: true,
    keys: [26],
    layer: 'Base',
  });
  const control = diagnostics.getKeyBrightnessControl();
  control.apply(0.5);
  assert.equal(applied, 0.5);
  control.keys.push(22);
  assert.deepEqual(diagnostics.getKeyBrightnessControl().keys, [26]);
  const source = fs
    .readdirSync(path.join(root, 'packages/ui-platform/src'))
    .filter((file) => file.endsWith('.cts'))
    .map((file) => fs.readFileSync(path.join(root, 'packages/ui-platform/src', file), 'utf8'))
    .join('\n');
  assert.ok(!source.includes('globalThis.keyboardHost'));
  assert.ok(!source.includes('__preview'));
  const retained = ['brightness-diagnostics', 'i18n', 'logger'];
  assert.deepEqual(fs.readdirSync(path.join(root, 'packages/ui-platform/src'))
    .filter((file) => file.endsWith('.cts')).map((file) => file.slice(0, -4)).sort(), retained);
  assert.deepEqual(fs.readdirSync(folder)
    .filter((file) => file.endsWith('.cjs')).map((file) => file.slice(0, -4)).sort(), retained);
  const report = {
    status: 'passed',
    modules: fs
      .readdirSync(path.join(root, 'packages/ui-platform/src'))
      .filter((file) => file.endsWith('.cts')).length,
    hardwareWrites: false,
    checks: [
      'injected bounded diagnostics',
      'one configured translation instance',
      'scoped brightness observation',
      'only the three retained platform modules and their generated outputs remain',
    ],
  };
  fs.writeFileSync(
    path.join(root, 'reports/ui-platform.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
