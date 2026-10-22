import type * as C from './contracts.cjs';
import { asError, required, readJson } from './validation.cjs';
import * as transaction_journalModule from './transaction-journal.cjs';
import * as lightingModule from './lighting.cjs';
import * as deviceBackend from './devices.cjs';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const { durable } = transaction_journalModule;
async function applyLightingRaw(
  profile: string,
  input: C.LightingRawInput,
  backend: C.DeviceBackend = deviceBackend,
) {
  if (
    !input ||
    !Number.isInteger(input.wireIndex) ||
    input.wireIndex < 0 ||
    input.wireIndex > 4 ||
    !['Base', 'Ring', 'Reactive'].includes(input.layer)
  )
    throw Error('Invalid lighting transaction');
  lightingModule.records(input.data, input.layer);
  const before = await backend.lighting(input.wireIndex);
  const selectedLayer = (snapshot: C.LightingSnapshot) =>
    required(
      required(snapshot.profiles.find((p) => p.wireIndex === input.wireIndex)).layers.find(
        (l) => l.kind === input.layer,
      ),
    );
  lightingModule.records(selectedLayer(before).data, input.layer);
  const layer = selectedLayer(before);
  const request = {
    wireIndex: input.wireIndex,
    layer: input.layer,
    expectedActive: before.activeProfileIndex,
    expectedData: layer.data,
    data: input.data,
  };
  const id =
    new Date().toISOString().replaceAll(':', '-') + '-' + crypto.randomBytes(4).toString('hex');
  const directory = path.join(profile, 'device-edits');
  fs.mkdirSync(directory, { recursive: true });
  const backup = 'device-edits/' + id + '-lighting-before.json',
    receipt = 'device-edits/' + id + '-lighting-result.json';
  durable(path.join(profile, backup), {
    kind: 'lighting',
    schemaVersion: 1,
    at: new Date().toISOString(),
    request,
    before,
  });
  let result;
  try {
    result = await backend.applyLighting(request);
  } catch (caught) {
    const error = asError(caught);
    durable(path.join(profile, receipt), { outcome: 'unknown', error: error.message, backup });
    throw Error(error.message + '; saved backup: ' + backup);
  }
  if (result.outcome === 'uncertain') {
    const observed = await backend.lighting(input.wireIndex),
      data = required(
        required(observed.profiles.find((p) => p.wireIndex === input.wireIndex)).layers.find(
          (l) => l.kind === input.layer,
        ),
      ).data;
    if (
      observed.activeProfileIndex === request.expectedActive &&
      lightingModule.equivalent(input.data, data, input.layer)
    )
      result = {
        ...result,
        outcome: 'applied',
        verification: 'effect-and-physical-LEDs',
        normalizedUnusedMaskBits: input.data !== data,
        readbackNote: result.error,
        error: undefined,
      };
  }
  durable(path.join(profile, receipt), { ...result, backup });
  if (!['applied', 'unchanged'].includes(result.outcome))
    throw Error((result.error || 'Lighting readback failed') + '; saved backup: ' + backup);
  return { ...result, backup, receipt };
}
async function restoreLighting(
  profile: string,
  backup: string,
  backend: C.DeviceBackend = deviceBackend,
) {
  if (typeof backup !== 'string' || !/^device-edits\/[\w.-]+-lighting-before\.json$/.test(backup))
    throw Error('Invalid lighting backup');
  const saved = readJson<C.Backup<C.LightingRequest, C.LightingSnapshot>>(
    fs.readFileSync(path.join(profile, backup), 'utf8'),
  );
  return applyLightingRaw(
    profile,
    {
      wireIndex: saved.request.wireIndex,
      layer: saved.request.layer,
      data: saved.request.expectedData,
    },
    backend,
  );
}
async function applyLighting(
  profile: string,
  input: C.LightingInput,
  backend: C.DeviceBackend = deviceBackend,
) {
  if (
    !input ||
    Object.keys(input).length !== 3 ||
    !['wireIndex', 'layer', 'zones'].every((key) => Object.hasOwn(input, key))
  )
    throw Error('Invalid lighting edit');
  return applyLightingRaw(
    profile,
    {
      wireIndex: input.wireIndex,
      layer: input.layer,
      data: lightingModule.encodeZones(input.zones, input.layer),
    },
    backend,
  );
}

export { applyLighting, applyLightingRaw, restoreLighting };
