import type * as C from './contracts.cjs';
import { asError, required, readJson } from './validation.cjs';
import * as transaction_journalModule from './transaction-journal.cjs';
import * as snapModule from './snap.cjs';
import * as deviceBackend from './devices.cjs';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const { durable } = transaction_journalModule;
async function applySnapRaw(
  profile: string,
  input: C.SnapRawInput,
  backend: C.DeviceBackend = deviceBackend,
) {
  if (
    !input ||
    Object.keys(input).length !== 2 ||
    !Number.isInteger(input.wireIndex) ||
    input.wireIndex < 0 ||
    input.wireIndex > 4 ||
    typeof input.data !== 'string' ||
    !/^[0-9a-f]{30}$/.test(input.data)
  )
    throw Error('Invalid snap edit');
  const before = await backend.snap(input.wireIndex),
    old = snapModule.decode(before).find((p) => p.wireIndex === input.wireIndex);
  const request = {
    ...input,
    data: snapModule.normalize(input.data),
    expectedActive: before.activeProfileIndex,
    expectedData: required(old).data,
  };
  const id =
    new Date().toISOString().replaceAll(':', '-') + '-' + crypto.randomBytes(4).toString('hex');
  fs.mkdirSync(path.join(profile, 'device-edits'), { recursive: true });
  const backup = 'device-edits/' + id + '-snap-before.json',
    receipt = 'device-edits/' + id + '-snap-result.json';
  durable(path.join(profile, backup), { kind: 'snap', schemaVersion: 1, request, before });
  let result;
  try {
    result = snapModule.normalize(request.expectedData) === request.data
      ? { outcome: 'unchanged' as const, mutationAttempted: false }
      : await backend.applySnap(request);
  } catch (caught) {
    const error = asError(caught);
    durable(path.join(profile, receipt), { outcome: 'unknown', error: error.message, backup });
    throw Error(error.message + '; saved backup: ' + backup);
  }
  durable(path.join(profile, receipt), { ...result, backup });
  if (!['applied', 'unchanged'].includes(result.outcome))
    throw Error((result.error || 'Snap readback failed') + '; saved backup: ' + backup);
  return { ...result, backup, receipt };
}
async function applySnap(
  profile: string,
  input: C.SnapInput,
  backend: C.DeviceBackend = deviceBackend,
) {
  if (!input || Object.keys(input).length !== 2 || !Object.hasOwn(input, 'configs'))
    throw Error('Invalid snap configuration');
  return applySnapRaw(
    profile,
    { wireIndex: input.wireIndex, data: snapModule.encode(input.configs) },
    backend,
  );
}
async function restoreSnap(
  profile: string,
  backup: string,
  backend: C.DeviceBackend = deviceBackend,
) {
  if (typeof backup !== 'string' || !/^device-edits\/[\w.-]+-snap-before\.json$/.test(backup))
    throw Error('Invalid snap backup');
  const { request } = readJson<C.Backup<C.SnapRequest, C.SnapSnapshot>>(
    fs.readFileSync(path.join(profile, backup), 'utf8'),
  );
  return applySnapRaw(
    profile,
    { wireIndex: request.wireIndex, data: request.expectedData },
    backend,
  );
}

export { applySnap, applySnapRaw, restoreSnap };
