'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = path.resolve(__dirname, '../dist/app');
const request = require('../dist/app/main/desktop-requests.cjs');
const { channels } = require('../dist/app/main/desktop-channels.cjs');
const { validate } = require('../dist/app/main/profile-store.cjs');

test('isolated preload exposes every named channel through keyboardHost and removes event listeners', async () => {
  let exposed;
  const invocations = [],
    sent = [],
    listeners = new Map();
  const ipcRenderer = {
    invoke: async (channel, value) => {
      invocations.push([channel, value]);
      return 'reply';
    },
    send: (channel, value) => sent.push([channel, value]),
    on: (channel, listener) => listeners.set(channel, listener),
    removeListener: (channel, listener) => {
      assert.equal(listeners.get(channel), listener);
      listeners.delete(channel);
    },
  };
  const context = {
    exports: {},
    require(name) {
      assert.equal(name, 'electron', 'sandbox preload must only import Electron');
      return {
        contextBridge: {
          exposeInMainWorld(name, api) {
            assert.equal(name, 'keyboardHost');
            exposed = api;
          },
        },
        ipcRenderer,
      };
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(app, 'preload.cjs'), 'utf8'), context);
  assert(Object.isFrozen(exposed));
  for (const [channel, method] of Object.entries(channels)) {
    assert.equal(typeof exposed[method], 'function', channel);
    assert.equal(await exposed[method]({ example: true }), 'reply');
    assert.equal(invocations.at(-1)[0], channel);
  }
  for (const [method, channel] of [
    ['report', 'keyboard:report'],
    ['diagnostic', 'keyboard:diagnostic'],
    ['testReport', 'keyboard:test-report'],
  ]) {
    exposed[method]({ status: 'ok' });
    assert.equal(sent.at(-1)[0], channel);
  }
  const events = [];
  const remove = exposed.onMacroEvent((value) => events.push(value));
  const listener = listeners.get('keyboard:macro-event');
  listener({}, { hidKey: 4, state: 'wrong', timestamp: 1 });
  listener({}, { hidKey: 4, state: 'Pressed', timestamp: 1 });
  listener({}, null);
  assert.equal(events.length, 2);
  assert.equal(events[0].hidKey, 4);
  assert.equal(events[1], null);
  remove();
  assert.equal(listeners.size, 0);
  const lifecycle = [];
  const unsubscribe = exposed.onLifecycleEvent((value) => lifecycle.push(value));
  listeners.get('keyboard:lifecycle-event')(
    {},
    {
      phase: 'ready',
      pendingTransactions: 0,
      recovery: { status: 'complete', reason: null, error: null },
    },
  );
  listeners.get('keyboard:lifecycle-event')(
    {},
    {
      phase: 'ready',
      pendingTransactions: 0,
      recovery: { status: 'fake', reason: null, error: null },
    },
  );
  assert.equal(lifecycle.length, 1);
  unsubscribe();
  assert.equal(listeners.size, 0);
});

test('IPC request schemas reject malformed edits before any device access', () => {
  assert.throws(() => request.fieldEdit({ field: 'rawReport', wireIndex: 0, value: 1 }), /field/);
  assert.throws(() => request.fieldEdit({ field: 'gameMode', wireIndex: 5, value: 0 }), /slot/);
  assert.throws(
    () =>
      request.actuationEdit({
        wireIndex: 0,
        keys: [
          {
            physicalKey: 4,
            kind: 'Single',
            levelIndex: 40,
            secondLevelIndex: 0,
            rapidSensitivityIndex: 0,
          },
        ],
      }),
    /level/,
  );
  assert.throws(
    () =>
      request.remapEdit({
        wireIndex: 0,
        physicalKey: 4,
        level: 0,
        fnLayer: false,
        remap: {
          kind: 'Macro',
          action: { repeatCount: { kind: 'Count', nonZeroCount: 0 }, targetKeys: [] },
        },
      }),
    /repeat/,
  );
  assert.throws(() => request.lightingEdit({ wireIndex: 0, layer: 'Other', zones: [] }), /layer/);
  assert.throws(
    () =>
      request.snapEdit({
        wireIndex: 0,
        configs: [
          { physicalKey1: 4, physicalKey2: 5, resolutionMethod: 'wrong', bottomMode: 'EitherOne' },
        ],
      }),
    /resolution/,
  );
  assert.deepEqual(
    request.remapEdit({
      wireIndex: 0,
      physicalKey: 4,
      level: 0,
      fnLayer: true,
      remap: { kind: 'Modifier', modifier: 'Shift' },
    }),
    {
      wireIndex: 0,
      physicalKey: 4,
      level: 0,
      fnLayer: true,
      remap: { kind: 'Modifier', modifier: 'Shift' },
    },
  );
});

test('lighting IPC preserves reactive RGB color-mode discriminators required by CAM models', () => {
  const input = {
    wireIndex: 0,
    layer: 'Reactive',
    zones: [
      {
        id: 'fade',
        keys: [4],
        effectSettings: {
          layer: 'Reactive',
          kind: 'Fade',
          color: { kind: 'Color', r: 255, g: 30, b: 60 },
          speedPercent: 0.5,
          keyEvent: 'Pressed',
        },
      },
    ],
  };
  assert.deepEqual(request.lightingEdit(input), input);
});

test('profile schema preserves extension fields and validates all software profile records', () => {
  const input = {
    schemaVersion: 1,
    keyboard: { activeProfileId: 'local', softwareProfiles: [{}] },
    remap: {},
    keyBrightness: 0.5,
    extra: { retained: true },
    omitted: undefined,
  };
  assert.deepEqual(validate(input), JSON.parse(JSON.stringify(input)));
  assert.throws(
    () => validate({ ...input, keyboard: { ...input.keyboard, softwareProfiles: [null] } }),
    /software profile/,
  );
  assert.throws(() => validate({ ...input, remap: [] }), /remap/);
});

test('full profile IPC preserves actual settings and the 32-bit Function key identifier', () => {
  const layout = require('../resources/keyboard/key-layout.json');
  const keys = Object.values(layout.sensors).map((key) => key.physicalKeyId);
  const input = {
    wireIndex: 0,
    settings: {
      pollingRate: 'Hz1000',
      gameModeEnabled: false,
      fnLockEnabled: false,
      idleTimeout: { disabled: false, timeoutSeconds: 900 },
      baseZones: [
        {
          id: 'main',
          keys,
          effectSettings: { layer: 'Base', kind: 'Color', color: { r: 255, g: 0, b: 128 } },
        },
      ],
      perimeterZones: [],
      reactiveZones: [],
    },
    physicalKeys: keys.map((physicalKey) => ({
      physicalKey,
      active: {
        kind: 'Single',
        actuation: { isRapidTrigger: false, level: 16, rapidSensitivity: 4 },
        remapTo: { kind: 'SimpleRemap', targetKeyId: physicalKey },
        fnPressed: { remapTo: { kind: 'SimpleRemap', targetKeyId: physicalKey } },
      },
    })),
    snapConfigs: [],
  };
  assert(keys.includes(4278190318));
  assert.deepEqual(request.profileEdit(input), input);
  const lighting = require('../dist/backend/lighting.cjs');
  const parsed = request.lightingEdit({
    wireIndex: 0,
    layer: 'Base',
    zones: input.settings.baseZones,
  });
  assert.equal(
    lighting.encodeZones(parsed.zones, parsed.layer),
    lighting.encodeZones(input.settings.baseZones, 'Base'),
  );
});
