'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
let createApplicationState, createDesktopLifecycleMirror;
before(async () => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, '.build/application-state/desktop-activity-test.mjs');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await require('esbuild').build({
    stdin: {
      contents:
        "export {createApplicationState} from './packages/application-state/src/index.ts'; export {createDesktopLifecycleMirror} from './packages/renderer/src/desktop-lifecycle.ts';",
      sourcefile: 'desktop-activity-test.ts',
      resolveDir: root,
      loader: 'ts',
    },
    outfile: output,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  ({ createApplicationState, createDesktopLifecycleMirror } = await import(pathToFileURL(output)));
});
const execute = async (value) => ({ value, evidence: 'readback' });

test('desktop activity publishes immutable metadata without creating intents or invalidating reads', () => {
  const state = createApplicationState({ execute });
  assert.equal(state.getSnapshot().desktopPhase, 'unknown');
  const attempt = state.beginConnection();
  state.connected({ id: 'test' }, attempt);
  const scope = state.beginHydration();
  const original = state.getSnapshot();
  state.setDesktopActivity({ phase: 'ready', pendingTransactions: 2 });
  const snapshot = state.getSnapshot();
  assert(Object.isFrozen(snapshot));
  assert.equal(snapshot.desktopPhase, 'ready');
  assert.equal(snapshot.desktopTransactionCount, 2);
  assert.equal(snapshot.pendingEdits.length, 0);
  assert.equal(snapshot.phase, 'hydrating');
  assert.notEqual(snapshot, original);
  assert.equal(original.desktopTransactionCount, 0);
  assert.equal(
    scope.commit(() => 42),
    42,
  );
  state.setDesktopActivity({ phase: 'ready', pendingTransactions: 2 });
  assert.equal(state.getSnapshot(), snapshot, 'unchanged metadata retains snapshot identity');
  scope.close();
  state.dispose();
});

test('native read counts do not self-block an existing renderer intent or add a second queue', async () => {
  const calls = [];
  const state = createApplicationState({
    execute: async (value) => {
      calls.push(value);
      return execute(value);
    },
    coalesceMs: 60000,
  });
  const attempt = state.beginConnection();
  state.connected({ id: 'test' }, attempt);
  state.setDesktopActivity({ phase: 'ready', pendingTransactions: 3 });
  assert.equal(state.getSnapshot().writesSuspended, false);
  state.scheduleEdit('brightness', { key: 'brightness' });
  await state.flush();
  assert.deepEqual(calls, ['brightness']);
  assert.equal(state.getSnapshot().desktopTransactionCount, 3);
  assert.equal(state.getSnapshot().pendingEdits.length, 0);
  state.dispose();
});

test('lifecycle counts and phase update even when recovery status has not changed', () => {
  const state = createApplicationState({ execute });
  const mirror = createDesktopLifecycleMirror(state);
  const recovery = { status: 'complete', reason: null, error: null };
  mirror({ phase: 'ready', pendingTransactions: 0, recovery });
  mirror({ phase: 'ready', pendingTransactions: 1, recovery });
  assert.equal(state.getSnapshot().desktopTransactionCount, 1);
  mirror({ phase: 'closing', pendingTransactions: 1, recovery });
  assert.equal(state.getSnapshot().desktopPhase, 'closing');
  mirror({ phase: 'closed', pendingTransactions: 0, recovery });
  assert.equal(state.getSnapshot().desktopTransactionCount, 0);
  assert.equal(state.getSnapshot().desktopPhase, 'closed');
  state.dispose();
});

test('invalid desktop metadata is rejected before changing the current snapshot', () => {
  const state = createApplicationState({ execute });
  const original = state.getSnapshot();
  for (const count of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(
      () => state.setDesktopActivity({ phase: 'ready', pendingTransactions: count }),
      /transaction count/,
    );
  assert.throws(() => state.setDesktopActivity({ phase: 'fake', pendingTransactions: 0 }), /phase/);
  assert.equal(state.getSnapshot(), original);
  state.dispose();
  assert.throws(
    () => state.setDesktopActivity({ phase: 'ready', pendingTransactions: 0 }),
    /disposed/,
  );
});
