const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const loaded = new Module(__filename, module);
loaded.filename = __filename;
loaded.paths = Module._nodeModulePaths(root);
loaded._compile(require('esbuild').buildSync({
  stdin: { contents: `
    export {MacroRecordStore} from './packages/keyboard-ui/src/models/MacroRecordStore.ts';
    export {createMacroRecorderAdapter} from './packages/renderer/src/macro-recorder.ts';`,
    resolveDir: root, loader: 'ts' },
  bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external',
}).outputFiles[0].text, __filename);
const { MacroRecordStore, createMacroRecorderAdapter } = loaded.exports;

function fixture({ rejectStart = false } = {}) {
  let event, removed = 0, stops = 0, ends = 0;
  const actions = [], delays = [], errors = [];
  const host = {
    onMacroEvent(callback) { event = callback; return () => { removed++; }; },
    async startMacroRecording() { if (rejectStart) throw Error('fixture start rejected'); },
    async stopMacroRecording() { stops++; },
  };
  const store = new MacroRecordStore(
    createMacroRecorderAdapter(host, new Map([[4, 'A']]), { A: 'A' }), new Set(['A']),
  );
  return {
    store, actions, delays, errors,
    emit: data => event(data),
    start(index = -1, options = {}) {
      store.startMacroRecording(values => actions.push(...values),
        (index, delay) => delays.push([index, delay]), index,
        { onEnd: () => { ends++; }, onError: error => errors.push(error.message), ...options });
    },
    get lifecycle() { return { removed, stops, ends }; },
  };
}

test('macro host stream ending clears recorder state and removes its listener once', () => {
  const f = fixture(); f.start();
  assert.equal(f.store.isRecording, true);
  f.emit({ hidKey: 4, state: 'Pressed', timestamp: 1 });
  f.emit(null);
  assert.equal(f.store.isRecording, false);
  assert.equal(f.store.macroRecordCall, undefined);
  assert.equal(f.store.lastAction, null);
  f.store.beforeDestroy();
  assert.deepEqual(f.lifecycle, { removed: 1, stops: 1, ends: 1 });
});

test('rejected macro capture returns the editor to idle and releases the subscription', async () => {
  const f = fixture({ rejectStart: true }); f.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.store.isRecording, false);
  assert.equal(f.store.macroRecordCall, undefined);
  assert.deepEqual(f.errors, ['fixture start rejected']);
  assert.deepEqual(f.lifecycle, { removed: 1, stops: 1, ends: 1 });
});

test('synchronous macro client failure returns to idle and reports the error', () => {
  const errors = [];
  const store = new MacroRecordStore({ startMacroRecording() { throw Error('fixture sync failure'); } }, new Set());
  store.startMacroRecording(() => {}, () => {}, -1, { onError: error => errors.push(error.message) });
  assert.equal(store.isRecording, false);
  assert.equal(store.macroRecordCall, undefined);
  assert.deepEqual(errors, ['fixture sync failure']);
});

test('macro recording filters mouse events and converts/clamps seconds to editor milliseconds', () => {
  const f = fixture();
  f.start(-1, { ignoreMouseEvents: true,
    validTimeoutRange: { minSeconds: 0.02, maxSeconds: 1, stepSeconds: 0.01 } });
  f.emit({ hidKey: 4, state: 'Pressed', timestamp: 1 });
  f.emit({ hidKey: 255, state: 'Pressed', timestamp: 1.04 });
  f.emit({ hidKey: 4, state: 'Released', timestamp: 1.127 });
  f.emit({ hidKey: 4, state: 'Pressed', timestamp: 9 });
  assert.deepEqual(f.actions.map(action => [action.hidKey, action.state, action.delayMs]),
    [[4, 'KeyDown', 20], [4, 'KeyUp', 20], [4, 'KeyDown', 20]]);
  assert.deepEqual(f.delays, [[0, 130], [1, 1000]]);
  f.store.beforeDestroy(); f.store.beforeDestroy();
  assert.deepEqual(f.lifecycle, { removed: 1, stops: 1, ends: 1 });
});

test('macro recording at its 256-action limit stops without adding another event', () => {
  const f = fixture(); f.start(255);
  f.emit({ hidKey: 4, state: 'Pressed', timestamp: 1 });
  assert.equal(f.actions.length, 0);
  assert.equal(f.store.isRecording, false);
  assert.equal(f.store.lastAction, null);
  assert.deepEqual(f.lifecycle, { removed: 1, stops: 1, ends: 1 });
});
