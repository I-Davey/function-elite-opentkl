const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
let createApplicationState, createDeviceControls;

before(async () => {
  const esbuild = require('esbuild');
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, '.build/application-state/control-test.mjs');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await esbuild.build({
    stdin: {
      contents:
        "export {createApplicationState} from './packages/application-state/src/index.ts'; export {createDeviceControls} from './packages/renderer-state/src/device-controls.ts';",
      resolveDir: root,
      sourcefile: 'control-test.ts',
      loader: 'ts',
    },
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });
  ({ createApplicationState, createDeviceControls } = await import(pathToFileURL(output)));
});

function snapshot() {
  return {
    id: 'hardware-0',
    slot: 0,
    brightnessKeys: 1,
    brightnessRing: 1,
    pollingRate: 'Hz8000',
    gameMode: false,
    fnLock: false,
    idleMinutes: 0,
    snap: [],
    remaps: [],
    hardware: [],
    software: null,
    actuation: [],
    Base: [],
    Ring: [],
    Reactive: [],
    originatedFromDevice: new Set(),
  };
}

function setup() {
  const calls = [];
  let observe,
    controls,
    activeWireSlot = 0;
  const connection = {
    activeProfileIndex: 0,
    status: 'connected',
    firmware: '2.2.14',
    readOnly: true,
    settingsWritePerformed: false,
    brightnessChannels: [100, 100],
    gameModeEnabled: false,
    fnLockEnabled: false,
  };
  const host = {};
  for (const name of [
    'applySoftwareProfile',
    'applyProfile',
    'applySnap',
    'applyRemap',
    'applyActuation',
    'applyLighting',
    'applyField',
    'restoreProfile',
    'restoreSnap',
    'restoreRemap',
    'restoreActuation',
    'restoreLighting',
    'restoreField',
  ])
    host[name] = async (input) => {
      calls.push([name, input]);
      return { backup: 'device-edits/test-before.json', outcome: 'applied' };
    };
  host.releaseSoftwareProfile = async () => {
    calls.push(['releaseSoftwareProfile']);
    activeWireSlot = 0;
    return { outcome: 'restored' };
  };
  host.connection = async () => connection;
  const state = createApplicationState({
    execute: (input, ticket) => controls.execute(input, ticket),
    coalesceMs: 60_000,
  });
  const attempt = state.beginConnection();
  state.connected({ id: 'test', firmware: '2.2.14' }, attempt);
  state.selectProfile({ kind: 'onboard', wireIndex: 0 });
  const model = {
    observe(callback) {
      observe = callback;
      return () => {
        observe = undefined;
      };
    },
    async syncHardwareProfiles(ownerTicket) {
      const scope = state.beginHydration(ownerTicket);
      try {
        scope.commit(() => calls.push(['hydrate']));
      } finally {
        scope.close();
      }
    },
    syncLiveValues(value) {
      calls.push(['liveValues', value.activeProfileIndex]);
    },
    depthActive: () => false,
    activeWireSlot: () => activeWireSlot,
    didApply(outcome) {
      if (outcome.input.kind === 'software') activeWireSlot = 4;
    },
  };
  controls = createDeviceControls({
    state,
    host,
    model,
    label() {},
    report() {},
    diagnostic() {},
    pollIntervalMs: 60_000,
  });
  return {
    state,
    host,
    model,
    controls,
    calls,
    connection,
    change(next, previous) {
      observe(next, previous);
    },
  };
}

test('user profile selection cancels old profile edits and refreshes under the edit hydration scope', async () => {
  const app = setup();
  try {
    const before = snapshot();
    app.change({ ...before, brightnessKeys: 0.2 }, before);
    app.change({ ...before, id: 'hardware-1', slot: 1 }, before);
    await app.controls.flush();
    assert.deepEqual(
      app.calls.map(([method]) => method),
      ['applyField', 'hydrate'],
    );
    assert.deepEqual(app.calls[0][1], { wireIndex: 1, field: 'activeProfile', value: 1 });
    assert.equal(app.state.getSnapshot().phase, 'ready');
    assert.equal(app.state.getSnapshot().pendingEdits.length, 0);
  } finally {
    app.controls.dispose();
  }
});

test('device-originated brightness and nested hydration changes produce no writes', async () => {
  const app = setup();
  try {
    const before = snapshot();
    app.change(
      { ...before, brightnessKeys: 0.2, originatedFromDevice: new Set(['keyBrightness']) },
      before,
    );
    const hydration = app.state.beginHydration();
    app.change({ ...before, fnLock: true }, before);
    hydration.close();
    await app.controls.flush();
    assert.deepEqual(app.calls, []);
  } finally {
    app.controls.dispose();
  }
});

