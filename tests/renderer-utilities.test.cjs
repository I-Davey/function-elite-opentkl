const { before, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
let inspect, adjust;

before(async () => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, '.build/renderer-utilities-test.mjs');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await require('esbuild').build({
    stdin: {
      contents:
        "export * from './packages/keyboard-ui/src/logic/key-brightness.ts';",
      resolveDir: root,
      loader: 'tsx',
    },
    ...(await import('../scripts/renderer-compiler-options.mjs')).rendererJsxOptions,
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['react', 'react/jsx-runtime'],
    logLevel: 'silent',
  });
  ({ inspect, adjust } = await import(
    pathToFileURL(output)
  ));
});

test('typed selected-key dimming matches the previous algorithm while preserving untouched keys and inputs', () => {
  const context = { module: { exports: {} } };
  const oldFile = path.resolve(__dirname, 'regression-fixtures/key-brightness.cjs');
  vm.runInNewContext(fs.readFileSync(oldFile, 'utf8'), context);
  const legacy = context.module.exports;
  const zones = [
    {
      id: 'shared',
      keys: [1, 2, 3],
      effectSettings: { kind: 'Static', color: { kind: 'Fixed', r: 200, g: 100, b: 25 } },
    },
    {
      id: 'gradient',
      keys: [4, 5],
      effectSettings: {
        kind: 'ColorShift',
        color: {
          kind: 'Custom',
          gradient: [
            { color: '#ff8000', position: 0 },
            { color: '#0080ff', position: 1 },
          ],
        },
      },
    },
  ];
  const before = JSON.stringify(zones);
  for (const selected of [[1], [2, 3], [4], [1, 4], [1, 2, 3, 4, 5]]) {
    assert.equal(inspect(zones, selected), legacy.inspect(zones, selected));
    for (const level of [0, 0.1, 0.5, 1]) {
      const expected = JSON.parse(JSON.stringify(legacy.adjust(zones, selected, level)));
      const actual = adjust(zones, selected, level);
      assert.deepEqual(actual, expected);
      assert.ok(Math.abs(inspect(actual, selected) - level) <= 1 / 255);
    }
  }
  assert.equal(JSON.stringify(zones), before);
  const dimmed = adjust(zones, [1], 0.5);
  assert.deepEqual(
    dimmed.find((zone) => zone.keys.includes(2)).effectSettings,
    zones[0].effectSettings,
  );
});

test('brightness refuses black brightening, unsupported palettes and excess groups without mutating inputs', () => {
  const black = [
    { id: 'black', keys: [1], effectSettings: { kind: 'Static', color: { r: 0, g: 0, b: 0 } } },
  ];
  assert.throws(() => adjust(black, [1], 0.5), /Choose a color/);
  assert.throws(
    () => inspect([{ keys: [1], effectSettings: { kind: 'Rainbow' } }], [1]),
    /solid color or custom/,
  );
  const zones = [
    {
      id: 'shared',
      keys: [1, 2],
      effectSettings: { kind: 'Static', color: { r: 255, g: 0, b: 0 } },
    },
  ];
  assert.throws(() => adjust(zones, [1], 0.5, 1), /Too many lighting groups/);
  assert.deepEqual(zones[0].keys, [1, 2]);
  assert.throws(() => adjust(zones, [1], -1), /Invalid brightness/);
  assert.throws(() => inspect(zones, [88]), /Select keys/);
});

