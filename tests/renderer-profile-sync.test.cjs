const { test, before } = require('node:test');
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  Module = require('node:module');
const root = path.resolve(__dirname, '..');
let createProfileSync,
  createApplicationState,
  createDeviceControls,
  captureControlSnapshot,
  keyboardSnapshot,
  models;
function bundle() {
  const output = require('esbuild').buildSync({
    stdin: {
      contents: [
        "export {KeyboardDeviceProfile} from './packages/keyboard-ui/src/models/KeyboardDeviceProfile.ts';",
        "export {KeyRemapDeviceProfile} from './packages/keyboard-ui/src/models/KeyRemapDeviceProfile.ts';",
        "export {HardwareKeyboardProfile} from './packages/keyboard-ui/src/models/KeyboardProfile.ts';",
        "export {RemapMacro} from './packages/keyboard-ui/src/models/RemapMacro.ts';",
        "export {i18n} from './packages/ui-platform/src/i18n.cts';",
        "export {resources} from './packages/keyboard-ui/src/i18n/resources.ts';",
        "export {defaultKeyboardDevice} from './packages/keyboard-ui/src/data/device.ts';",
        "export {createProfileSync} from './packages/renderer/src/profile-sync.ts';",
        "export {captureControlSnapshot} from './packages/renderer/src/control-model-adapter.ts';",
        "export {keyboardSnapshot} from './packages/renderer/src/profile-storage.ts';",
        "export {createApplicationState} from './packages/application-state/src/index.ts';",
        "export {createDeviceControls} from './packages/renderer-state/src/device-controls.ts';",
      ].join('\n'),
      resolveDir: root,
      loader: 'ts',
      sourcefile: 'renderer-test.ts',
    },
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    packages: 'external',
    target: 'node24',
  }).outputFiles[0].text;
  const mod = new Module(__filename);
  mod.filename = __filename;
  mod.paths = Module._nodeModulePaths(root);
  mod._compile(output, __filename);
  return mod.exports;
}
before(async () => {
  ({
    createProfileSync,
    createApplicationState,
    createDeviceControls,
    captureControlSnapshot,
    keyboardSnapshot,
  } = models = bundle());
  await models.i18n.init({ lng: 'en', resources: models.resources, defaultNS: 'common', keySeparator: ':' });
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const layout = JSON.parse(
  fs.readFileSync(path.join(root, 'resources/keyboard/key-layout.json'), 'utf8'),
);
const ids = Object.values(layout.sensors).map((key) => key.physicalKeyId);
function setup(slot = 2) {
  const calls = [],
    labels = [],
    workspace = new Map();
  globalThis.document = {
    getElementById: () => ({
      setAttribute: (key, value) => workspace.set(key, value),
      removeAttribute: (key) => workspace.delete(key),
    }),
  };
  globalThis.window = { location: { search: '' } };
  let controls, context, notifications = 0;
  const state = createApplicationState({
    coalesceMs: 60000,
    execute: (input, ticket) => controls.execute(input, ticket),
  });
  const attempt = state.beginConnection();
  state.connected({ id: 'fixture', firmware: '2.2.14' }, attempt);
  state.selectProfile({ kind: 'onboard', wireIndex: 0 });
  const { KeyboardDeviceProfile, KeyRemapDeviceProfile, HardwareKeyboardProfile,
    defaultKeyboardDevice } = models;
  const device = { ...defaultKeyboardDevice, uniqueId: 'fixture' };
  const profileLinks = {};
  const env = { keyboardDevice: device, profileLinks };
  const identity = { deviceUniqueId: device.uniqueId, deviceType: device.deviceType };
  const keyboard = KeyboardDeviceProfile.create({ ...identity, softwareProfiles: [] }, env);
  keyboard.addHardwareProfiles([HardwareKeyboardProfile.create({
    id: 'hardware-0', hardwareProfileId: 0,
    settings: { pollingRate: 'Hz8000', idleTimeout: { disabled: true, timeoutSeconds: 0 } },
  })]);
  const remap = KeyRemapDeviceProfile.create({ ...identity,
    activeProfileId: { kind: 'Hardware', id: 0 } }, env);
  profileLinks.remap = remap;
  remap.attachDevice(device);
  keyboard.setActiveProfileId('hardware-0', { fromDevice: true });
  keyboard.setKeyBrightness(1, { fromDevice: true });
  keyboard.setPerimeterBrightness(1, { fromDevice: true });
  const nativeConfigs = () =>
    ids.map((key) => ({
      key,
      active: {
        kind: 'Single',
        level: { valueMicroMeters: 600 },
        remap: {
          nonePressed: { kind: 'SimpleRemap', targetKeyId: key },
          fnPressed: { kind: 'SimpleRemap', targetKeyId: key },
        },
      },
    }));
  const actuation = {
    activeProfileIndex: slot,
    actuations: ids.map((physicalKey, index) => ({
      physicalKey,
      rawWord: 12 << 8,
      levelIndex: 12,
      secondLevelIndex: 0,
      rapidSensitivityIndex: 3,
      config: { kind: index === 0 ? 'Rapid' : 'Single' },
    })),
  };
  const nativeRemaps = {
    activeProfileIndex: slot,
    wireIndex: slot,
    configs: nativeConfigs(),
    records: ids.flatMap((physicalKey) =>
      [0, 1].flatMap((level) =>
        [false, true].map((fnLayer) => ({ physicalKey, level, fnLayer, data: '' })),
      ),
    ),
  };
  const zones = (wireIndex) => [
    {
      id: 'base-' + wireIndex,
      keys: [26],
      effectSettings: { layer: 'Base', kind: 'Color', color: { r: wireIndex, g: 0, b: 0 } },
    },
  ];
  const snapshot = {
    firmware: '2.2.14',
    activeProfile: { wireIndex: slot },
    brightnessKeys: 0.4,
    brightnessRing: 0.7,
    sampledAt: 'fixture',
    backup: 'fixture',
    profiles: Array.from({ length: 5 }, (_, wireIndex) => ({
      wireIndex,
      id: wireIndex < 4 ? wireIndex : 0,
      kind: wireIndex < 4 ? 'Hardware' : 'Software',
      pollingRate: 'Hz1000',
      gameModeEnabled: true,
      fnLockEnabled: true,
      idleTimeout: { disabled: false, timeoutSeconds: 120 },
    })),
    lighting: {
      profiles: Array.from({ length: 5 }, (_, wireIndex) => ({
        wireIndex,
        baseZones: zones(wireIndex),
        perimeterZones: [],
        reactiveZones: [],
      })),
    },
  };
  const all = {
    profiles: Array.from({ length: 4 }, (_, wireIndex) => ({
      wireIndex,
      remaps: { configs: nativeConfigs() },
    })),
    returnedToOriginalSlot: true,
  };
  const connection = {
    activeProfileIndex: slot,
    devicePath: 'fixture',
    firmware: '2.2.14',
    brightnessChannels: [40, 70],
    gameModeEnabled: true,
    fnLockEnabled: true,
  };
  const host = {
    connection: async () => connection,
    allProfileConfigs: async () => {
      calls.push('all');
      return all;
    },
    state: async activeOnly => { assert.equal(activeOnly, true); calls.push('selected'); return snapshot; },
    actuation: async () => actuation,
    remaps: async () => nativeRemaps,
    snap: async () =>
      Array.from({ length: 4 }, (_, wireIndex) => ({
        wireIndex,
        configs:
          wireIndex === 0
            ? [
                {
                  physicalKey1: 26,
                  physicalKey2: 22,
                  resolutionMethod: 'LastPressed',
                  bottomMode: 'EitherOne',
                },
              ]
            : [],
      })),
    releaseSoftwareProfile: async () => ({ outcome: 'unchanged' }),
  };
  for (const method of [
    'applyField',
    'applyActuation',
    'applyLighting',
    'applyRemap',
    'applySnap',
    'applyProfile',
    'applySoftwareProfile',
  ])
    host[method] = async (input) => {
      calls.push({ method, input });
      return { outcome: 'applied', backup: 'device-edits/fixture-before.json' };
    };
  context = {
    host,
    state,
    keyboard,
    remap,
    device,
    diagnostics: {},
    deviceControls: null,
    setStatusLabel: (label) => labels.push(label),
  };
  const sync = createProfileSync(context, 'hardware-0');
  const model = {
    observe(effect) {
      return require('mobx').reaction(() => captureControlSnapshot(context), (next, previous) => {
        notifications++;
        effect(next, previous);
      });
    },
    ...sync,
    depthActive: () => false,
    activeWireSlot: () => keyboard.activeProfile.hardwareProfileId,
  };
  controls = createDeviceControls({
    state,
    host,
    model,
    label: (label) => labels.push(label),
    diagnostic() {},
    report() {},
    pollIntervalMs: 60000,
  });
  context.deviceControls = controls;
  return {
    sync,
    state,
    host,
    context,
    controls,
    calls,
    all,
    actuation,
    snapshot,
    workspace,
    connection,
    get notifications() {
      return notifications;
    },
    close: () => controls.dispose(),
  };
}
test('macro default name resolves after translation initialization and at creation time', async () => {
  const { i18n, RemapMacro } = models;
  const snapshot = { kind: 'Macro', action: { repeatCount: { kind: 'WhilePressed' }, targetKeys: [] } };
  assert.equal(RemapMacro.create(snapshot).name, i18n.t('macro:macroUnnamed'));
  try {
    await i18n.changeLanguage('de');
    assert.equal(RemapMacro.create(snapshot).name, i18n.t('macro:macroUnnamed'));
  } finally { await i18n.changeLanguage('en'); }
});

test('renderer loads only the selected profile and reuses it without outbound writes', async () => {
  const f = setup();
  try {
    const result = await f.sync.syncHardwareProfiles();
    assert.equal(result.hardwareProfiles, 1);
    assert.equal(result.actuationKeys, 88);
    assert.equal(f.context.keyboard.hardwareProfiles.length, 4);
    assert.deepEqual(
      require('mobx-state-tree').getSnapshot(f.context.keyboard.hardwareProfiles.find(p => p.hardwareProfileId === 2).settings.baseZones),
      f.snapshot.lighting.profiles[2].baseZones,
    );
    assert.equal(f.context.keyboard.hardwareProfiles.find(p => p.hardwareProfileId === 2).settings.pollingRate, 'Hz1000');
    const key = f.context.remap.hardwareKeyRemapSettingsMap
      .get('2')
      .physicalKeys.get(String(ids[0]));
    assert.equal(key.active.actuation.level, 12);
    assert.equal(key.active.actuation.isRapidTrigger, true);
    assert.equal(key.active.actuation.rapidSensitivity, 3);
    assert.deepEqual(f.state.getSnapshot().selection, { kind: 'onboard', wireIndex: 2 });
    assert.equal(f.state.getSnapshot().allProfilesLoaded, false);
    assert.equal(f.sync.isHardwareProfileLoaded(2), true);
    assert.equal(f.sync.isHardwareProfileLoaded(0), false);
    assert.equal(f.state.getSnapshot().hydrationDepth, 0);
    assert.equal(f.workspace.size, 0);
    await f.controls.flush();
    assert.deepEqual(f.calls, ['selected']);
    await f.sync.syncHardwareProfiles();
    await f.controls.flush();
    assert.deepEqual(f.calls, ['selected']);
  } finally {
    f.close();
  }
});
test('live brightness, game mode and Fn lock mirror through hydration without echo', async () => {
  const f = setup();
  try {
    await f.sync.syncHardwareProfiles();
    f.sync.syncLiveValues({
      ...f.connection,
      brightnessChannels: [15, 30],
      gameModeEnabled: false,
      fnLockEnabled: false,
    });
    assert.equal(f.context.keyboard.keyBrightness, 0.15);
    assert.equal(f.context.keyboard.perimeterBrightness, 0.3);
    assert.equal(f.context.keyboard.activeProfile.settings.fnLockEnabled, false);
    assert.equal(f.context.keyboard.activeProfile.settings.gameModeEnabled, false);
    await f.controls.flush();
    assert.deepEqual(f.calls, ['selected']);
    assert.equal(f.state.getSnapshot().phase, 'ready');
  } finally {
    f.close();
  }
});

test('verified onboard selections reuse models without rereading remaps or restoring software', async () => {
  const f = setup();
  try {
    await f.sync.syncHardwareProfiles();
    for (const name of ['state', 'actuation', 'remaps', 'snap', 'releaseSoftwareProfile'])
      f.host[name] = async () => { throw Error('Unexpected slow read: ' + name); };
    const result = await f.sync.syncHardwareProfiles(f.state.ticket());
    assert.equal(result.activeWireSlot, 2);
    assert.equal(f.state.getSnapshot().phase, 'ready');
    assert.equal(f.workspace.size, 0);
  } finally { f.close(); }
});
test('selection change rejects an outstanding selected-profile reply before any model mutation', async () => {
  const f = setup();
  try {
    const gate = deferred(),
      entered = deferred();
    f.host.state = () => {
      entered.resolve();
      return gate.promise;
    };
    const pending = f.sync.syncHardwareProfiles();
    await entered.promise;
    const count = f.notifications;
    f.state.selectProfile({ kind: 'onboard', wireIndex: 3 });
    const rejected = assert.rejects(pending, /connection or profile changed/);
    gate.resolve(f.snapshot);
    await rejected;
    assert.equal(f.notifications, count);
    assert.equal(f.state.getSnapshot().allProfilesLoaded, false);
    assert.deepEqual(f.state.getSnapshot().selection, { kind: 'onboard', wireIndex: 3 });
    assert.equal(f.workspace.has('inert'), true, 'An unloaded replacement profile stays locked');
  } finally {
    f.close();
  }
});
test('old connection reply cannot overwrite the replacement connection or models', async () => {
  const f = setup();
  try {
    const gate = deferred(),
      entered = deferred();
    f.host.state = () => {
      entered.resolve();
      return gate.promise;
    };
    const pending = f.sync.syncHardwareProfiles();
    await entered.promise;
    const count = f.notifications;
    f.state.disconnect();
    const ticket = f.state.beginConnection();
    f.state.connected({ id: 'replacement' }, ticket);
    const rejected = assert.rejects(pending, /connection or profile changed/);
    gate.resolve(f.snapshot);
    await rejected;
    assert.equal(f.notifications, count);
    assert.equal(f.state.getSnapshot().device.id, 'replacement');
    assert.equal(f.state.getSnapshot().allProfilesLoaded, false);
    assert.equal(f.state.getSnapshot().phase, 'ready');
  } finally {
    f.close();
  }
});
test('mixed active-profile reads reject without applying profile or brightness updates', async () => {
  const f = setup();
  try {
    f.actuation.activeProfileIndex = 1;
    await assert.rejects(f.sync.syncHardwareProfiles(), /profile changed during synchronization/);
    assert.equal(f.context.keyboard.hardwareProfiles.length, 4);
    assert.equal(f.context.keyboard.keyBrightness, 1);
    assert.equal(f.state.getSnapshot().hydrationDepth, 0);
    assert.equal(f.workspace.has('inert'), true, 'Unknown profile contents must not become editable');
  } finally {
    f.close();
  }
});
test('reconnect invalidates cached device contents and reloads only the selected slot', async () => {
  const f = setup();
  try {
    await f.sync.syncHardwareProfiles();
    f.state.disconnect();
    const ticket = f.state.beginConnection();
    f.state.connected({ id: 'reconnected' }, ticket);
    await f.sync.syncHardwareProfiles();
    assert.deepEqual(f.calls, ['selected', 'selected']);
    assert.equal(f.state.getSnapshot().allProfilesLoaded, false);
  } finally {
    f.close();
  }
});
test('saved profile parser preserves numeric selection timestamps and nested reactive color settings', () => {
  const base = {
    pollingRate: 'Hz8000',
    gameModeEnabled: false,
    fnLockEnabled: false,
    idleTimeout: { disabled: true, timeoutSeconds: 0 },
    baseZones: [],
    perimeterZones: [],
    reactiveZones: [
      {
        id: 'reactive',
        keys: [26],
        effectSettings: {
          kind: 'Fade',
          layer: 'Reactive',
          keyEvent: 'Pressed',
          speedPercent: 0.5,
          color: { kind: 'Color', r: 1, g: 2, b: 3 },
        },
      },
    ],
  };
  const input = {
    deviceUniqueId: 'fixture',
    deviceType: 'FunctionElite',
    activeProfileId: 'profile',
    softwareProfiles: [{ id: 'profile', lastSelected: 12345, settings: base }],
  };
  const parsed = keyboardSnapshot(input);
  assert.equal(parsed.softwareProfiles[0].lastSelected, 12345);
  assert.deepEqual(parsed.softwareProfiles[0].settings.reactiveZones, base.reactiveZones);
});

test('a stale hydration completion cannot unlock the workspace while replacement hydration is running', async () => {
  const f = setup(),
    oldGate = deferred(),
    newGate = deferred(),
    oldEntered = deferred(),
    newEntered = deferred();
  let reads = 0,
    newPending;
  f.host.state = () => {
    if (++reads === 1) {
      oldEntered.resolve();
      return oldGate.promise;
    }
    newEntered.resolve();
    return newGate.promise;
  };
  try {
    const oldPending = f.sync.syncHardwareProfiles();
    await oldEntered.promise;
    f.state.disconnect();
    const ticket = f.state.beginConnection();
    f.state.connected({ id: 'replacement' }, ticket);
    newPending = f.sync.syncHardwareProfiles();
    await newEntered.promise;
    assert.equal(f.state.getSnapshot().phase, 'hydrating');
    const rejected = assert.rejects(oldPending, /connection or profile changed/);
    oldGate.resolve(f.snapshot);
    await rejected;
    assert.equal(f.state.getSnapshot().phase, 'hydrating');
    assert.equal(f.workspace.has('inert'), true, 'replacement read retains the UI input lock');
    assert.equal(f.workspace.get('aria-busy'), 'true');
  } finally {
    newGate.resolve(f.snapshot);
    if (newPending) await newPending;
    f.close();
  }
});

test('a stale owner ticket cannot mirror live controls into a newer profile selection', () => {
  const f = setup();
  try {
    const ticket = f.state.ticket();
    f.state.selectProfile({ kind: 'onboard', wireIndex: 1 });
    assert.throws(
      () => f.sync.syncLiveValues({ ...f.connection, brightnessChannels: [10, 20] }, ticket),
      /connection or profile changed/,
    );
    assert.equal(f.context.keyboard.keyBrightness, 1);
    assert.equal(f.context.keyboard.perimeterBrightness, 1);
    assert.equal(f.state.getSnapshot().hydrationDepth, 0);
  } finally {
    f.close();
  }
});
