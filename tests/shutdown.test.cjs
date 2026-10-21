const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const fs = require('node:fs');
const { createDeviceLifecycle } = require('../dist/app/main/device-lifecycle.cjs');
test('shutdown waits for active transactions and cleanup, recovers, and rejects new work', async () => {
  const order = [],
    app = new EventEmitter();
  app.quit = () => {
    let prevented = false;
    app.emit('before-quit', {
      preventDefault() {
        prevented = true;
      },
    });
    if (!prevented) {
      order.push('quit');
      app.emit('quit');
    }
  };
  const dir = path.resolve(__dirname, '../data/checks/shutdown');
  fs.mkdirSync(dir, { recursive: true });
  const serial = await createDeviceLifecycle({
    app,
    profile: dir,
    record() {},
    beforeShutdown: async () => {
      order.push('cleanup');
    },
    recoverSessions: async () => {
      order.push('recover');
    },
  });
  let finish;
  const operation = serial(async () => {
    order.push('edit-start');
    await new Promise((resolve) => {
      finish = resolve;
    });
    order.push('edit-end');
  });
  await new Promise((resolve) => setImmediate(resolve));
  const quit = new Promise((resolve) => app.once('quit', resolve));
  app.quit();
  await assert.rejects(
    serial(() => {}),
    /closing/,
  );
  assert.deepEqual(order, ['edit-start']);
  finish();
  await operation;
  await quit;
  assert.deepEqual(order, ['edit-start', 'edit-end', 'cleanup', 'recover', 'quit']);
});
