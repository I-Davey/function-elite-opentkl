const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { DeviceHost } = require('../dist/backend/driver-host.cjs');
function client(timeout = 1000, startup = 0) {
  return new DeviceHost(() => process.execPath, timeout, [
    path.join(__dirname, 'fake-device-host.cjs'),
    String(startup),
  ]);
}
test('one process serializes requests and prioritizes settings ahead of sensor backlog', async (t) => {
  const host = client();
  t.after(() => host.stop());
  const first = host.request('--state', { delay: 20 });
  await first;
  const sensor = host.request('--current', { delay: 30 });
  const later = host.request('--current');
  const edit = host.request('--apply-field', { value: 3 });
  await Promise.all([sensor, later, edit]);
  const metrics = host.diagnostics();
  assert.equal(metrics.launches, 1);
  assert.deepEqual(
    metrics.samples.map((x) => x.operation),
    ['--state', '--current', '--apply-field', '--current'],
  );
});
test('device failure rejects queued writes without replay and next explicit request starts fresh host', async (t) => {
  const host = client();
  t.after(() => host.stop());
  await host.request('--state');
  const failure = host.request('--apply-field', { fail: true, delay: 10 });
  const queued = host.request('--apply-field', { value: 50 });
  const results = await Promise.allSettled([failure, queued]);
  assert(results.every((x) => x.status === 'rejected'));
  assert.equal(host.diagnostics().samples.length, 2);
  await host.request('--state');
  assert.equal(host.diagnostics().launches, 2);
});
test('timeout drops pending and queued work without retry', async (t) => {
  const host = client(30);
  t.after(() => host.stop());
  const results = await Promise.allSettled([
    host.request('--apply-field', { hang: true }),
    host.request('--apply-field', { value: 2 }),
  ]);
  assert(results.every((x) => x.status === 'rejected'));
  assert.equal(host.diagnostics().launches, 1);
  assert.equal(host.diagnostics().queued, 0);
});
test('stale response cannot complete a later request', async (t) => {
  const host = client();
  t.after(() => host.stop());
  await assert.rejects(host.request('--state', { stale: true }), /Stale or unsolicited/);
  await host.request('--state');
  assert.equal(host.diagnostics().launches, 2);
});
test('crash rejects the active request; stop cancels queued requests', async (t) => {
  const host = client();
  t.after(() => host.stop());
  await assert.rejects(host.request('--state', { crash: true }), /exited/);
  const a = host.request('--state', { hang: true });
  const b = host.request('--apply-field', { value: 4 });
  host.stop('cancelled');
  const results = await Promise.allSettled([a, b]);
  assert(results.every((x) => x.status === 'rejected'));
});
test('queue and request sizes are bounded before transmission', async (t) => {
  const host = client(1000, 100);
  t.after(() => host.stop());
  const requests = Array.from({ length: 32 }, () => host.request('--state'));
  await assert.rejects(host.request('--state'), /queue is full/);
  host.stop();
  await Promise.allSettled(requests);
  await assert.rejects(host.request('--state', { text: 'x'.repeat(1048576) }), /too large/);
  await assert.rejects(host.request('--raw-packet'), /Unsupported/);
});
