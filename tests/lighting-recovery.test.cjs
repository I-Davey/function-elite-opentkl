const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const settings = require('../dist/backend/settings-lighting.cjs');
const reader = require('../dist/backend/profile-reader.cjs');

test('lighting recovery reloads malformed RAM and verifies an uncertain onboard write', async () => {
  const directory = fs.mkdtempSync(path.resolve('.build/lighting-recovery-'));
  const originalRead = reader.read;
  const solid = '01' + '00'.repeat(18) + 'ff0000';
  let data = 'ff', reloads = 0, writes = 0;
  const backend = {
    connection: async () => ({ activeProfileIndex: 3 }),
    lighting: async () => ({
      activeProfileIndex: 3,
      profiles: [{ wireIndex: 3, layers: [{ kind: 'Base', data }] }],
    }),
    applyLighting: async (request) => {
      assert.equal(request.expectedData, solid);
      assert.equal(request.data, solid);
      writes++;
      data = 'ff';
      return { outcome: 'uncertain', error: 'Lighting readback mismatch' };
    },
  };
  reader.read = async (_profile, actualBackend) => {
    assert.equal(actualBackend, backend);
    reloads++;
    data = solid;
  };
  try {
    const result = await settings.applyLightingRaw(
      directory, { wireIndex: 3, layer: 'Base', data: solid }, backend,
    );
    assert.equal(result.outcome, 'applied');
    assert.equal(result.verification, 'effect-and-physical-LEDs');
    assert.equal(reloads, 2);
    assert.equal(writes, 1);
    await assert.rejects(settings.applyLightingRaw(
      directory, { wireIndex: 3, layer: 'Base', data: 'ff' }, backend,
    ));
    assert.equal(writes, 1);
  } finally {
    reader.read = originalRead;
  }
});

test('lighting recovery never accepts a different observed color', async () => {
  const directory = fs.mkdtempSync(path.resolve('.build/lighting-recovery-'));
  const originalRead = reader.read;
  const mask = '00'.repeat(18);
  const desired = '01' + mask + 'ff0000';
  const observed = '01' + mask + '0000ff';
  let writes = 0;
  const backend = {
    connection: async () => ({ activeProfileIndex: 3 }),
    lighting: async () => ({
      activeProfileIndex: 3,
      profiles: [{ wireIndex: 3, layers: [{ kind: 'Base', data: observed }] }],
    }),
    applyLighting: async () => {
      writes++;
      return { outcome: 'uncertain', error: 'Lighting readback mismatch' };
    },
  };
  reader.read = async () => {};
  try {
    await assert.rejects(settings.applyLightingRaw(
      directory, { wireIndex: 3, layer: 'Base', data: desired }, backend,
    ), /Lighting readback mismatch/);
    assert.equal(writes, 1);
  } finally {
    reader.read = originalRead;
  }
});
