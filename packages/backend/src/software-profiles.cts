import type * as C from './contracts.cjs';
import { asError, required, readJson } from './validation.cjs';
import * as remapsModule from './remaps.cjs';
import * as snapModule from './snap.cjs';
import * as settingsModule from './settings.cjs';
import * as profilesModule from './profiles.cjs';
import * as deviceBackend from './devices.cjs';
import { equivalent as lightingEquivalent } from './lighting.cjs';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const profiles = profilesModule,
  edits = settingsModule,
  remaps = remapsModule;
function location(profile: string) {
  return path.join(profile, 'software-session.json');
}
function save(file: string, value: C.SoftwareSession) {
  const fd = fs.openSync(file + '.tmp', 'w');
  try {
    fs.writeFileSync(fd, JSON.stringify(value, null, 2));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(file + '.tmp', file);
}
function verified(result: {outcome:string;error?:string}) {
  if (!['applied','unchanged','acknowledged'].includes(result.outcome)) throw Error(result.error || 'Software profile could not be verified');
}
/** Prepare the one original snapshot while onboard remains active; no device writes. */
async function prepare(profile: string, backend: C.DeviceBackend = deviceBackend): Promise<void> {
  if (fs.existsSync(location(profile))) return;
  const state=await backend.state();
  if(state.activeProfileIndex===4) return;
  const before={state,lighting:await backend.lighting(),remaps:await remaps.readSlot(4,backend)};
  const id=new Date().toISOString().replaceAll(':','-')+'-'+crypto.randomBytes(4).toString('hex');
  const backup='device-edits/'+id+'-software-before.json';
  const session:C.SoftwareSession={schemaVersion:1,kind:'software-session',returnSlot:state.activeProfileIndex,backup,before,prepared:true};
  fs.mkdirSync(path.join(profile,'device-edits'),{recursive:true});
  const fd=fs.openSync(path.join(profile,backup),'wx');
  try {fs.writeFileSync(fd,JSON.stringify(session));fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
  save(location(profile),session);
}
/** Software actuation is deliberately RAM-only. Stored software-slot fields are
 * backed up once per app session and restored on shutdown/recovery. Hardware
 * slots are never used as scratch space for a software profile. */
async function apply(
  profile: string,
  input: C.ProfileInput,
  backend: C.DeviceBackend = deviceBackend,
) {
  const plan = profiles.plan(input, true);
  if (plan.wireIndex !== 4) throw Error('Software profiles use slot 4');
  let session = fs.existsSync(location(profile))
    ? readJson<C.SoftwareSession>(fs.readFileSync(location(profile), 'utf8'))
    : null;
  const connection = await backend.connection();
  if (!session) {
    if (connection.activeProfileIndex === 4)
      throw Error('Select an onboard profile before starting a new software-profile session');
    await prepare(profile,backend);
    session=readJson<C.SoftwareSession>(fs.readFileSync(location(profile),'utf8'));
  }
  try {
    session.prepared=false;
    save(location(profile),session);
    const entering = connection.activeProfileIndex !== 4;
    if (entering) {
      session.returnTarget = { wireIndex: connection.activeProfileIndex, brightnessChannels: [...connection.brightnessChannels] };
      if (!validReturnTarget(session.returnTarget)) throw Error('Invalid software return target');
      save(location(profile), session);
      await edits.apply(profile, { field: 'activeProfile', wireIndex: 4, value: 4 }, backend);
    }
    if (!session.before.snap) {
      session.before.snap = await backend.snap();
      save(location(profile), session);
    }
    const previous = session.lastInput ? profiles.plan(session.lastInput, true) : undefined;
    const keysChanged = !previous || JSON.stringify(previous.keys) !== JSON.stringify(plan.keys);
    const records = previous?.records ?? session.before.remaps.records;
    const changedRecords = plan.records.filter(record => required(records.find(old => old.physicalKey === record.physicalKey && old.level === record.level && old.fnLayer === record.fnLayer)).data !== record.data);
    const snapChanged = !previous || previous.snap !== plan.snap;
    const refreshSnap = keysChanged || changedRecords.length > 0 || snapChanged;
    let currentSnap='';
    const setSnap=async(data:string)=>{
      if(snapModule.normalize(currentSnap)===snapModule.normalize(data))return;
      verified(await backend.applySnap({wireIndex:4,data,expectedActive:4,expectedData:currentSnap}));currentSnap=data;
    };
    if(refreshSnap){currentSnap=required(snapModule.decode(await backend.snap()).find(p=>p.wireIndex===4)).data;await setSnap('00'.repeat(15));}
    const metadata=required(session.before.state.profiles.find(p=>p.wireIndex===4));
    const fieldKeys={pollingRate:'field0',gameMode:'field3',fnLock:'field4',idleMinutes:'field5'} as const;
    const brightness=plan.fields.some(([field])=>field.startsWith('brightness')) ? (await backend.connection()).brightnessChannels : [];
    for (const [field, value] of plan.fields) {
      const expectedValue=field==='brightnessKeys'?brightness[0]:field==='brightnessRing'?brightness[1]:previous?.fields.find(([name])=>name===field)?.[1] ?? metadata[fieldKeys[field as keyof typeof fieldKeys]];
      if(expectedValue!==value) verified(await backend.applyField({field,wireIndex:4,value,expectedActive:4,expectedValue}));
    }
    const originalLayers=required(session.before.lighting.profiles.find(p=>p.wireIndex===4)).layers;
    const actualLighting={...session.lighting};
    for (const layer of plan.layers) {
      const expectedData=actualLighting[layer.layer] ?? previous?.layers.find(old=>old.layer===layer.layer)?.data ?? required(originalLayers.find(old=>old.kind===layer.layer)).data;
      actualLighting[layer.layer]=expectedData;
      if(!lightingEquivalent(expectedData,layer.data,layer.layer)) {
        const result=await backend.applyLighting({wireIndex:4,...layer,expectedActive:4,expectedData});
        if(result.outcome==='uncertain') {
          const observed=await backend.lighting();
          const data=required(required(observed.profiles.find(p=>p.wireIndex===4)).layers.find(item=>item.kind===layer.layer)).data;
          if(observed.activeProfileIndex!==4 || !lightingEquivalent(data,layer.data,layer.layer)) verified(result);
          actualLighting[layer.layer]=data;
        } else { verified(result); actualLighting[layer.layer]=typeof result.after==='string'?result.after:layer.data; }
      }
    }
    for (const record of changedRecords) {
      const expectedData=required(records.find(old=>old.physicalKey===record.physicalKey&&old.level===record.level&&old.fnLayer===record.fnLayer)).data;
      verified(await backend.applyRemap({wireIndex:4,...record,expectedActive:4,expectedData}));
    }
    const keys = plan.keys.map((key) => ({
      physicalKey: key.physicalKey,
      word:
        ((key.rapidSensitivityIndex << 24) |
          (key.secondLevelIndex << 16) |
          (key.levelIndex << 8) |
          { Single: 0, Dual: 1, Rapid: 2 }[key.kind]) >>>
        0,
    }));
    // Selecting slot 4 reloads stored actuation; restore our RAM table on re-entry.
    if (entering || keysChanged) {
      const actuation = await backend.applySoftwareActuation({ expectedActive: 4, keys });
      if (actuation.outcome !== 'acknowledged')
        throw Error(actuation.error || 'Software actuation not acknowledged');
    }
    if (refreshSnap) await setSnap(plan.snap);
    save(location(profile), { ...session, lighting:actualLighting, lastInput: input, at: new Date().toISOString() });
    return {
      outcome: 'acknowledged',
      backup: session.backup,
      softwareProfile: true,
      actuationReadbackAvailable: false,
      storedFieldsVerified: true,
      hardwareSlotsChanged: false,
    };
  } catch (caught) {
    const error = asError(caught);
    try {
      await release(profile, backend);
    } catch (caughtRecovery) {
      const recovery = asError(caughtRecovery);
      throw Error(error.message + '; recovery needs attention: ' + recovery.message);
    }
    throw error;
  }
}
function validReturnTarget(value: unknown): value is C.RuntimeReturnTarget {
  if (
    !value ||
    typeof value !== 'object' ||
    !('wireIndex' in value) ||
    !('brightnessChannels' in value)
  )
    return false;
  return (
    typeof value.wireIndex === 'number' &&
    Number.isInteger(value.wireIndex) &&
    value.wireIndex >= 0 &&
    value.wireIndex <= 3 &&
    Array.isArray(value.brightnessChannels) &&
    value.brightnessChannels.length === 2 &&
    value.brightnessChannels.every(
      (channel) => Number.isInteger(channel) && channel >= 0 && channel <= 100,
    )
  );
}
async function release(profile: string, backend: C.DeviceBackend = deviceBackend) {
  if (!fs.existsSync(location(profile))) return { outcome: 'unchanged' };
  const session = readJson<C.SoftwareSession>(fs.readFileSync(location(profile), 'utf8')),
    before = session.before;
  if(session.prepared){fs.unlinkSync(location(profile));return {outcome:'unchanged'};}
  // Record the return controls before any temporary selection can load stored
  // brightness. Retries retain this target instead of recapturing reset values.
  const state = await backend.state();
  if (session.releaseTarget !== undefined && !validReturnTarget(session.releaseTarget))
    throw Error('Invalid software release target');
  if (session.returnTarget !== undefined && !validReturnTarget(session.returnTarget))
    throw Error('Invalid software return target');
  if (!session.releaseTarget) {
    const target = {
      wireIndex: state.activeProfileIndex === 4 ? session.returnTarget?.wireIndex ?? session.returnSlot : state.activeProfileIndex,
      brightnessChannels:
        state.activeProfileIndex === 4 ? session.returnTarget?.brightnessChannels ?? before.state.brightnessChannels : state.brightnessChannels,
    };
    if (!validReturnTarget(target)) throw Error('Invalid software release target');
    session.releaseTarget = {
      wireIndex: target.wireIndex,
      brightnessChannels: [...target.brightnessChannels],
    };
    save(location(profile), session);
  }
  const target = session.releaseTarget,
    returnSlot = target.wireIndex;
  if (state.activeProfileIndex !== 4)
    await edits.apply(
      profile,
      { field: 'activeProfile', wireIndex: 4, value: 4 },
      backend,
    );
  // Slot 4 idle-time writes are effective only while slot 4 is active on stock firmware.
  try {
    const previous = required(before.state.profiles.find((p) => p.wireIndex === 4));
    for (const [field, key] of [
      ['pollingRate', 'field0'],
      ['gameMode', 'field3'],
      ['fnLock', 'field4'],
      ['idleMinutes', 'field5'],
    ] as const)
      await edits.apply(profile, { field, wireIndex: 4, value: previous[key] }, backend);
    for (const layer of required(before.lighting.profiles.find((p) => p.wireIndex === 4)).layers)
      await edits.applyLightingRaw(
        profile,
        { wireIndex: 4, layer: layer.kind, data: layer.data },
        backend,
      );
    const current = await remaps.readSlot(4, backend);
    for (const record of before.remaps.records) {
      const old = required(
        current.records.find(
          (r) =>
            r.physicalKey === record.physicalKey &&
            r.level === record.level &&
            r.fnLayer === record.fnLayer,
        ),
      );
      if (old.data !== record.data)
        await edits.applyRemapRaw(
          profile,
          {
            wireIndex: 4,
            physicalKey: record.physicalKey,
            level: record.level,
            fnLayer: record.fnLayer,
            data: record.data,
          },
          backend,
        );
    }
    if (before.snap) {
      const old = snapModule.decode(before.snap).find((p) => p.wireIndex === 4);
      if (!old) throw Error('Software Snap backup incomplete');
      await edits.applySnapRaw(profile, { wireIndex: 4, data: old.data }, backend);
    }
  } finally {
    if ((await backend.connection()).activeProfileIndex !== returnSlot)
      await edits.apply(
        profile,
        { field: 'activeProfile', wireIndex: returnSlot, value: returnSlot },
        backend,
      );
    const returned = await backend.connection();
    if (returned.activeProfileIndex !== returnSlot)
      throw Error('Software release did not restore its target profile');
    for (const [channel, field] of (['brightnessKeys', 'brightnessRing'] as const).entries())
      if (returned.brightnessChannels[channel] !== target.brightnessChannels[channel])
        await edits.apply(
          profile,
          { field, wireIndex: returnSlot, value: target.brightnessChannels[channel] },
          backend,
        );
  }
  const verified = await backend.connection();
  if (
    verified.activeProfileIndex !== returnSlot ||
    target.brightnessChannels.some((value, index) => verified.brightnessChannels[index] !== value)
  )
    throw Error('Software release runtime controls could not be restored');
  fs.unlinkSync(location(profile));
  return { outcome: 'restored', backup: session.backup, runtimeBrightnessRestored: true };
}
export { apply, release, prepare };
