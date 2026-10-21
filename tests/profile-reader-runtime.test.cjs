const { test } = require('node:test');
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, '..'),
  reader = require('../dist/backend/profile-reader.cjs');
const layout = JSON.parse(
    fs.readFileSync(path.join(root, 'resources/keyboard/key-layout.json'), 'utf8'),
  ),
  ids = Object.values(layout.sensors).map((key) => key.physicalKeyId);
function setup(t, { reset = true, brightness = [25, 41], slot = 0, failField = null } = {}) {
  const parent = path.join(root, '.build/profile-reader-runtime');
  fs.mkdirSync(parent, { recursive: true });
  const profile = fs.mkdtempSync(path.join(parent, 'case-'));
  t.after(() => {
    assert.ok(path.resolve(profile).startsWith(path.resolve(parent) + path.sep));
    fs.rmSync(profile, { recursive: true, force: true });
  });
  let active = slot,
    channels = [...brightness];
  const writes = [];
  const backend = {
    connection: async () => ({ activeProfileIndex: active, brightnessChannels: [...channels] }),
    state: async () => ({
      status: 'ok',
      firmware: '2.2.14',
      readOnly: true,
      settingsWritePerformed: false,
      activeProfileIndex: active,
      brightnessChannels: [...channels],
      profiles: Array.from({ length: 5 }, (_, wireIndex) => ({
        wireIndex,
        field0: 0,
        field3: 0,
        field4: 0,
        field5: 0,
        field7: 0,
      })),
    }),
    applyField: async (request) => {
      assert.equal(request.expectedActive, active);
      writes.push(request);
      if (request.field === failField) throw Error('Fixture restoration failure');
      if (request.field === 'activeProfile') {
        assert.equal(request.expectedValue, active);
        active = request.value;
        if (reset) channels = [100, 100];
      } else {
        const index = request.field === 'brightnessKeys' ? 0 : 1;
        assert.equal(request.expectedValue, channels[index]);
        channels[index] = request.value;
      }
      return { outcome: 'applied', after: request.value };
    },
    actuation: async () => ({
      activeProfileIndex: active,
      actuations: ids.map((physicalKey) => ({
        physicalKey,
        rawWord: 1536,
        levelIndex: 6,
        config: { kind: 'Single', level: { valueMicroMeters: 600 } },
      })),
    }),
    remaps: async (request) => ({
      wireIndex: request.wireIndex,
      activeProfileIndex: active,
      records: request.physicalKeys.flatMap((physicalKey) =>
        [0, 1].flatMap((level) =>
          [false, true].map((fnLayer) => ({ physicalKey, level, fnLayer, data: '' })),
        ),
      ),
    }),
  };
  return {
    profile,
    backend,
    writes,
    get active() {
      return active;
    },
    get brightness() {
      return [...channels];
    },
    fail(field) {
      failField = field;
    },
    journal: path.join(profile, 'hardware-read-session.json'),
  };
}
test('all-profile reads restore exact runtime brightness after firmware loads100onselection', async (t) => {
  const f = setup(t);
  const result = await reader.read(f.profile, f.backend);
  assert.equal(result.profiles.length, 4);
  assert.ok(
    result.profiles.every(
      (profile) =>
        profile.actuation.actuations.length === 88 && profile.remaps.records.length === 352,
    ),
  );
  assert.equal(f.active, 0);
  assert.deepEqual(f.brightness, [25, 41]);
  assert.deepEqual(
    f.writes
      .filter((write) => write.field.startsWith('brightness'))
      .map((write) => [write.field, write.value]),
    [
      ['brightnessKeys', 25],
      ['brightnessRing', 41],
    ],
  );
  assert.equal(result.runtimeBrightnessRestored, true);
  assert.equal(fs.existsSync(f.journal), false);
});
test('a failed runtime restore retains its exact journal and recovery resumes remainingchannel', async (t) => {
  const f = setup(t, { failField: 'brightnessRing' });
  await assert.rejects(reader.read(f.profile, f.backend), /Fixture restoration failure/);
  assert.equal(fs.existsSync(f.journal), true);
  const saved = JSON.parse(fs.readFileSync(f.journal, 'utf8'));
  assert.deepEqual(saved.brightnessChannels, [25, 41]);
  assert.equal(saved.originalSlot, 0);
  assert.deepEqual(f.brightness, [25, 100]);
  f.fail(null);
  const prior = f.writes.length;
  await reader.recover(f.profile, f.backend);
  assert.deepEqual(f.brightness, [25, 41]);
  assert.deepEqual(
    f.writes.slice(prior).map((write) => write.field),
    ['brightnessRing'],
  );
  assert.equal(fs.existsSync(f.journal), false);
});
test('normal reads with unchanged runtime brightness add no brightnesswrites', async (t) => {
  const f = setup(t, { reset: false, brightness: [0, 73], slot: 2 });
  await reader.read(f.profile, f.backend);
  assert.equal(f.active, 2);
  assert.deepEqual(f.brightness, [0, 73]);
  assert.equal(f.writes.filter((write) => write.field.startsWith('brightness')).length, 0);
  assert.equal(fs.existsSync(f.journal), false);
});
test('old recovery journals without brightness restore onlythecapturedslot', async (t) => {
  const f = setup(t, { slot: 2 });
  fs.writeFileSync(f.journal, JSON.stringify({ kind: 'profile-read', originalSlot: 0 }));
  await reader.recover(f.profile, f.backend);
  assert.equal(f.active, 0);
  assert.deepEqual(
    f.writes.map((write) => write.field),
    ['activeProfile'],
  );
  assert.deepEqual(f.brightness, [100, 100]);
  assert.equal(fs.existsSync(f.journal), false);
});
test('malformedbrightness recovery never writes and retainsjournal', async (t) => {
  const f = setup(t);
  fs.writeFileSync(
    f.journal,
    JSON.stringify({ kind: 'profile-read', originalSlot: 0, brightnessChannels: [-1, 101] }),
  );
  await assert.rejects(
    reader.recover(f.profile, f.backend),
    /Invalid profile read brightness recovery/,
  );
  assert.equal(f.writes.length, 0);
  assert.equal(fs.existsSync(f.journal), true);
});
