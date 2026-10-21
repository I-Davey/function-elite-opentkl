import type * as C from './contracts.cjs';
import { asError, required, readJson } from './validation.cjs';
import * as transaction_journalModule from './transaction-journal.cjs';
import * as remapsModule from './remaps.cjs';
import * as deviceBackend from './devices.cjs';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const { durable } = transaction_journalModule;
async function applyRemapRaw(
  profile: string,
  input: C.RemapRawInput,
  backend: C.DeviceBackend = deviceBackend,
) {
  const allowed = ['wireIndex', 'physicalKey', 'level', 'fnLayer', 'data'];
  if (
    !input ||
    Object.keys(input).length !== 5 ||
    Object.keys(input).some((k) => !allowed.includes(k)) ||
    ![0, 1].includes(input.level) ||
    typeof input.fnLayer !== 'boolean' ||
    !Number.isInteger(input.wireIndex) ||
    input.wireIndex < 0 ||
    input.wireIndex > 4 ||
    !remapsModule.physicalToWire.has(input.physicalKey) ||
    typeof input.data !== 'string' ||
    !/^(?:[0-9a-f]{2})*$/.test(input.data)
  )
    throw Error('Invalid remap edit');
  const before = await backend.remaps({
    wireIndex: input.wireIndex,
    physicalKeys: [input.physicalKey],
  });
  const old = required(
    before.records.find((r) => r.level === input.level && r.fnLayer === input.fnLayer),
  );
  const request = { ...input, expectedActive: before.activeProfileIndex, expectedData: old.data };
  const id =
    new Date().toISOString().replaceAll(':', '-') + '-' + crypto.randomBytes(4).toString('hex');
  fs.mkdirSync(path.join(profile, 'device-edits'), { recursive: true });
  const backup = 'device-edits/' + id + '-remap-before.json',
    receipt = 'device-edits/' + id + '-remap-result.json';
  durable(path.join(profile, backup), { kind: 'remap', schemaVersion: 1, request, before });
  let result;
  try {
    result = await backend.applyRemap(request);
  } catch (caught) {
    const error = asError(caught);
    durable(path.join(profile, receipt), { outcome: 'unknown', error: error.message, backup });
    throw Error(error.message + '; saved backup: ' + backup);
  }
  durable(path.join(profile, receipt), { ...result, backup });
  if (!['applied', 'unchanged'].includes(result.outcome))
    throw Error((result.error || 'Remap readback failed') + '; saved backup: ' + backup);
  return { ...result, backup, receipt };
}
async function applyRemap(
  profile: string,
  input: C.RemapInput,
  backend: C.DeviceBackend = deviceBackend,
) {
  if (
    !input ||
    Object.keys(input).length !== 5 ||
    !['wireIndex', 'physicalKey', 'level', 'fnLayer', 'remap'].every((k) => Object.hasOwn(input, k))
  )
    throw Error('Invalid remap request');
  const { remap, ...rest } = input;
  return applyRemapRaw(
    profile,
    { ...rest, data: remapsModule.encode(remap, input.physicalKey) },
    backend,
  );
}
async function restoreRemap(
  profile: string,
  backup: string,
  backend: C.DeviceBackend = deviceBackend,
) {
  if (typeof backup !== 'string' || !/^device-edits\/[\w.-]+-remap-before\.json$/.test(backup))
    throw Error('Invalid remap backup');
  const { request } = readJson<C.Backup<C.RemapRequest, C.RemapSnapshot>>(
    fs.readFileSync(path.join(profile, backup), 'utf8'),
  );
  return applyRemapRaw(
    profile,
    {
      wireIndex: request.wireIndex,
      physicalKey: request.physicalKey,
      level: request.level,
      fnLayer: request.fnLayer,
      data: request.expectedData,
    },
    backend,
  );
}

export { applyRemap, applyRemapRaw, restoreRemap };
