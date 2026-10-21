const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const snap = require('../dist/backend/snap.cjs');
const settings = require('../dist/backend/settings-snap.cjs');

test('Snap comparison ignores disabled padding, preserves enabled pairs and avoids redundant writes', async () => {
  const stale = '000000707000000070700000003133';
  const empty = '00'.repeat(15);
  assert.equal(snap.normalize(stale), empty);
  const enabled = '0100003133' + '00'.repeat(10);
  assert.equal(snap.normalize(enabled), enabled);
  assert.notEqual(snap.normalize(enabled), snap.normalize('0100003134' + '00'.repeat(10)));
  assert.throws(() => snap.normalize('ff'));
  let writes = 0;
  const backend = {
    snap: async () => ({
      activeProfileIndex: 3,
      profiles: [{ wireIndex: 3, response: '010303' + stale }],
    }),
    applySnap: async (request) => {
      writes++;
      assert.equal(request.expectedData, stale);
      assert.equal(request.data, enabled);
      return { outcome: 'applied' };
    },
  };
  const directory = fs.mkdtempSync(path.resolve('.build/snap-normalization-'));
  const unchanged = await settings.applySnapRaw(directory, { wireIndex: 3, data: empty }, backend);
  assert.equal(unchanged.outcome, 'unchanged');
  assert.equal(writes, 0);
  assert(fs.existsSync(path.join(directory, unchanged.backup)));
  const changed = await settings.applySnapRaw(directory, { wireIndex: 3, data: enabled }, backend);
  assert.equal(changed.outcome, 'applied');
  assert.equal(writes, 1);
});
