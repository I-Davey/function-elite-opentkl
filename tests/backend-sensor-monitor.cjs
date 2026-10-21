const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  Module = require('node:module');
const root = path.resolve(__dirname, '..'),
  esbuild = require('esbuild'),
  React = require('react'),
  { renderToStaticMarkup } = require('react-dom/server');
const legacy = require('./regression-fixtures/sensor-stats.cjs');
function typed(file, bundle = false) {
  const entry = path.join(root, 'packages/sensor-monitor/src', file);
  const source = bundle
    ? esbuild.buildSync({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'cjs',
        platform: 'node',
        external: ['react'],
        target: 'node24',
      }).outputFiles[0].text
    : esbuild.transformSync(fs.readFileSync(entry, 'utf8'), {
        loader: 'ts',
        format: 'cjs',
        target: 'node24',
      }).code;
  const mod = new Module(entry);
  mod.filename = entry;
  mod.paths = Module._nodeModulePaths(root);
  mod._compile(source, entry);
  return mod.exports;
}
const stats = typed('sensor-stats.ts'),
  layout = JSON.parse(
    fs.readFileSync(path.join(root, 'resources/keyboard/key-layout.json'), 'utf8'),
  ),
  curve = JSON.parse(
    fs.readFileSync(path.join(root, 'resources/keyboard/depth-curve.json'), 'utf8'),
  );
const keys = Object.entries(layout.sensors).map(([sensorId, key], matrixIndex) => ({
  sensorId: Number(sensorId),
  physicalKeyId: key.physicalKeyId,
  label: key.label,
  matrixIndex,
  adc: 1000,
  baseline: 1000,
  pressed: 3000,
  scale: 1000,
  threshold: 1200,
  coefficient: 0,
  millimetresEstimate: 0,
  depthNormalized: 0,
}));
assert.equal(keys.length, 88);
const frame = (i) => ({
  status: 'live',
  firmware: '2.2.14',
  readOnly: true,
  settingsWritePerformed: false,
  keys: keys.map((key, k) => ({
    ...key,
    adc:
      1000 +
      k +
      Math.round(3 * Math.sin(i * 0.37 + k)) +
      (key.physicalKeyId === 46 && i > 150 ? 500 : 0),
  })),
  roundTripMs: 8,
  nativeReadMs: 7,
  sampledAt: 'fixture',
});
const left = new legacy.SensorHistory(),
  right = new stats.SensorHistory();
for (let i = 1; i <= 500; i++) {
  const snapshot = frame(i);
  left.append(snapshot, i * 50);
  right.append(snapshot, i * 50);
}
assert.deepEqual(right.summary(), left.summary());
for (const key of keys) {
  assert.deepEqual(right.key(key.physicalKeyId), left.key(key.physicalKeyId));
  assert.deepEqual(right.series(key.physicalKeyId), left.series(key.physicalKeyId));
}
for (const mm of [0, 0.01, 0.1, 0.59, 0.6, 1, 2, 3, 4, 5])
  assert.equal(
    stats.coefficientAtMillimetres(mm, curve),
    legacy.coefficientAtMillimetres(mm, curve),
  );
const oldCapture = new legacy.NoiseCalibration(0, { targets: [37, 38, 39, 45, 46] }),
  capture = new stats.NoiseCalibration(0, { targets: [37, 38, 39, 45, 46] });
for (let i = 1; i <= 310; i++) {
  assert.equal(capture.append(frame(i), i * 50), oldCapture.append(frame(i), i * 50));
}
const expected = oldCapture.finish(),
  actual = capture.finish();
expected.createdAt = actual.createdAt = 'fixture';
// Noise capture now measures the released offset without introducing input latency.
for (const key of Object.values(expected.keys)) Object.assign(key,{medianSamples:1,tauMs:0,assessment:'noise-measured'});
for (const key of expected.skipped) if(key.reason==='sustained movement')key.reason='movement during capture';
expected.devicePath=undefined;expected.firmware='2.2.14';
assert.deepEqual(actual, expected);
assert.ok(actual.skipped.some((k) => k.physicalKeyId === 46));
const oldFilter = new legacy.SignalFilter(),
  filter = new stats.SignalFilter();
for (let i = 1; i <= 50; i++) {
  const value = frame(i);
  assert.deepEqual(filter.apply(value, actual, i * 20), oldFilter.apply(value, expected, i * 20));
}
for (const key of keys) {
  assert.deepEqual(stats.conditioned(key, actual, curve), legacy.conditioned(key, expected, curve));
  assert.deepEqual(
    stats.conditioned({ ...key, scale: key.scale + 1 }, actual, curve),
    legacy.conditioned({ ...key, scale: key.scale + 1 }, expected, curve),
  );
}
assert.throws(() => new stats.SensorHistory(0));
assert.throws(() => right.append(frame(1), 25000));
assert.throws(() => new stats.NoiseCalibration(0).finish());
let hostCalls = 0;
const { DepthPanel } = typed('depth-panel.tsx', true);
const keyboardView = {
  layout: 'fixture',
  theme: {},
  keyboardInfo: { layout: 'ANSI', region: 'US' },
  Rows: ({ children }) =>
    React.createElement(
      'div',
      null,
      children({ keyItem: { code: 26 }, dataCode: '26', keyIndex: 0 }),
    ),
  Wrapper: ({ children }) => React.createElement('div', null, children),
  Key: () => React.createElement('span', null, 'W'),
};
const html = renderToStaticMarkup(
  React.createElement(DepthPanel, {
    context: {
      host: {
        sensors: async () => {
          hostCalls++;
          return frame(1);
        },
      },
      curve,
      keyboardView,
      diagnostics: {},
      report() {},
      setStatusLabel() {},
    },
  }),
);
for (const marker of [
  'sensor-monitor',
  'performance-keyboard-base',
  'raw-sensor-table',
  'sensor-history',
  'Raw noise zoom',
  'Calibrate all',
  'Release all keys for 15 seconds.',
  'sm-table-scroll',
])
  assert.ok(html.includes(marker), marker);
assert.equal(hostCalls, 0);
const report = {
  status: 'passed',
  hardwareWrites: false,
  sensorKeys: keys.length,
  historyFrames: 500,
  calibrationFrames: 310,
  filterFrames: 50,
  reactServerRender: true,
  globalDependencies: false,
};
fs.writeFileSync(
  path.join(root, 'reports/sensor-source-migration.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report));
