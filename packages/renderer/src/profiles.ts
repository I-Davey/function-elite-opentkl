import { observable, runInAction, toJS } from 'mobx';
import { applySnapshot, getSnapshot } from 'mobx-state-tree';
import { v4 } from 'uuid';
import { KeyboardProfile } from '../../keyboard-ui/src/models/KeyboardProfile.js';
import { getDefaultKeyboardProfileSettings } from '../../keyboard-ui/src/models/profileDefaults.js';
import type { RendererContext } from './context.js';
import { parseLibrary, matchProfile, type ProfileLibrary, type ApplicationSnapshot, type AppAssociation } from '../../contracts/desktop-profiles.cjs';
import { flushAnalogueChanges } from './analogue-controls.js';
export type ProfileSection = 'lighting' | 'performance' | 'mappings' | 'analogue';

/** All entry points select the same models; the device coordinator owns application. */
export function createProfiles(context: RendererContext, initial: ProfileLibrary) {
  const { keyboard, remap, host, state } = context;
  const view = observable({ library:initial, reason:'Manual selection', error:'', busy:false, applications:null as ApplicationSnapshot|null });
  const find = (id: string) => { const profile = keyboard.profiles.find(profile => profile.id === id); if (!profile) throw Error('Profile unavailable'); return profile; };
  let selectionRequest = 0;
  let metadataSave = Promise.resolve();
  const saveLibrary = (value: ProfileLibrary) => {
    const next = parseLibrary(value);
    runInAction(() => { view.library = next; });
    metadataSave = metadataSave.catch(()=>{}).then(async () => { await host.saveProfileLibrary(next); });
    metadataSave.catch(error => runInAction(() => { view.error=String(error); }));
    return metadataSave;
  };
  const select = async (id: string, reason = 'Manual selection') => {
    find(id); const request = ++selectionRequest;
    await flushAnalogueChanges();
    await context.api.flushSave();
    if (request !== selectionRequest) return;
    if (reason === 'Manual selection' && view.library.automatic && !view.library.pinned) await saveLibrary({...view.library,pinned:true});
    runInAction(() => { view.reason=reason; view.error=''; });
    if (keyboard.activeProfile.id !== id) keyboard.setActiveProfileId(id, {fromDevice:false});
    await context.deviceControls?.flush();
    if (request === selectionRequest) await host.analogueProfile(id);
  };
  const mapping = (id: string) => {
    const source=find(id);
    const settings = source.hardwareProfileId === undefined ? remap.softwareKeyRemapSettingsMap.get(id) : remap.hardwareKeyRemapSettingsMap?.get(String(source.hardwareProfileId));
    if (!settings || settings.physicalKeys.size < 88) throw Error('Read the complete keyboard profile first');
    return settings;
  };
  const duplicate = async (sourceId?:string) => {
    await flushAnalogueChanges();
    const id=v4(), source=sourceId ? find(sourceId) : undefined;
    if (sourceId) mapping(sourceId);
    // Copy host-owned settings first, so selection can never see an empty analogue profile.
    if (sourceId) await host.copyAnalogueProfile(sourceId,id);
    const settings=source ? getSnapshot(source.settings) : getDefaultKeyboardProfileSettings(context.device);
    keyboard.addSoftwareProfile(KeyboardProfile.create({id,name:source ? `${view.library.names[source.id] || source.name || 'Profile'} copy` : 'New profile',settings,keyBrightness:source?.keyBrightness??.8,perimeterBrightness:source?.perimeterBrightness??.8}), source ? {id:source.id,hardwareProfileId:source.hardwareProfileId} : undefined);
    context.api.save(); await context.api.flushSave();
    await select(id); return id;
  };
  const copySections = async (sourceId:string,targetId:string,sections:ProfileSection[]) => {
    if (sourceId === targetId) return;
    await flushAnalogueChanges(); await state.flush();
    const source=find(sourceId), target=find(targetId);
    if (target.hardwareProfileId !== undefined) throw Error('Use Replace onboard for keyboard slots');
    if (sections.includes('analogue')) await host.copyAnalogueProfile(sourceId,targetId);
    const sourceSettings=getSnapshot(source.settings), settings=getSnapshot(target.settings);
    const next={...settings};
    if (sections.includes('lighting')) Object.assign(next,{baseZones:sourceSettings.baseZones,reactiveZones:sourceSettings.reactiveZones,perimeterZones:sourceSettings.perimeterZones});
    if (sections.includes('performance')) Object.assign(next,{pollingRate:sourceSettings.pollingRate,fnLockEnabled:sourceSettings.fnLockEnabled,gameModeEnabled:sourceSettings.gameModeEnabled,idleTimeout:sourceSettings.idleTimeout});
    // Apply related model updates together so only one software configuration is scheduled.
    runInAction(() => {
      applySnapshot(target.settings,next);
      if(sections.includes('lighting')){target.setBrightness('keys',source.keyBrightness);target.setBrightness('ring',source.perimeterBrightness);if(target.id===keyboard.activeProfile.id){keyboard.setKeyBrightness(source.keyBrightness,{fromDevice:false});keyboard.setPerimeterBrightness(source.perimeterBrightness,{fromDevice:false});}}
      if (sections.includes('mappings') || sections.includes('performance')) {
        const from=mapping(sourceId), to=mapping(targetId);
        for (const [key, physical] of to.physicalKeys) {
          const original=from.physicalKeys.get(key);
          if (!original || original.active.kind==='NoConfigurableActuation' || physical.active.kind==='NoConfigurableActuation') continue;
          const performance=sections.includes('performance') ? original.active : physical.active;
          const outputs=sections.includes('mappings') ? original.active : physical.active;
          const base=getSnapshot(outputs.remapTo), fn=outputs.fnPressed ? getSnapshot(outputs.fnPressed.remapTo) : base;
          const baseLevels=Array.isArray(base) ? base : [base], fnLevels=Array.isArray(fn) ? fn : [fn];
          const active=performance.kind==='Dual'
            ? {kind:'Dual' as const,actuation:getSnapshot(performance.actuation),remapTo:[baseLevels[0],baseLevels[1]??baseLevels[0]],fnPressed:{remapTo:[fnLevels[0],fnLevels[1]??fnLevels[0]]}}
            : {kind:'Single' as const,actuation:getSnapshot(performance.actuation),remapTo:baseLevels[0],fnPressed:{remapTo:fnLevels[0]}};
          applySnapshot(physical,{physicalKey:physical.physicalKey,active});
        }
        if(sections.includes('performance')) applySnapshot(to.snapOverrideConfigs,getSnapshot(from.snapOverrideConfigs));
      }
    });
    context.api.save(); await context.api.flushSave(); await state.flush();
  };
  const replaceOnboard = async (sourceId:string,slot:number) => {
    const source=find(sourceId); if (source.hardwareProfileId !== undefined) throw Error('Choose a software profile');
    const target=find(`hardware-${slot}`);
    await flushAnalogueChanges(); await state.flush();
    const oldSettings=getSnapshot(target.settings),oldMappings=getSnapshot(mapping(target.id));
    // A complete software copy is the user-visible undo for this replacement.
    const backupId=v4();
    await host.copyAnalogueProfile(target.id,backupId);
    keyboard.addSoftwareProfile(KeyboardProfile.create({id:backupId,name:`${target.name || `Onboard ${slot+1}`} backup`,settings:getSnapshot(target.settings),keyBrightness:target.keyBrightness,perimeterBrightness:target.perimeterBrightness}),{id:target.id,hardwareProfileId:slot});
    await context.api.flushSave();
    const current=keyboard.activeProfile.id;
    const scope=state.beginHydration();
    try { scope.commit(() => { keyboard.setActiveProfileId(sourceId,{fromDevice:true}); keyboard.copyCurrentProfileToHardware(slot,false); keyboard.setActiveProfileId(current,{fromDevice:true}); }); }
    finally { scope.close(); }
    const profile = (await import('./control-model-adapter.js')).captureControlSnapshot(context).hardware.find(profile=>profile.wireIndex===slot);
    if (!profile) throw Error('Onboard replacement unavailable');
    try {
      await host.applyProfile(profile);
      await host.copyAnalogueProfile(sourceId,target.id);
    } catch(error) {
      const restore=state.beginHydration();
      try { restore.commit(()=>{applySnapshot(target.settings,oldSettings);applySnapshot(mapping(target.id),oldMappings);}); }
      finally {restore.close();}
      throw error;
    }
    context.api.save(); await context.api.flushSave();
  };
  const associate = (id:string,app:AppAssociation) => {
    if (find(id).isHardwareProfile) throw Error('Link applications to a software profile');
    const associations=toJS(view.library.associations);
    for (const key of Object.keys(associations)) associations[key]=associations[key].filter(item=>item.path.toLowerCase()!==app.path.toLowerCase());
    associations[id]=[...(associations[id]??[]),app];
    return saveLibrary({...view.library,associations});
  };
  const onApplications = (snapshot:ApplicationSnapshot) => {
    runInAction(()=>{view.applications=snapshot;});
    const matched=matchProfile(view.library,snapshot);
    if (!matched || matched.id===keyboard.activeProfile.id || state.getSnapshot().phase!=='ready') return;
    if (!keyboard.profiles.some(profile=>profile.id===matched.id)) return;
    void select(matched.id,matched.reason).catch(error=>runInAction(()=>{view.error=String(error);}));
  };
  const unsubscribe=host.onApplications(onApplications);
  void host.applications().then(onApplications).catch(error=>runInAction(()=>{view.error=String(error);}));
    const retry=state.subscribe(()=>{
    if (view.applications && !state.getSnapshot().pendingEdits.length && state.getSnapshot().phase==='ready') {
      const match=matchProfile(view.library,view.applications);
      if(match && match.id!==keyboard.activeProfile.id) onApplications(view.applications);
    }
  });
  return {
    view, select, duplicate, copySections, replaceOnboard, associate, saveLibrary,
    name:(id:string)=>view.library.names[id] || find(id).name || 'Untitled profile',
    rename:async(id:string,name:string)=>{ if (!name.trim() || name.trim().length>100) throw Error('Enter a name of 1–100 characters');find(id).setName(name.trim()); await saveLibrary({...view.library,names:{...view.library.names,[id]:name.trim()}});context.api.save();await context.api.flushSave(); },
    remove:async(id:string)=>{find(id); if(keyboard.activeProfile.id===id) await select('DEFAULT');keyboard.removeSoftwareProfile(id);await host.removeAnalogueProfile(id);const next=toJS(view.library);delete next.associations[id];delete next.names[id];if(next.defaultProfileId===id)next.defaultProfileId='hardware-0';await saveLibrary(next);context.api.save();await context.api.flushSave();},
    dispose:()=>{unsubscribe();retry();},
  };
}
export type Profiles = ReturnType<typeof createProfiles>;
