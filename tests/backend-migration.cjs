const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'dist/backend');
const load = (name) => require(path.join(directory, name + '.cjs'));
const crypto = require('node:crypto');
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'backend-golden.json'), 'utf8'));
const after = load('lighting');
let lightingCases = 0;
for (const entry of golden.lighting) {
  const zone = {
    id: 'differential',
    ...(entry.layer === 'Ring' ? { leds: [0, 1] } : { keys: [26, 22] }),
    effectSettings: entry.effect,
  };
  const actual = after.encodeZones([zone], entry.layer);
  assert.equal(actual, entry.wire, 'lighting wire bytes ' + entry.effect.kind);
  const raw = {
    status: 'ok',
    firmware: '2.2.14',
    readOnly: true,
    settingsWritePerformed: false,
    activeProfileIndex: 0,
    profiles: Array.from({ length: 5 }, (_, wireIndex) => ({
      wireIndex,
      layers: ['Base', 'Ring', 'Reactive'].map((kind, i) => ({
        kind,
        command: [0x31, 0x34, 0x38][i],
        status: wireIndex === 0 && kind === entry.layer && actual ? 1 : 2,
        data: wireIndex === 0 && kind === entry.layer ? actual : '',
      })),
    })),
  };
  const decoded = after.decode(raw);
  delete decoded.sampledAt;
  assert.equal(hash(decoded), entry.decodedHash);
  lightingCases++;
}
const remaps = load('remaps');
let remapCases = 0;
for (const entry of golden.remaps) {
  const wire = remaps.encode(entry.input, 26);
  assert.equal(wire, entry.wire);
  assert.deepEqual(remaps.decode(wire, 26), entry.decoded);
  remapCases++;
}
const native = load('native-replies');
const metadata = {
  status: 'ok',
  firmware: '2.2.14',
  readOnly: true,
  settingsWritePerformed: false,
  devicePath: 'fixture',
};
assert.throws(() =>
  native.nativeReply('--current', { ...metadata, firmware: 'unexpected', keys: [] }),
);
const current = {
  ...metadata,
  keys: Array.from({ length: 96 }, (_, sensorId) => ({ sensorId, adc: 100 })),
};
assert.equal(native.nativeReply('--current', current), current);
assert.throws(() =>
  native.nativeReply('--current', { ...current, keys: current.keys.slice(0, 88) }),
);
for (const activeProfileIndex of [0, 4]) {
  const snap = {
    ...metadata,
    activeProfileIndex,
    profiles: Array.from({ length: activeProfileIndex === 4 ? 5 : 4 }, (_, wireIndex) => ({
      wireIndex,
      response: '01' + (wireIndex === 4 ? 'ff' : '0' + wireIndex) + '03' + '00'.repeat(15),
    })),
  };
  assert.equal(native.nativeReply('--snap', snap), snap);
}
for (const mode of [
  '--apply-field',
  '--apply-actuation',
  '--apply-lighting',
  '--apply-remap',
  '--apply-snap',
  '--apply-software-actuation',
]) {
  assert.throws(() => native.nativeReply(mode, { outcome: 'applied', after: { invalid: true } }));
  assert.throws(() => native.nativeReply(mode, { outcome: 'made-up' }));
  assert.equal(
    native.nativeReply(mode, { outcome: 'uncertain', error: 'fixture' }).outcome,
    'uncertain',
  );
}
const functionKey = Number(
  Object.values(
    JSON.parse(fs.readFileSync(path.join(root, 'resources/keyboard/key-layout.json'), 'utf8'))
      .sensors,
  ).find((key) => key.physicalKeyId > 65535).physicalKeyId,
);
assert.equal(functionKey, 4278190318);
const functionReply = {
  ...metadata,
  wireIndex: 0,
  activeProfileIndex: 0,
  records: [0, 1].flatMap((level) =>
    [false, true].map((fnLayer) => ({
      physicalKey: functionKey,
      canonicalKey: 47,
      status: 1,
      level,
      fnLayer,
      data: '',
    })),
  ),
};
assert.equal(native.nativeReply('--remaps', functionReply), functionReply);
for (const invalid of [
  { physicalKey: 0x100000000 },
  { physicalKey: -1 },
  { canonicalKey: 256 },
  { status: 0 },
  { level: 2 },
  { fnLayer: 'true' },
  { data: 'zz' },
])
  assert.throws(() =>
    native.nativeReply('--remaps', {
      ...functionReply,
      records: [{ ...functionReply.records[0], ...invalid }],
    }),
  );
const rawActuation = JSON.parse(
  fs.readFileSync(path.join(root, 'resources/keyboard/actuation-read.json'), 'utf8'),
);
const actualLayout = JSON.parse(
  fs.readFileSync(path.join(root, 'resources/keyboard/key-layout.json'), 'utf8'),
);
const capability = JSON.parse(
  fs.readFileSync(path.join(root, 'resources/keyboard/offline-device.json'), 'utf8'),
).device.capabilityData.keyRemap.validActuationTypes;
const levels = capability.find((value) => value.kind === 'Single').validLevels,
  sensitivities = capability.find((value) => value.kind === 'Rapid').validSensitivity;
const actualActuation = {
  ...metadata,
  activeProfileIndex: rawActuation.activeProfileIndex,
  actuations: Object.entries(actualLayout.sensors).map(([sensorId, key]) => {
    const rawWord = rawActuation.records.find(
        (record) => record.sensorId === Number(sensorId),
      ).word,
      levelIndex = (rawWord >>> 8) & 63,
      secondLevelIndex = (rawWord >>> 16) & 63,
      rapidSensitivityIndex = (rawWord >>> 24) & 63;
    const mode = rawWord & 3;
    const config =
      mode === 1
        ? { kind: 'Dual', level1: levels[levelIndex], level2: levels[secondLevelIndex] }
        : mode === 2
          ? {
              kind: 'Rapid',
              level: levels[levelIndex],
              sensitivity: sensitivities[rapidSensitivityIndex],
            }
          : { kind: 'Single', level: levels[levelIndex] };
    return {
      physicalKey: key.physicalKeyId,
      label: key.label,
      sensorId: Number(sensorId),
      rawWord,
      levelIndex,
      secondLevelIndex,
      rapidSensitivityIndex,
      config,
    };
  }),
};
assert.equal(actualActuation.actuations.length, 88);
assert.ok(actualActuation.actuations.some((key) => key.physicalKey === functionKey));
assert.equal(native.nativeReply('--actuation', actualActuation), actualActuation);
const report = {
  status: 'passed',
  hardwareWrites: false,
  strictTypeScript: true,
  lightingCases,
  remapCases,
  nativeReplyBoundaryChecks: 35,
  sourceModules: fs
    .readdirSync(path.join(root, 'packages/backend/src'))
    .filter((f) => f.endsWith('.cts')).length,
};
fs.writeFileSync(
  path.join(root, 'reports/backend-migration.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report));
