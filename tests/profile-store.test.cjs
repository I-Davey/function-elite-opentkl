const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ProfileStore } = require('../dist/app/main/profile-store.cjs');
const root = path.resolve(__dirname, '../data/checks');
fs.mkdirSync(root, { recursive: true });
const sample = {
  schemaVersion: 1,
  keyboard: { activeProfileId: 'local', softwareProfiles: [] },
  remap: {},
  keyBrightness: 0.5,
};
test('profile replacement preserves previous data and rejects invalid schemas before writing', () => {
  const dir = fs.mkdtempSync(path.join(root, 'store-'));
  const store = new ProfileStore(dir);
  store.write(sample);
  store.write({ ...sample, keyBrightness: 0.6 });
  assert.equal(store.read().keyBrightness, 0.6);
  assert.equal(JSON.parse(fs.readFileSync(store.file + '.bak')).keyBrightness, 0.5);
  assert.throws(() => store.write({ ...sample, schemaVersion: 99 }), /schema/);
  assert.equal(store.read().keyBrightness, 0.6);
  assert(fs.existsSync(path.join(dir, store.checkpoint())));
});
test('corrupt saved data produces a recovery error and is never silently reset', () => {
  const dir = fs.mkdtempSync(path.join(root, 'corrupt-'));
  const store = new ProfileStore(dir);
  fs.writeFileSync(store.file, '{broken');
  assert.throws(() => store.read(), /recovery required/);
  assert.equal(fs.readFileSync(store.file, 'utf8'), '{broken');
});
test('restoring an empty original document cannot leave orphaned profile-library metadata', () => {
  const dir=fs.mkdtempSync(path.join(root,'empty-')),store=new ProfileStore(dir);
  store.write(sample);
  store.writeExtra('profileLibrary',{automatic:false,pinned:false,defaultProfileId:'hardware-0',associations:{},names:{}});
  store.write({});
  assert.deepEqual(store.read(),{});
  assert.deepEqual(JSON.parse(fs.readFileSync(store.file,'utf8')),{});
});
