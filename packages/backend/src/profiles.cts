import type * as C from './contracts.cjs';
import { asError, required, readJson } from './validation.cjs';
import * as lightingModule from './lighting.cjs';
import * as remapsModule from './remaps.cjs';
import * as snapModule from './snap.cjs';
import * as snap_guardModule from './snap-guard.cjs';
import * as settingsModule from './settings.cjs';
import * as deviceBackend from './devices.cjs';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const edits = settingsModule,
  remaps = remapsModule,
  lighting = lightingModule,
  snap = snapModule;
const rates = ['Hz8000', 'Hz4000', 'Hz2000', 'Hz1000', 'Hz500', 'Hz250', 'Hz125'];
/** Validate an entire profile before its first device write. The UI's existing
 * Save to Onboard action supplies snapshots of the original CAM models. */
function plan(input: C.ProfileInput, software = false): C.ProfilePlan {
  if (
    !input ||
    Object.keys(input).length !== 4 ||
    !Number.isInteger(input.wireIndex) ||
    input.wireIndex < 0 ||
    input.wireIndex > (software ? 4 : 3) ||
    !Array.isArray(input.physicalKeys) ||
    input.physicalKeys.length < 88 ||
    input.physicalKeys.length > 90
  )
    throw Error('Incomplete hardware profile');
  const settings = input.settings,
    rate = rates.indexOf(settings.pollingRate),
    idle = settings.idleTimeout;
  if (
    rate < 0 ||
    typeof settings.gameModeEnabled !== 'boolean' ||
    typeof settings.fnLockEnabled !== 'boolean' ||
    !idle ||
    typeof idle.disabled !== 'boolean' ||
    !Number.isFinite(idle.timeoutSeconds)
  )
    throw Error('Invalid profile performance settings');
  const idleMinutes = idle.disabled ? 0 : Math.ceil(idle.timeoutSeconds / 60);
  if (idleMinutes < 0 || idleMinutes > 100) throw Error('Invalid profile idle timeout');
  const brightness:[C.Field,number][]=[];
  for(const [key,field] of [['keyBrightness','brightnessKeys'],['perimeterBrightness','brightnessRing']] as const){
    const value=settings[key];if(value===undefined)continue;
    if(!Number.isFinite(value)||value<0||value>1)throw Error('Invalid profile brightness');
    brightness.push([field,Math.round(value*100)]);
  }
  const layers = (
    [
      ['Base', 'baseZones'],
      ['Ring', 'perimeterZones'],
      ['Reactive', 'reactiveZones'],
    ] as const
  ).map(([layer, name]) => ({ layer, data: lighting.encodeZones(settings[name], layer) }));
  const keys: C.ActuationEdit[] = [],
    records: C.RemapRecord[] = [],
    seen = new Set();
  for (const key of input.physicalKeys) {
    if (!remaps.physicalToWire.has(key.physicalKey) && [50, 100].includes(key.physicalKey))
      continue;
    if (!remaps.physicalToWire.has(key.physicalKey) || seen.has(key.physicalKey))
      throw Error('Missing/duplicate profile key');
    seen.add(key.physicalKey);
    const active = key.active,
      a = active?.actuation;
    if (!['Single', 'Dual'].includes(active?.kind) || !a) throw Error('Invalid profile actuation');
    const config: C.ActuationEdit = {
      physicalKey: key.physicalKey,
      kind: active.kind === 'Dual' ? 'Dual' : a.isRapidTrigger ? 'Rapid' : 'Single',
      levelIndex: required(a.level ?? a.level1),
      secondLevelIndex: a.level2 ?? 0,
      rapidSensitivityIndex: a.rapidSensitivity ?? 0,
    };
    for (const field of ['levelIndex', 'secondLevelIndex', 'rapidSensitivityIndex'] as const)
      if (!Number.isInteger(config[field]) || config[field] < 0 || config[field] > 39)
        throw Error('Invalid profile actuation level');
    keys.push(config);
    for (const fnLayer of [false, true]) {
      const values = fnLayer ? active.fnPressed?.remapTo : active.remapTo;
      if (!values) throw Error('Incomplete Fn layer');
      const list = Array.isArray(values) ? values : [values];
      for (let level = 0; level < 2; level++) {
        const remap = list[level] || { kind: 'SimpleRemap', targetKeyId: key.physicalKey };
        records.push({
          physicalKey: key.physicalKey,
          level,
          fnLayer,
          data: remaps.encode(remap, key.physicalKey),
        });
      }
    }
  }
  if (seen.size !== 88) throw Error('Incomplete profile key layout');
  return {
    wireIndex: input.wireIndex,
    layers,
    keys,
    records,
    snap: snap.encode(snap_guardModule.eligibleModels(input.snapConfigs, input.physicalKeys)),
    fields: [
      ['pollingRate', rate],
      ['gameMode', Number(settings.gameModeEnabled)],
      ['fnLock', Number(settings.fnLockEnabled)],
      ['idleMinutes', idleMinutes],
      ...brightness,
    ],
  };
}
async function apply(
  profile: string,
  input: C.ProfileInput,
  backend: C.DeviceBackend = deviceBackend,
) {
  const proposed = plan(input),
    initial = await backend.connection(),
    originalActive = initial.activeProfileIndex,
    completed: C.CompletedEdit[] = [];
  const folder = path.join(profile, 'device-edits');
  fs.mkdirSync(folder, { recursive: true });
  const id =
      new Date().toISOString().replaceAll(':', '-') + '-' + crypto.randomBytes(4).toString('hex'),
    backup = 'device-edits/' + id + '-profile-before.json';
  let before: C.ProfileBefore;
  try {
    if (originalActive !== proposed.wireIndex) {
      const result = await edits.apply(
        profile,
        { field: 'activeProfile', wireIndex: proposed.wireIndex, value: proposed.wireIndex },
        backend,
      );
      if(result.backup) completed.push({ kind: 'field', backup: result.backup });
    }
    before = {
      state: await backend.state(proposed.wireIndex),
      lighting: await backend.lighting(proposed.wireIndex),
      actuation: await backend.actuation(),
      remaps: await remaps.readSlot(proposed.wireIndex, backend),
      snap: await backend.snap(proposed.wireIndex),
    };
    const fd = fs.openSync(path.join(profile, backup), 'wx');
    try {
      fs.writeFileSync(
        fd,
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: 'profile',
            originalActive,
            wireIndex: proposed.wireIndex,
            before,
          },
          null,
          2,
        ),
      );
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    const cleared = await edits.applySnapRaw(
      profile,
      { wireIndex: proposed.wireIndex, data: snap.encode([]) },
      backend,
    );
    completed.push({ kind: 'snap', backup: cleared.backup });
    for (const [field, value] of proposed.fields) {
      const result = await edits.apply(
        profile,
        { field, wireIndex: proposed.wireIndex, value },
        backend,
      );
      if(result.backup) completed.push({ kind: 'field', backup: result.backup });
    }
    for (const layer of proposed.layers) {
      const result = await edits.applyLightingRaw(
        profile,
        { wireIndex: proposed.wireIndex, ...layer },
        backend,
      );
      completed.push({ kind: 'lighting', backup: result.backup });
    }
    const changed = proposed.keys.filter((key) => {
      const old = required(
        before.actuation.actuations.find((k) => k.physicalKey === key.physicalKey),
      );
      return (
        old.config.kind !== key.kind ||
        old.levelIndex !== key.levelIndex ||
        (key.kind === 'Dual' && old.secondLevelIndex !== key.secondLevelIndex) ||
        (key.kind === 'Rapid' && old.rapidSensitivityIndex !== key.rapidSensitivityIndex)
      );
    });
    if (changed.length) {
      const result = await edits.applyActuation(
        profile,
        { wireIndex: proposed.wireIndex, keys: changed },
        backend,
      );
      for (const batch of result.batches)
        completed.push({ kind: 'actuation', backup: batch.backup });
    }
    for (const record of proposed.records) {
      const old = required(
        before.remaps.records.find(
          (r) =>
            r.physicalKey === record.physicalKey &&
            r.level === record.level &&
            r.fnLayer === record.fnLayer,
        ),
      );
      if (old.data === record.data) continue;
      const result = await edits.applyRemapRaw(
        profile,
        { wireIndex: proposed.wireIndex, ...record },
        backend,
      );
      completed.push({ kind: 'remap', backup: result.backup });
    }
    const result = await edits.applySnapRaw(
      profile,
      { wireIndex: proposed.wireIndex, data: proposed.snap },
      backend,
    );
    completed.push({ kind: 'snap', backup: result.backup });
    if (originalActive !== proposed.wireIndex)
      await edits.apply(
        profile,
        { field: 'activeProfile', wireIndex: originalActive, value: originalActive },
        backend,
      );
    const returned=await backend.connection();
    for(const [channel,field] of (['brightnessKeys','brightnessRing'] as const).entries())
      if(originalActive!==proposed.wireIndex && returned.brightnessChannels[channel]!==initial.brightnessChannels[channel])
        await edits.apply(profile,{field,wireIndex:originalActive,value:initial.brightnessChannels[channel]},backend);
    const receipt = 'device-edits/' + id + '-profile-result.json';
    fs.writeFileSync(
      path.join(profile, receipt),
      JSON.stringify({ outcome: 'applied', backup, completed }, null, 2),
    );
    return { outcome: 'applied', backup, receipt, completed, wireIndex: proposed.wireIndex };
  } catch (caught) {
    const error = asError(caught);
    // Reverse only transactions that returned verified receipts. An ambiguous
    // transaction is retained in its own journal for explicit recovery.
    const failures = [];
    for (const edit of [...completed].reverse())
      try {
        await restoreEdit(profile, edit, backend);
      } catch (caughtFailure) {
        const failure = asError(caughtFailure);
        failures.push(failure.message);
      }
    try {
      const connection=await backend.connection();
      if(connection.activeProfileIndex!==originalActive) await edits.apply(profile,{field:'activeProfile',wireIndex:originalActive,value:originalActive},backend);
    } catch(caughtReturn) { failures.push(asError(caughtReturn).message); }
    throw Error(
      error.message +
        (failures.length
          ? '; recovery needs attention: ' + failures.join('; ')
          : '; verified edits restored') +
        '; profile backup: ' +
        backup,
    );
  }
}
function restoreEdit(profile: string, edit: C.CompletedEdit, backend: C.DeviceBackend) {
  return {
    field: edits.restore,
    lighting: edits.restoreLighting,
    actuation: edits.restoreActuation,
    remap: edits.restoreRemap,
    snap: edits.restoreSnap,
  }[edit.kind](profile, edit.backup, backend);
}
export { plan, apply, restoreEdit };