test('software actuation stays acknowledged and undo releases the software session before refresh', async () => {
  const app = setup();
  try {
    const before = snapshot();
    const profile = { wireIndex: 4, settings: {}, physicalKeys: [], snapConfigs: [] };
    app.change({ ...before, id: 'walking', slot: undefined, software: profile }, before);
    await app.controls.flush();
    assert.equal(app.state.getSnapshot().lastCompletion.evidence, 'acknowledged');
    assert.equal(app.controls.software, true);
    await app.controls.undo();
    assert.deepEqual(
      app.calls.map(([method]) => method),
      ['applySoftwareProfile', 'releaseSoftwareProfile', 'hydrate'],
    );
    assert.equal(app.controls.last, null);
  } finally {
    app.controls.dispose();
  }
});

test('actuation coalescing preserves distinct keys and undo restores batches in reverse order', async () => {
  const app = setup();
  try {
    app.host.applyActuation = async (input) => {
      app.calls.push(['applyActuation', input]);
      return {
        backup: 'all',
        outcome: 'applied',
        batches: [{ backup: 'first' }, { backup: 'second' }],
      };
    };
    const key = (physicalKey, levelIndex) => ({
      physicalKey,
      levelIndex,
      kind: 'Single',
      secondLevelIndex: 0,
      rapidSensitivityIndex: 0,
    });
    app.controls.schedule({ kind: 'actuation', wireIndex: 0, keys: [key(1, 2)] });
    app.controls.schedule({ kind: 'actuation', wireIndex: 0, keys: [key(2, 3)] });
    await app.controls.flush();
    assert.deepEqual(
      app.calls[0][1].keys.map((item) => item.physicalKey),
      [1, 2],
    );
    await app.controls.undo();
    assert.deepEqual(
      app.calls.filter(([method]) => method === 'restoreActuation').map(([, backup]) => backup),
      ['second', 'first'],
    );
  } finally {
    app.controls.dispose();
  }
});

test('a stale connection read cannot clear pending edits or disconnect the replacement device', async () => {
  const app = setup();
  try {
    let reject;
    app.host.connection = () =>
      new Promise((_, no) => {
        reject = no;
      });
    const poll = app.controls.pollNow();
    app.state.disconnect();
    const ticket = app.state.beginConnection();
    app.state.connected({ id: 'replacement' }, ticket);
    app.controls.schedule({ kind: 'field', field: 'brightnessKeys', wireIndex: 0, value: 20 });
    reject(Error('old handle disconnected'));
    await poll;
    assert.equal(app.state.getSnapshot().phase, 'ready');
    assert.equal(app.state.getSnapshot().device.id, 'replacement');
    await app.controls.flush();
    assert.equal(app.calls.filter(([method]) => method === 'applyField').length, 1);
  } finally {
    app.controls.dispose();
  }
});

test('undo receipts from a previous physical connection cannot mutate a replacement keyboard', async () => {
  const app = setup();
  try {
    app.controls.schedule({ kind: 'field', field: 'brightnessKeys', wireIndex: 0, value: 20 });
    await app.controls.flush();
    assert.ok(app.controls.last);
    app.state.disconnect();
    const next = app.state.beginConnection();
    app.state.connected({ id: 'replacement' }, next);
    assert.equal(app.controls.last, null);
    await assert.rejects(app.controls.undo(), /No verified device edit to undo/);
    assert.deepEqual(
      app.calls.map(([method]) => method),
      ['applyField'],
    );
  } finally {
    app.controls.dispose();
  }
});

test('reconnect suspends writes through software release and never mirrors its stale connection snapshot', async () => {
  const app = setup();
  try {
    app.state.disconnect();
    app.connection.activeProfileIndex = 4;
    let finish;
    app.host.releaseSoftwareProfile = () =>
      new Promise((resolve) => {
        finish = () => resolve({ outcome: 'restored' });
      });
    const poll = app.controls.pollNow();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(app.state.getSnapshot().phase, 'hydrating');
    assert.equal(
      app.controls.schedule({ kind: 'field', field: 'brightnessKeys', wireIndex: 0, value: 20 }),
      null,
    );
    finish();
    await poll;
    assert.equal(app.state.getSnapshot().phase, 'ready');
    assert.deepEqual(
      app.calls.map(([method]) => method),
      ['hydrate'],
    );
  } finally {
    app.controls.dispose();
  }
});
