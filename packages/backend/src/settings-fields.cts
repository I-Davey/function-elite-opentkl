import type * as C from './contracts.cjs';
import { asError, required, readJson } from './validation.cjs';
import * as transaction_journalModule from './transaction-journal.cjs';
import * as stateModule from './state.cjs';
import * as deviceBackend from './devices.cjs';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const { durable } = transaction_journalModule;
const fields: Readonly<
  Record<
    C.Field,
    { max: number; channel?: number; key?: keyof C.ProfileMetadata; active?: boolean }
  >
> = Object.freeze({
  brightnessKeys: { max: 100, channel: 0 },
  brightnessRing: { max: 100, channel: 1 },
  pollingRate: { max: 6, key: 'field0' },
  gameMode: { max: 1, key: 'field3' },
  fnLock: { max: 1, key: 'field4' },
  idleMinutes: { max: 100, key: 'field5' },
  activeProfile: { max: 4, active: true },
});
function validate(input: C.FieldEdit) {
  if (
    !input ||
    typeof input !== 'object' ||
    Object.keys(input).some((k) => !['field', 'wireIndex', 'value'].includes(k)) ||
    Object.keys(input).length !== 3
  )
    throw Error('Invalid setting request');
  const spec = fields[input.field];
  if (
    !spec ||
    !Number.isInteger(input.wireIndex) ||
    input.wireIndex < 0 ||
    input.wireIndex > 4 ||
    !Number.isInteger(input.value) ||
    input.value < 0 ||
    input.value > spec.max
  )
    throw Error('Setting outside keyboard capability');
  return spec;
}
/** Back up exactly the field to be changed, then use a native compare-and-set.
 * No retries: an ambiguous write is recorded and must be read again explicitly. */
async function apply(
  profile: string,
  input: C.FieldEdit,
  backend: C.DeviceBackend = deviceBackend,
) {
  const spec = validate(input),
    before = spec.active || spec.channel !== undefined ? await backend.connection() : await backend.state(input.wireIndex);
  if ('profiles' in before) stateModule.decode({ ...before, activeProfileIndex: input.wireIndex }, before.profiles.length === 1);
  const previous = spec.active
    ? before.activeProfileIndex
    : spec.channel === undefined
      ? required(('profiles' in before ? before.profiles : []).find((p) => p.wireIndex === input.wireIndex))[required(spec.key)]
      : before.brightnessChannels[spec.channel];
  if (spec.channel !== undefined && input.wireIndex !== before.activeProfileIndex)
    throw Error('Brightness belongs to the active hardware slot; refresh first');
  const request = { ...input, expectedActive: before.activeProfileIndex, expectedValue: previous };
  // Selecting an existing slot changes no stored profile contents.
  if(spec.active){
    const result=await backend.applyField(request);
    if(!['applied','unchanged'].includes(result.outcome))throw Error(result.error||'Profile selection could not be verified');
    return {...result,backup:''};
  }
  const id =
    new Date().toISOString().replaceAll(':', '-') + '-' + crypto.randomBytes(4).toString('hex');
  const directory = path.join(profile, 'device-edits');
  fs.mkdirSync(directory, { recursive: true });
  const backup = 'device-edits/' + id + '-before.json',
    receipt = 'device-edits/' + id + '-result.json';
  durable(path.join(profile, backup), {
    schemaVersion: 1,
    at: new Date().toISOString(),
    request,
    before,
    completeProfile: false,
    scope: 'Single scalar field; other settings not changed',
  });
  let result;
  try {
    result = await backend.applyField(request);
  } catch (caught) {
    const error = asError(caught);
    durable(path.join(profile, receipt), { outcome: 'unknown', error: error.message, backup });
    throw Error(error.message + '; saved backup: ' + backup);
  }
  durable(path.join(profile, receipt), { ...result, backup });
  if (!['applied', 'unchanged'].includes(result.outcome))
    throw Error(
      (result.error || 'Device setting could not be verified') + '; saved backup: ' + backup,
    );
  return { ...result, backup, receipt };
}
async function restore(profile: string, backup: string, backend: C.DeviceBackend = deviceBackend) {
  if (typeof backup !== 'string' || !/^device-edits\/[\w.-]+-before\.json$/.test(backup))
    throw Error('Invalid device-edit backup');
  const saved = readJson<C.Backup<C.FieldRequest, C.DeviceState>>(
    fs.readFileSync(path.join(profile, backup), 'utf8'),
  );
  const request = saved.request;
  validate({ field: request.field, wireIndex: request.wireIndex, value: request.expectedValue });
  return apply(
    profile,
    { field: request.field, wireIndex: request.wireIndex, value: request.expectedValue },
    backend,
  );
}

export { apply, restore, validate };
