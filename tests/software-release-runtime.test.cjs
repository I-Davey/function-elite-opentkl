const { test } = require('node:test');
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, '..'),
  software = require('../dist/backend/software-profiles.cjs');
const ids = Object.values(
  JSON.parse(fs.readFileSync(path.join(root, 'resources/keyboard/key-layout.json'), 'utf8')).sensors,
).map((key) => key.physicalKeyId);
function setup(
  t,
  {
    slot = 4,
    brightness = [100, 100],
    releaseTarget,
    failField = null,
    originalBrightness = [25, 41],
    originalIdle = 0,
  } = {},
) {
  const parent = path.join(root, '.build/software-release-runtime');
  fs.mkdirSync(parent, { recursive: true });
  const profile = fs.mkdtempSync(path.join(parent, 'case-'));
  t.after(() => {
    assert.ok(path.resolve(profile).startsWith(path.resolve(parent) + path.sep));
    fs.rmSync(profile, { recursive: true, force: true });
  });
  let active = slot,
    channels = [...brightness], idle = 0;
  const writes = [];
  const metadata = {
    status: 'ok',
    firmware: '2.2.14',
    readOnly: true,
    settingsWritePerformed: false,
  };
  const state = () => ({
    ...metadata,
    activeProfileIndex: active,
    brightnessChannels: [...channels],
    profiles: Array.from({ length: 5 }, (_, wireIndex) => ({
      wireIndex,
      field0: 0,
      field3: 0,
      field4: 0,
      field5: wireIndex===4 ? idle : 0,
      field7: 0,
    })),
  });
  const lighting = () => ({
    ...metadata,
    activeProfileIndex: active,
    profiles: Array.from({ length: 5 }, (_, wireIndex) => ({
      wireIndex,
      layers: ['Base', 'Ring', 'Reactive'].map((kind, index) => ({
        kind,
        command: [49, 52, 56][index],
        status: 2,
        data: '',
      })),
    })),
  });
  const snap = () => ({
    ...metadata,
    activeProfileIndex: active,
    profiles: Array.from({ length: active === 4 ? 5 : 4 }, (_, wireIndex) => ({
      wireIndex,
      response: '01' + (wireIndex === 4 ? 'ff' : '0' + wireIndex) + '03' + '00'.repeat(15),
    })),
  });
  const remapRecords = (keys) =>
    keys.flatMap((physicalKey) =>
      [0, 1].flatMap((level) =>
        [false, true].map((fnLayer) => ({ physicalKey, level, fnLayer, data: '' })),
      ),
    );
  const journal = path.join(profile, 'software-session.json');
  const before = {
    state: { ...state(), activeProfileIndex: 0, brightnessChannels: originalBrightness },
    lighting: lighting(),
    remaps: { wireIndex: 4, activeProfileIndex: 0, records: remapRecords(ids) },
    snap: {
      ...snap(),
      profiles: Array.from({ length: 5 }, (_, wireIndex) => ({
        wireIndex,
        response: '01' + (wireIndex === 4 ? 'ff' : '0' + wireIndex) + '03' + '00'.repeat(15),
      })),
    },
  };
  before.state.profiles[4].field5=originalIdle;
  fs.writeFileSync(
    journal,
    JSON.stringify({
      schemaVersion: 1,
      kind: 'software-session',
      returnSlot: 0,
      backup: 'device-edits/software-before.json',
      before,
      ...(releaseTarget === undefined ? {} : { releaseTarget }),
    }),
  );
  const backend = {
    state: async () => state(),
    connection: async () => ({
      ...metadata,
      activeProfileIndex: active,
      brightnessChannels: [...channels],
    }),
    lighting: async () => lighting(),
    snap: async () => snap(),
    remaps: async (request) => ({
      wireIndex: request.wireIndex,
      activeProfileIndex: active,
      records: remapRecords(request.physicalKeys),
    }),
    applyField: async (request) => {
      const saved = JSON.parse(fs.readFileSync(journal, 'utf8'));
      assert.ok(saved.releaseTarget, 'Return controls must be durable before commands');
      writes.push(request);
      assert.equal(request.expectedActive, active);
      if (request.field === failField) throw Error('Fixture brightness restore failure');
      if (request.field === 'activeProfile') {
        assert.equal(request.expectedValue, active);
        if (active !== request.value) {
          active = request.value;
          channels = [100, 100];
        }
      } else if (request.field.startsWith('brightness')) {
        const channel = request.field === 'brightnessKeys' ? 0 : 1;
        assert.equal(request.expectedValue, channels[channel]);
        channels[channel] = request.value;
      } else if (request.field==='idleMinutes') {
        assert.equal(active,4,'Software idle time must be restored before leaving slot 4');
        idle=request.value;
      }
      return { outcome: 'applied', after: request.value };
    },
    applyLighting: async () => ({ outcome: 'unchanged' }),
    applySnap: async () => ({ outcome: 'unchanged' }),
  };
  return {
    profile,
    journal,
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
  };
}
test('software release restores25/41 after temporary Snap selection resetsruntimebrightness', async (t) => {
  const f = setup(t);
  const result = await software.release(f.profile, f.backend);
  assert.equal(f.active, 0);
  assert.deepEqual(f.brightness, [25, 41]);
  assert.equal(result.runtimeBrightnessRestored, true);
  assert.equal(fs.existsSync(f.journal), false);
  assert.deepEqual(
    f.writes.filter((write) => write.field === 'activeProfile').map((write) => write.value),
    [0],
  );
});
test('software cleanup restores nonzero idle time while its software slot is active', async t=>{
  const f=setup(t,{slot:2,brightness:[42,17],originalIdle:15});
  await software.release(f.profile,f.backend);
  assert.ok(f.writes.some(w=>w.field==='idleMinutes'&&w.value===15&&w.expectedActive===4));
  assert.equal(f.active,2);assert.deepEqual(f.brightness,[42,17]);assert.equal(fs.existsSync(f.journal),false);
});
test('software release retries reuse the persisted target instead of reset100values', async (t) => {
  const f = setup(t, { failField: 'brightnessRing' });
  await assert.rejects(
    software.release(f.profile, f.backend),
    /Fixture brightness restore failure/,
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(f.journal, 'utf8')).releaseTarget, {
    wireIndex: 0,
    brightnessChannels: [25, 41],
  });
  assert.deepEqual(f.brightness, [25, 100]);
  f.fail(null);
  await software.release(f.profile, f.backend);
  assert.deepEqual(f.brightness, [25, 41]);
  assert.equal(f.active, 0);
  assert.equal(fs.existsSync(f.journal), false);
});
test('software release respects a user-selected other onboard slot and current42/17', async (t) => {
  const f = setup(t, { slot: 2, brightness: [42, 17] });
  await software.release(f.profile, f.backend);
  assert.equal(f.active, 2);
  assert.deepEqual(f.brightness, [42, 17]);
  assert.deepEqual(
    f.writes.filter((write) => write.field === 'activeProfile').map((write) => write.value),
    [4, 2],
  );
});
test('invalid persisted software release targets cause no writes and preserve recovery journal', async (t) => {
  const f = setup(t, { releaseTarget: { wireIndex: 4, brightnessChannels: [25, 41] } });
  await assert.rejects(software.release(f.profile, f.backend), /Invalid software release target/);
  assert.equal(f.writes.length, 0);
  assert.equal(fs.existsSync(f.journal), true);
});

test('software release returns to the most recently selected onboard profile', async t => {
  const f = setup(t);
  const saved = JSON.parse(fs.readFileSync(f.journal, 'utf8'));
  saved.returnTarget = { wireIndex: 2, brightnessChannels: [36, 52] };
  fs.writeFileSync(f.journal, JSON.stringify(saved));
  await software.release(f.profile, f.backend);
  assert.equal(f.active, 2);
  assert.deepEqual(f.brightness, [36, 52]);
});
test('legacy software session without captured brightness never invents replacement controls', async (t) => {
  const f = setup(t, { originalBrightness: null });
  await assert.rejects(software.release(f.profile, f.backend), /Invalid software release target/);
  assert.equal(f.writes.length, 0);
  assert.equal(fs.existsSync(f.journal), true);
});
