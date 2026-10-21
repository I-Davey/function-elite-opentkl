const { test } = require('node:test');
const assert = require('node:assert/strict');

test('remapping and lighting preserve calibration metadata; actuation changes refresh it', async t => {
  const driver = require.resolve('../dist/backend/driver-host.cjs');
  const previous = require.cache[driver];
  const operations = [];
  class DeviceHost {
    stop() {}
    async request(operation) {
      operations.push(operation);
      if (operation.startsWith('--apply-')) return { outcome: 'unchanged' };
      return { status: 'ok', firmware: '2.2.14', readOnly: true, settingsWritePerformed: false, devicePath: 'fixture',
        keys: Array.from({ length: operation === '--current' ? 96 : 88 }, (_, sensorId) =>
          ({ sensorId, adc: 2, baseline: 1, pressed: 3, scale: 2, threshold: 2 })),
      };
    }
  }
  require.cache[driver] = { id: driver, filename: driver, loaded: true, exports: { DeviceHost } };
  const moduleId = require.resolve('../dist/backend/devices.cjs');
  delete require.cache[moduleId];
  t.after(() => { if (previous) require.cache[driver] = previous; else delete require.cache[driver]; delete require.cache[moduleId]; });
  const devices = require(moduleId);
  await devices.sensors();
  await devices.applyRemap({});
  await devices.sensors();
  await devices.applyRemaps([{}]);
  await devices.sensors();
  await devices.applyLighting({});
  await devices.sensors();
  await devices.applyField({ field: 'brightnessKeys' });
  await devices.sensors();
  assert.equal(operations.filter(mode => mode === '--sensors').length, 1);
  assert.equal(operations.filter(mode => mode === '--current').length, 4);
  await devices.applyActuation({});
  await devices.sensors();
  await devices.applyField({ field: 'activeProfile' });
  await devices.sensors();
  assert.equal(operations.filter(mode => mode === '--sensors').length, 3);
});
