import type * as C from './contracts.cjs';
import { asError, required, readJson } from './validation.cjs';
import * as remapsModule from './remaps.cjs';
import * as snapModule from './snap.cjs';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const snap = snapModule,
  remaps = remapsModule;
function eligibleModels(configs: C.SnapConfig[], physicalKeys: C.KeyModel[]) {
  snap.encode(configs);
  const allowed = new Set(
    physicalKeys
      .filter(
        (key) =>
          key.active?.kind === 'Single' &&
          !Array.isArray(key.active.remapTo) &&
          (key.active.remapTo?.kind === 'Macro' ||
            (key.active.remapTo?.kind === 'SimpleRemap' &&
              key.active.remapTo.targetKeyId === key.physicalKey)),
      )
      .map((key) => key.physicalKey),
  );
  return configs.filter((c) => allowed.has(c.physicalKey1) && allowed.has(c.physicalKey2));
}
/** CAM permits Snap Overrides only on Single/Rapid keys whose base mapping is
 * identity or a macro. Fn remaps do not affect eligibility. */
async function eligible(configs: C.SnapConfig[], slot: number, backend: C.DeviceBackend) {
  if (!configs.length) return [];
  const state = await backend.actuation();
  if (state.activeProfileIndex !== slot)
    throw Error('Select the profile before configuring Snap Overrides');
  const ids = [...new Set(configs.flatMap((c) => [c.physicalKey1, c.physicalKey2]))],
    allowed = new Set();
  for (let i = 0; i < ids.length; i += 4) {
    const result = await backend.remaps({ wireIndex: slot, physicalKeys: ids.slice(i, i + 4) });
    if (result.activeProfileIndex !== slot) throw Error('Profile changed during Snap validation');
    for (const key of ids.slice(i, i + 4)) {
      const config = state.actuations.find((a) => a.physicalKey === key)?.config;
      const record = required(
        result.records.find((r) => r.physicalKey === key && r.level === 0 && !r.fnLayer),
      );
      if (!record) throw Error('Incomplete Snap key mapping');
      const target = remaps.decode(record.data, key);
      if (
        ['Single', 'Rapid'].includes(config?.kind ?? '') &&
        (target.kind === 'Macro' || (target.kind === 'SimpleRemap' && target.targetKeyId === key))
      )
        allowed.add(key);
    }
  }
  return configs.filter((c) => allowed.has(c.physicalKey1) && allowed.has(c.physicalKey2));
}
/** Clear pairs before an edit as CAM does, then reapply only compatible pairs.
 * The outer journal exists before the clear; child operations retain their own
 * before/after records. Failed operations keep explicit recovery evidence. */
async function edit<T extends C.EditResult>(
  profile: string,
  input: { wireIndex: number },
  operation: () => Promise<T>,
  settings: {
    applySnapRaw: (
      profile: string,
      input: C.SnapRawInput,
      backend: C.DeviceBackend,
    ) => Promise<C.EditResult>;
  },
  backend: C.DeviceBackend,
): Promise<T> {
  const previous = snap.decode(await backend.snap()).find((p) => p.wireIndex === input.wireIndex);
  if (!previous) throw Error('Snap profile missing');
  if (!previous.configs.length) return operation();
  const id =
    new Date().toISOString().replaceAll(':', '-') + '-' + crypto.randomBytes(4).toString('hex');
  const journal = 'device-edits/' + id + '-snapguard-before.json';
  fs.mkdirSync(path.join(profile, 'device-edits'), { recursive: true });
  fs.writeFileSync(
    path.join(profile, journal),
    JSON.stringify(
      { kind: 'snap-guard', wireIndex: input.wireIndex, snapBefore: previous.configs, input },
      null,
      2,
    ),
    { flag: 'wx' },
  );
  await settings.applySnapRaw(
    profile,
    { wireIndex: input.wireIndex, data: snap.encode([]) },
    backend,
  );
  try {
    const result = await operation(),
      next = await eligible(previous.configs, input.wireIndex, backend);
    await settings.applySnapRaw(
      profile,
      { wireIndex: input.wireIndex, data: snap.encode(next) },
      backend,
    );
    const original = result.batches?.[0] || result,
      saved = readJson<
        C.Backup<C.ActuationRequest | C.RemapRequest, C.ActuationSnapshot | C.RemapSnapshot>
      >(fs.readFileSync(path.join(profile, original.backup), 'utf8'));
    const suffix = saved.kind === 'actuation' ? 'actuation' : 'remap',
      backup = 'device-edits/' + id + '-guarded-' + suffix + '-before.json';
    fs.writeFileSync(
      path.join(profile, backup),
      JSON.stringify({ ...saved, snapBefore: previous.configs, snapJournal: journal }, null, 2),
      { flag: 'wx' },
    );
    if (result.batches) {
      result.batches[0] = { ...original, backup };
      if (result.batches.length === 1) result.backup = backup;
    } else result.backup = backup;
    return { ...result, snapConfigs: next, snapJournal: journal };
  } catch (caught) {
    const error = asError(caught);
    // Inspect actual state after a failed/partial edit before restoring pairs.
    try {
      const next = await eligible(previous.configs, input.wireIndex, backend);
      await settings.applySnapRaw(
        profile,
        { wireIndex: input.wireIndex, data: snap.encode(next) },
        backend,
      );
    } catch (caughtRecovery) {
      const recovery = asError(caughtRecovery);
      throw Error(
        error.message + '; Snap recovery requires attention: ' + recovery.message + '; ' + journal,
      );
    }
    throw Error(error.message + '; Snap recovery journal: ' + journal);
  }
}
export { eligible, eligibleModels, edit };
