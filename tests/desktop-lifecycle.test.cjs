'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter, once } = require('node:events');
const { createDeviceLifecycle } = require('../dist/app/main/device-lifecycle.cjs');

test('lifecycle publishes the actual pending queue, drain, recovery and closing states', async () => {
  const app = new EventEmitter(),
    events = [];
  app.quit = () => {
    const event = {
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
    };
    app.emit('before-quit', event);
    if (!event.prevented) app.emit('quit');
  };
  const directory = path.resolve(__dirname, '../data/checks/desktop-lifecycle');
  fs.mkdirSync(directory, { recursive: true });
  const serial = await createDeviceLifecycle({
    app,
    profile: directory,
    record() {},
    recoverSessions: async () => {},
  });
  const unsubscribe = serial.subscribe((snapshot) => events.push(snapshot));
  let finish;
  const task = serial(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(serial.status().pendingTransactions, 1);
  const quit = once(app, 'quit');
  app.quit();
  assert.equal(serial.status().phase, 'closing');
  assert.equal(serial.status().recovery.status, 'waiting');
  await assert.rejects(
    serial(() => {}),
    /closing/,
  );
  finish();
  await task;
  await quit;
  assert.equal(serial.status().pendingTransactions, 0);
  assert.equal(serial.status().phase, 'closed');
  assert.equal(serial.status().recovery.status, 'complete');
  assert(events.some((row) => row.recovery.status === 'running'));
  unsubscribe();
});

test('failed shutdown restoration retains failure evidence and rejects subsequent operations', async () => {
  const app = new EventEmitter(),
    logs = [];
  app.quit = () => {
    const event = {
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
    };
    app.emit('before-quit', event);
    if (!event.prevented) app.emit('quit');
  };
  const directory = path.resolve(__dirname, '../data/checks/desktop-recovery');
  fs.mkdirSync(directory, { recursive: true });
  const serial = await createDeviceLifecycle({
    app,
    profile: directory,
    record: (...row) => logs.push(row),
    recoverSessions: async () => {
      throw Error('Unplugged');
    },
  });
  const quit = once(app, 'quit');
  app.quit();
  await quit;
  assert.equal(serial.status().recovery.status, 'failed');
  assert.equal(serial.status().recovery.error, 'Unplugged');
  assert(logs.some((row) => row[0] === 'device-recovery-pending'));
  await assert.rejects(
    serial(() => {}),
    /closing/,
  );
});

test('failed shutdown cleanup reports recovery as failed rather than waiting forever', async () => {
  const app = new EventEmitter();
  app.quit = () => {
    const event = {
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
    };
    app.emit('before-quit', event);
    if (!event.prevented) app.emit('quit');
  };
  const directory = path.resolve(__dirname, '../data/checks/desktop-cleanup');
  fs.mkdirSync(directory, { recursive: true });
  const serial = await createDeviceLifecycle({
    app,
    profile: directory,
    record() {},
    beforeShutdown: async () => {
      throw Error('Shutdown cleanup failed');
    },
    recoverSessions: async () => {
      throw Error('Recovery must wait for shutdown cleanup');
    },
  });
  const quit = once(app, 'quit');
  app.quit();
  await quit;
  assert.equal(serial.status().recovery.status, 'failed');
  assert.equal(serial.status().recovery.error, 'Shutdown cleanup failed');
});

