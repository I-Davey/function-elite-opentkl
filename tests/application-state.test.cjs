const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const stateModule = import(
  pathToFileURL(path.resolve(__dirname, '../.build/application-state/index.js'))
);

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function connected(execute) {
  const { createApplicationState } = await stateModule;
  const coordinator = createApplicationState({ execute, coalesceMs: 60_000 });
  const ticket = coordinator.beginConnection();
  coordinator.connected({ id: 'nzxt-test', firmware: '2.2.14' }, ticket);
  coordinator.selectProfile({ kind: 'onboard', wireIndex: 0 });
  return coordinator;
}

const readback = async (value) => ({ value, evidence: 'readback' });

test('nested hydration never echoes writes, caches only the live connection and restores suspension on error', async () => {
  const calls = [];
  const coordinator = await connected(async (input) => {
    calls.push(input);
    return readback(input);
  });
  const outside = coordinator.beginHydration();
  coordinator.markHardwareProfilesLoaded(outside.ticket);
  assert.equal(coordinator.getSnapshot().allProfilesLoaded, true);
  const inside = coordinator.beginHydration();
  assert.equal(coordinator.getSnapshot().hydrationDepth, 2);
  assert.equal(coordinator.scheduleEdit(123, { key: 'brightness' }), null);
  inside.close();
  assert.equal(coordinator.getSnapshot().writesSuspended, true);
  outside.close();
  assert.equal(coordinator.getSnapshot().phase, 'ready');
  await assert.rejects(
    coordinator.withHydration(async () => {
      throw Error('read failed');
    }),
    /read failed/,
  );
  assert.equal(coordinator.getSnapshot().writesSuspended, false);
  assert.deepEqual(calls, []);
  coordinator.disconnect();
  assert.equal(coordinator.getSnapshot().allProfilesLoaded, false);
  coordinator.dispose();
});

test('a previous connection hydration cannot commit models or mark the next connection ready', async () => {
  const coordinator = await connected(readback);
  const oldHydration = coordinator.beginHydration();
  coordinator.disconnect();
  const next = coordinator.beginConnection();
  coordinator.connected({ id: 'replacement-keyboard' }, next);
  const currentHydration = coordinator.beginHydration();
  assert.throws(
    () => oldHydration.commit(() => assert.fail('stale model update ran')),
    /connection or profile changed/,
  );
  assert.throws(
    () => coordinator.markHardwareProfilesLoaded(oldHydration.ticket),
    /connection or profile changed/,
  );
  oldHydration.close();
  assert.equal(coordinator.getSnapshot().hydrationDepth, 1);
  assert.equal(coordinator.getSnapshot().phase, 'hydrating');
  currentHydration.close();
  assert.equal(coordinator.getSnapshot().phase, 'ready');
  coordinator.dispose();
});

test('profile selection cancels deferred edits and rejects a stale read ticket', async () => {
  const calls = [];
  const coordinator = await connected(async (value) => {
    calls.push(value);
    return readback(value);
  });
  coordinator.scheduleEdit('old-profile', { key: 'actuation' });
  const oldTicket = coordinator.ticket();
  coordinator.selectProfile({ kind: 'software', id: 'walking', wireIndex: 4 });
  await coordinator.flush();
  assert.deepEqual(calls, []);
  assert.equal(coordinator.getSnapshot().pendingEdits.length, 0);
  assert.equal(coordinator.isCurrent(oldTicket), false);
  assert.equal(coordinator.getSnapshot().selection.id, 'walking');
  coordinator.dispose();
});

test('coalesces per-key edits without dropping different physical keys and executes once', async () => {
  const calls = [];
  const coordinator = await connected(async (input) => {
    calls.push(input);
    return readback(input);
  });
  const options = {
    key: '0:actuation',
    merge(previous, next) {
      return Object.fromEntries([...Object.entries(previous), ...Object.entries(next)]);
    },
  };
  coordinator.scheduleEdit({ 1: 0.2, 2: 0.3 }, options);
  coordinator.scheduleEdit({ 1: 0.1, 3: 0.4 }, options);
  assert.equal(coordinator.getSnapshot().pendingEdits.length, 1);
  await coordinator.flush();
  assert.deepEqual(calls, [{ 1: 0.1, 2: 0.3, 3: 0.4 }]);
  assert.equal(coordinator.getSnapshot().lastCompletion.evidence, 'readback');
  coordinator.dispose();
});

test('new lighting edits replace queued colours while preserving the running write and other layers', async () => {
  const gate=deferred(),calls=[];
  const coordinator=await connected(async input=>{
    calls.push(input);if(input==='running')await gate.promise;return readback(input);
  });
  coordinator.scheduleEdit('running',{key:'Base',delayMs:0});
  const flushing=coordinator.flush();await new Promise(resolve=>setImmediate(resolve));
  coordinator.scheduleEdit('other-layer',{key:'Ring',delayMs:0});
  for(let n=0;n<20;n++){
    coordinator.scheduleEdit('colour-'+n,{key:'Base',delayMs:0});
    await new Promise(resolve=>setTimeout(resolve,2));
  }
  assert.equal(coordinator.getSnapshot().pendingEdits.length,3);
  gate.resolve();await flushing;await coordinator.flush();
  assert.deepEqual(calls,['running','other-layer','colour-19']);
  coordinator.dispose();
});

