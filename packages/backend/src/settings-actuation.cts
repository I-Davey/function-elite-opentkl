import type * as C from './contracts.cjs';
import { asError, required, readJson } from './validation.cjs';
import * as transaction_journalModule from './transaction-journal.cjs';
import * as deviceBackend from './devices.cjs';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const { durable } = transaction_journalModule;
async function actuationTransaction(
  profile: string,
  request: C.ActuationRequest,
  before: C.ActuationSnapshot,
  backend: C.DeviceBackend,
) {
  const id =
    new Date().toISOString().replaceAll(':', '-') + '-' + crypto.randomBytes(4).toString('hex');
  const directory = path.join(profile, 'device-edits');
  fs.mkdirSync(directory, { recursive: true });
  const backup = 'device-edits/' + id + '-actuation-before.json',
    receipt = 'device-edits/' + id + '-actuation-result.json';
  durable(path.join(profile, backup), {
    kind: 'actuation',
    schemaVersion: 1,
    at: new Date().toISOString(),
    request,
    before,
  });
  let result;
  try {
    result = await backend.applyActuation(request);
  } catch (caught) {
    const error = asError(caught);
    durable(path.join(profile, receipt), { outcome: 'unknown', error: error.message, backup });
    throw Error(error.message + '; saved backup: ' + backup);
  }
  durable(path.join(profile, receipt), { ...result, backup });
  if (result.outcome !== 'applied')
    throw Error((result.error || 'Actuation readback failed') + '; saved backup: ' + backup);
  return { ...result, backup, receipt };
}
async function applyActuation(
  profile: string,
  input: C.ActuationInput,
  backend: C.DeviceBackend = deviceBackend,
) {
  if (
    !input ||
    Object.keys(input).length !== 2 ||
    !Number.isInteger(input.wireIndex) ||
    input.wireIndex < 0 ||
    input.wireIndex > 4 ||
    !Array.isArray(input.keys) ||
    !input.keys.length ||
    input.keys.length > 88
  )
    throw Error('Invalid actuation edit');
  const before = await backend.actuation();
  if (before.activeProfileIndex !== input.wireIndex)
    throw Error('Select the active hardware profile before editing actuation');
  const ids = new Set();
  const edits = input.keys.map((key) => {
    if (
      !key ||
      Object.keys(key).length !== 5 ||
      !['Single', 'Rapid', 'Dual'].includes(key.kind) ||
      !Number.isInteger(key.physicalKey) ||
      ids.has(key.physicalKey)
    )
      throw Error('Invalid or duplicate actuation key');
    ids.add(key.physicalKey);
    for (const field of ['levelIndex', 'secondLevelIndex', 'rapidSensitivityIndex'] as const)
      if (!Number.isInteger(key[field]) || key[field] < 0 || key[field] >= 40)
        throw Error('Invalid actuation level');
    const current = required(before.actuations.find((k) => k.physicalKey === key.physicalKey));
    if (!current) throw Error('Unmapped actuation key');
    const mode = { Single: 0, Dual: 1, Rapid: 2 }[key.kind],
      rapid = key.kind === 'Rapid' ? key.rapidSensitivityIndex : (current.rawWord >>> 24) & 63,
      secondary = key.kind === 'Dual' ? key.secondLevelIndex : (current.rawWord >>> 16) & 63;
    const word =
      ((current.rawWord & 0xc0c0c0fc) |
        (rapid << 24) |
        (secondary << 16) |
        (key.levelIndex << 8) |
        mode) >>>
      0;
    return { physicalKey: key.physicalKey, expectedWord: current.rawWord, word };
  });
  const results = [];
  // A batch fits one HID report. Each batch backs up and verifies all 88 words.
  for (let index = 0; index < edits.length; index += 10) {
    const keys = edits.slice(index, index + 10);
    const snapshot = index ? await backend.actuation() : before;
    results.push(
      await actuationTransaction(
        profile,
        { wireIndex: input.wireIndex, expectedActive: input.wireIndex, keys },
        snapshot,
        backend,
      ),
    );
  }
  return {
    outcome: 'applied',
    batches: results,
    backup: required(results.at(-1)).backup,
    after: required(results.at(-1)).after,
  };
}
async function restoreActuation(
  profile: string,
  backup: string,
  backend: C.DeviceBackend = deviceBackend,
) {
  if (typeof backup !== 'string' || !/^device-edits\/[\w.-]+-actuation-before\.json$/.test(backup))
    throw Error('Invalid actuation backup');
  const saved = readJson<C.Backup<C.ActuationRequest, C.ActuationSnapshot>>(
      fs.readFileSync(path.join(profile, backup), 'utf8'),
    ),
    before = await backend.actuation();
  if (before.activeProfileIndex !== saved.request.wireIndex)
    throw Error('Select the backed-up profile before restoring actuation');
  const keys = saved.request.keys.map((key) => ({
    physicalKey: key.physicalKey,
    expectedWord: required(before.actuations.find((k) => k.physicalKey === key.physicalKey))
      .rawWord,
    word: key.expectedWord,
  }));
  return actuationTransaction(
    profile,
    { wireIndex: before.activeProfileIndex, expectedActive: before.activeProfileIndex, keys },
    before,
    backend,
  );
}

export { applyActuation, restoreActuation };