async function restore(profile: string, backup: string, backend: C.DeviceBackend = deviceBackend) {
  if (typeof backup !== 'string' || !/^device-edits\/[\w.-]+-profile-before\.json$/.test(backup))
    throw Error('Invalid profile backup');
  const saved = readJson<{
      kind: string;
      wireIndex: number;
      originalActive: number;
      before: C.ProfileBefore;
    }>(fs.readFileSync(path.join(profile, backup), 'utf8')),
    slot = saved.wireIndex,
    before = saved.before;
  if (
    saved.kind !== 'profile' ||
    !before ||
    before.actuation.actuations.length !== 88 ||
    before.remaps.records.length !== 352
  )
    throw Error('Incomplete profile backup');
  const current = await backend.connection();
  if (current.activeProfileIndex !== slot)
    await edits.apply(profile, { field: 'activeProfile', wireIndex: slot, value: slot }, backend);
  await edits.applySnapRaw(profile, { wireIndex: slot, data: snap.encode([]) }, backend);
  const source = required(before.state.profiles.find((p) => p.wireIndex === slot));
  for (const [field, key] of [
    ['pollingRate', 'field0'],
    ['gameMode', 'field3'],
    ['fnLock', 'field4'],
    ['idleMinutes', 'field5'],
  ] as const)
    await edits.apply(profile, { field, wireIndex: slot, value: source[key] }, backend);
  for (const layer of required(before.lighting.profiles.find((p) => p.wireIndex === slot)).layers)
    await edits.applyLightingRaw(
      profile,
      { wireIndex: slot, layer: layer.kind, data: layer.data },
      backend,
    );
  const keys = before.actuation.actuations.map((k) => ({
    physicalKey: k.physicalKey,
    kind: k.config.kind,
    levelIndex: k.levelIndex,
    secondLevelIndex: k.secondLevelIndex,
    rapidSensitivityIndex: k.rapidSensitivityIndex,
  }));
  await edits.applyActuation(profile, { wireIndex: slot, keys }, backend);
  const present = await remaps.readSlot(slot, backend);
  for (const record of before.remaps.records) {
    const current = required(
      present.records.find(
        (r) =>
          r.physicalKey === record.physicalKey &&
          r.level === record.level &&
          r.fnLayer === record.fnLayer,
      ),
    );
    if (current.data !== record.data)
      await edits.applyRemapRaw(
        profile,
        {
          wireIndex: slot,
          physicalKey: record.physicalKey,
          level: record.level,
          fnLayer: record.fnLayer,
          data: record.data,
        },
        backend,
      );
  }
  await edits.applySnapRaw(
    profile,
    {
      wireIndex: slot,
      data: required(snap.decode(before.snap).find((p) => p.wireIndex === slot)).data,
    },
    backend,
  );
  for(const [channel,field] of (['brightnessKeys','brightnessRing'] as const).entries())
    await edits.apply(profile,{field,wireIndex:slot,value:before.state.brightnessChannels[channel]},backend);
  if (saved.originalActive !== slot)
    await edits.apply(
      profile,
      { field: 'activeProfile', wireIndex: saved.originalActive, value: saved.originalActive },
      backend,
    );
  return { outcome: 'restored', wireIndex: slot, backup };
}
export { restore as restore };