test('disconnect cancels queued writes while stale in-flight completion cannot overwrite a reconnected session', async () => {
  const gate = deferred();
  const calls = [];
  const coordinator = await connected(async (input) => {
    calls.push(input);
    if (input === 'in-flight') await gate.promise;
    return readback(input);
  });
  coordinator.scheduleEdit('in-flight', { key: 'a' });
  coordinator.scheduleEdit('must-cancel', { key: 'b' });
  const firstFlush = coordinator.flush();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ['in-flight']);
  coordinator.disconnect();
  assert.equal(coordinator.getSnapshot().pendingEdits[0].stale, true);
  const next = coordinator.beginConnection();
  coordinator.connected({ id: 'reconnected' }, next);
  coordinator.scheduleEdit('new-session', { key: 'new' });
  const newFlush = coordinator.flush();
  gate.resolve();
  await Promise.all([firstFlush, newFlush]);
  assert.deepEqual(calls, ['in-flight', 'new-session']);
  assert.equal(coordinator.getSnapshot().lastCompletion.value, 'new-session');
  assert.equal(coordinator.getSnapshot().phase, 'ready');
  coordinator.dispose();
});

test('failed writes cancel remaining commands; acknowledgement never becomes readback evidence', async () => {
  const calls = [];
  const coordinator = await connected(async (input) => {
    calls.push(input);
    if (input === 'fail') throw Error('HID timeout');
    return { value: input, evidence: 'acknowledged' };
  });
  coordinator.scheduleEdit('software', { key: 'software' });
  await coordinator.flush();
  assert.equal(coordinator.getSnapshot().lastCompletion.evidence, 'acknowledged');
  coordinator.scheduleEdit('fail', { key: 'fail' });
  coordinator.scheduleEdit('cancel', { key: 'cancel' });
  await assert.rejects(coordinator.flush(), /HID timeout/);
  assert.deepEqual(calls, ['software', 'fail']);
  assert.equal(coordinator.getSnapshot().phase, 'error');
  assert.equal(coordinator.getSnapshot().pendingEdits.length, 0);
  coordinator.dispose();
});

test('recovery suspends edits, records failure, and cannot finish after disconnection', async () => {
  const coordinator = await connected(readback);
  const ticket = coordinator.beginRecovery('restore software slot');
  assert.equal(coordinator.getSnapshot().phase, 'recovering');
  assert.equal(coordinator.scheduleEdit('no-echo', { key: 'brightness' }), null);
  coordinator.finishRecovery(ticket, Error('original profile not restored'));
  assert.equal(coordinator.getSnapshot().phase, 'error');
  assert.equal(coordinator.getSnapshot().recovery.status, 'failed');
  const retry = coordinator.beginRecovery('retry restore');
  coordinator.disconnect();
  assert.throws(() => coordinator.finishRecovery(retry), /connection or profile changed/);
  coordinator.dispose();
});

test('stable immutable snapshots notify subscriptions without observer failures interrupting writes', async () => {
  const coordinator = await connected(readback);
  const initial = coordinator.getSnapshot();
  assert.equal(coordinator.getSnapshot(), initial);
  assert.ok(Object.isFrozen(initial));
  let count = 0;
  const dispose = coordinator.subscribe(() => {
    count++;
  });
  coordinator.subscribe(() => {
    throw Error('broken view');
  });
  coordinator.scheduleEdit('brightness', { key: 'brightness' });
  await coordinator.flush();
  assert.ok(count > 0);
  assert.equal(coordinator.getSnapshot().lastCompletion.value, 'brightness');
  dispose();
  const before = count;
  coordinator.disconnect();
  assert.equal(count, before);
  coordinator.dispose();
  assert.throws(() => coordinator.scheduleEdit('invalid', { key: 'invalid' }), /disposed/);
});

test('a durable recovery waits across disconnect and blocks writes until the connected restore succeeds', async () => {
  const { createApplicationState } = await stateModule;
  const coordinator = createApplicationState({ execute: readback });
  coordinator.requestRecovery('Restore interrupted software session');
  assert.equal(coordinator.getSnapshot().recovery.status, 'waiting');
  const connection = coordinator.beginConnection();
  coordinator.connected({ id: 'returned-keyboard' }, connection);
  assert.equal(coordinator.getSnapshot().phase, 'recovering');
  assert.equal(coordinator.scheduleEdit('blocked', { key: 'field' }), null);
  const recovery = coordinator.beginRecovery('Restore interrupted software session');
  coordinator.disconnect();
  assert.equal(coordinator.getSnapshot().recovery.status, 'waiting');
  assert.equal(coordinator.isCurrent(recovery), false);
  const next = coordinator.beginConnection();
  coordinator.connected({ id: 'returned-keyboard' }, next);
  const retry = coordinator.beginRecovery('Restore interrupted software session');
  coordinator.finishRecovery(retry);
  assert.equal(coordinator.getSnapshot().phase, 'ready');
  assert.equal(coordinator.getSnapshot().recovery.status, 'complete');
  coordinator.dispose();
});
