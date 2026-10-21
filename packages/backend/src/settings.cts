/** Public settings API owns Snap ordering; leaf transactions retain independent journals. */
import fs from 'node:fs';
import path from 'node:path';
import type * as C from './contracts.cjs';
import { readJson } from './validation.cjs';
import * as leaf from './setting-transactions.cjs';
import * as snapGuard from './snap-guard.cjs';
import * as snap from './snap.cjs';
import * as deviceBackend from './devices.cjs';
export {
  apply,
  restore,
  validate,
  applyLighting,
  applyLightingRaw,
  restoreLighting,
  applyRemapRaw,
  applySnapRaw,
  restoreSnap,
} from './setting-transactions.cjs';
export function applyActuation(
  profile: string,
  input: C.ActuationInput,
  backend: C.DeviceBackend = deviceBackend,
): Promise<C.ActuationResult> {
  return snapGuard.edit(
    profile,
    input,
    () => leaf.applyActuation(profile, input, backend),
    leaf,
    backend,
  );
}
export function applyRemap(
  profile: string,
  input: C.RemapInput,
  backend: C.DeviceBackend = deviceBackend,
): Promise<C.EditResult> {
  return snapGuard.edit(
    profile,
    input,
    () => leaf.applyRemap(profile, input, backend),
    leaf,
    backend,
  );
}
async function restoreGuarded(
  profile: string,
  backup: string,
  operation: (profile: string, backup: string, backend: C.DeviceBackend) => Promise<C.EditResult>,
  backend: C.DeviceBackend,
): Promise<C.EditResult> {
  if (
    typeof backup !== 'string' ||
    !/^device-edits\/[\w.-]+-(actuation|remap)-before\.json$/.test(backup)
  )
    throw Error('Invalid key edit backup');
  const saved = readJson<C.Backup<C.ActuationRequest | C.RemapRequest, unknown>>(
    fs.readFileSync(path.join(profile, backup), 'utf8'),
  );
  const result = await snapGuard.edit(
    profile,
    { wireIndex: saved.request.wireIndex },
    () => operation(profile, backup, backend),
    leaf,
    backend,
  );
  if (saved.snapBefore) {
    const configs = await snapGuard.eligible(saved.snapBefore, saved.request.wireIndex, backend);
    await leaf.applySnapRaw(
      profile,
      { wireIndex: saved.request.wireIndex, data: snap.encode(configs) },
      backend,
    );
    result.snapConfigs = configs;
  }
  return result;
}
export function restoreActuation(
  profile: string,
  backup: string,
  backend: C.DeviceBackend = deviceBackend,
) {
  return restoreGuarded(profile, backup, leaf.restoreActuation, backend);
}
export function restoreRemap(
  profile: string,
  backup: string,
  backend: C.DeviceBackend = deviceBackend,
) {
  return restoreGuarded(profile, backup, leaf.restoreRemap, backend);
}
export async function applySnap(
  profile: string,
  input: C.SnapInput,
  backend: C.DeviceBackend = deviceBackend,
) {
  if (!input || Object.keys(input).length !== 2 || !Object.hasOwn(input, 'configs'))
    throw Error('Invalid snap configuration');
  snap.encode(input.configs);
  const configs = await snapGuard.eligible(input.configs, input.wireIndex, backend);
  return {
    ...(await leaf.applySnap(profile, { ...input, configs }, backend)),
    snapConfigs: configs,
  };
}
