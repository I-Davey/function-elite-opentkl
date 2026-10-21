import { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import type { RendererContext } from './context.js';
import type { ProfileSection } from './profiles.js';
import type { RunningApplication } from '../../contracts/desktop-profiles.cjs';

export const ProfileToolbar = observer(function ProfileToolbar({context,onProfiles}:{context:RendererContext;onProfiles():void}) {
  const {keyboard,profiles}=context;
  const [error,setError]=useState('');
  return <div className="profile-parent-toolbar">
    <select aria-label="Active profile" value={keyboard.activeProfile.id} onChange={event=>void profiles.select(event.target.value).catch(error=>setError(String(error)))}>
      <optgroup label="Onboard">{keyboard.hardwareProfiles.slice().sort((a,b)=>a.hardwareProfileId-b.hardwareProfileId).map(profile=><option key={profile.id} value={profile.id}>{profiles.name(profile.id)}</option>)}</optgroup>
      <optgroup label="Software">{keyboard.softwareProfiles.map(profile=><option key={profile.id} value={profile.id}>{profiles.name(profile.id)}</option>)}</optgroup>
    </select>
    <button className="shell-button" onClick={onProfiles}>Profiles</button>
    {profiles.view.library.automatic && <button className="shell-button" aria-pressed={profiles.view.library.pinned} onClick={()=>void profiles.saveLibrary({...profiles.view.library,pinned:!profiles.view.library.pinned})}>{profiles.view.library.pinned?'Pinned':'Auto'}</button>}
    {error && <span role="alert" className="profile-error">{error}</span>}
  </div>;
});

export const ProfilesPage = observer(function ProfilesPage({context}:{context:RendererContext}) {
  const {keyboard,profiles,host,state}=context, {view}=profiles;
  const active=keyboard.activeProfile;
  const [search,setSearch]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [linkOpen,setLinkOpen]=useState(false),[apps,setApps]=useState<RunningApplication[]>([]),[appSearch,setAppSearch]=useState('');
  const [source,setSource]=useState(''),[sections,setSections]=useState<ProfileSection[]>(['lighting','performance','mappings','analogue']);
  const [slot,setSlot]=useState(0),[deleting,setDeleting]=useState(false);
  useEffect(()=>{setName(profiles.name(active.id));setDeleting(false);setSource('');},[active.id,active.name,profiles]);
  const act=async(operation:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);setError('');try{await operation();}catch(error){setError(String(error));}finally{setBusy(false);}};
  const associations=view.library.associations[active.id]??[];
  const connected=state.getSnapshot().phase==='ready';
  const openLink=()=>void act(async()=>{setLinkOpen(true);setAppSearch('');setApps((await host.applications()).running);});
  const choose=(app:RunningApplication)=>void act(async()=>{await profiles.associate(active.id,{path:app.path,name:app.name,mode:'focused'});setLinkOpen(false);});
  const select=(id:string)=>void act(()=>profiles.select(id));
  const removeAssociation=(path:string)=>profiles.saveLibrary({...view.library,associations:{...view.library.associations,[active.id]:associations.filter(app=>app.path!==path)}});
  return <section className="profiles-page" aria-label="Profiles">
    <div className="profiles-controls">
      <label className="analog-check"><input type="checkbox" checked={view.library.automatic} onChange={event=>void act(()=>profiles.saveLibrary({...view.library,automatic:event.target.checked,pinned:false}))}/>Automatic switching</label>
      <label className="analog-check"><input type="checkbox" checked={view.library.pinned} disabled={!view.library.automatic} onChange={event=>void act(()=>profiles.saveLibrary({...view.library,pinned:event.target.checked}))}/>Pin current profile</label>
      <label className="profiles-default">Default <select value={view.library.defaultProfileId} onChange={event=>void act(()=>profiles.saveLibrary({...view.library,defaultProfileId:event.target.value}))}>{!keyboard.profiles.some(profile=>profile.id===view.library.defaultProfileId)&&<option value={view.library.defaultProfileId}>Onboard profile · connect keyboard</option>}{keyboard.profiles.map(profile=><option key={profile.id} value={profile.id}>{profiles.name(profile.id)}</option>)}</select></label>
      <span className="profiles-activation">{view.library.pinned?'Pinned':view.reason}</span>
    </div>
    <div className="profiles-section-title"><h2>Onboard</h2><span>Stored on your keyboard</span></div>
    <div className="profile-slots">{keyboard.hardwareProfiles.slice().sort((a,b)=>a.hardwareProfileId-b.hardwareProfileId).map(profile=><button className="profile-slot" key={profile.id} aria-pressed={active.id===profile.id} disabled={busy||!connected} onClick={()=>select(profile.id)}><span className="profile-slot-number">0{profile.hardwareProfileId+1}</span><strong>{profiles.name(profile.id)}</strong><small>{active.id===profile.id?'Active':'Onboard'}</small></button>)}
      {!keyboard.hardwareProfiles.length && <p className="analog-hint">Connect the keyboard to load its four onboard profiles.</p>}
    </div>
    <div className="profiles-workspace">
      <section className="profile-library-panel">
        <div className="profiles-section-title"><h2>Software library</h2><button className="shell-button" disabled={busy} onClick={()=>void act(()=>profiles.duplicate())}>+ New</button></div>
        <input className="profile-search" aria-label="Search profiles" placeholder="Search profiles or linked apps" value={search} onChange={event=>setSearch(event.target.value)}/>
        <div className="profile-library-list">{keyboard.softwareProfiles.filter(profile=>[profiles.name(profile.id),...(view.library.associations[profile.id]??[]).map(app=>app.name)].join(' ').toLowerCase().includes(search.toLowerCase())).map(profile=><button key={profile.id} className="profile-library-item" aria-pressed={active.id===profile.id} disabled={busy} onClick={()=>select(profile.id)}><span className="profile-letter">{profiles.name(profile.id).slice(0,1).toUpperCase()}</span><span><strong>{profiles.name(profile.id)}</strong><small>{(view.library.associations[profile.id]??[]).map(app=>app.name).join(', ')||'No linked apps'}</small></span>{active.id===profile.id&&<span className="profile-active-dot"/>}</button>)}</div>
      </section>
      <section className="profile-detail-panel" key={active.id}>
        <div className="profiles-section-title"><h2>{active.isHardwareProfile?'Onboard profile':'Software profile'}</h2><span className="profile-autosave">{context.ui.saving?'Saving…':'Autosaved'}</span></div>
        <label className="analog-field"><span>Name</span><input className="profile-name-input" value={name} maxLength={100} onChange={event=>setName(event.target.value)} onBlur={()=>{if(name.trim()&&name.trim()!==profiles.name(active.id))void act(()=>profiles.rename(active.id,name));}} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/></label>
        <div className="profile-action-row"><button className="shell-button" disabled={busy} onClick={()=>void act(()=>profiles.duplicate(active.id))}>Duplicate to software</button>{active.canBeDeleted&&<button className="shell-button profile-delete" disabled={busy} onClick={()=>deleting?void act(()=>profiles.remove(active.id)):setDeleting(true)}>{deleting?'Confirm delete':'Delete'}</button>}</div>
        {!active.isHardwareProfile&&<>
          <div className="profiles-section-title profile-divider"><h3>Linked applications</h3><button className="shell-button" disabled={busy} onClick={openLink}>+ Link app</button></div>
          {associations.length===0&&<p className="analog-hint">Choose a running app or browse for its executable.</p>}
          {associations.map(app=><div className="profile-association" key={app.path}><span title={app.path}><strong>{app.name}</strong><small>{app.path}</small></span><select aria-label={'Activation rule for '+app.name} value={app.mode} onChange={event=>void act(()=>profiles.associate(active.id,{...app,mode:event.target.value as 'focused'|'running'}))}><option value="focused">When focused</option><option value="running">While running</option></select><button className="shell-button" aria-label={'Unlink '+app.name} onClick={()=>void act(()=>removeAssociation(app.path))}>×</button></div>)}
          <details className="profile-section-copy profile-divider"><summary>Copy sections from another profile</summary><select aria-label="Source profile" value={source} onChange={event=>setSource(event.target.value)}><option value="">Choose profile…</option>{keyboard.profiles.filter(profile=>profile.id!==active.id).map(profile=><option key={profile.id} value={profile.id}>{profiles.name(profile.id)}</option>)}</select><div className="profile-copy-options">{(['lighting','performance','mappings','analogue'] as const).map(section=><label className="analog-check" key={section}><input type="checkbox" checked={sections.includes(section)} onChange={event=>setSections(event.target.checked?[...sections,section]:sections.filter(item=>item!==section))}/>{section}</label>)}</div><button className="shell-button" disabled={busy||!source||!sections.length} onClick={()=>void act(()=>profiles.copySections(source,active.id,sections))}>Copy selected sections</button></details>
          <details className="profile-section-copy profile-divider"><summary>Replace onboard slot</summary><p className="analog-hint">The current slot is copied to your software library first. Analogue controls and app links require this application.</p><div className="profile-action-row"><select aria-label="Target onboard slot" value={slot} onChange={event=>setSlot(Number(event.target.value))}>{keyboard.hardwareProfiles.slice().sort((a,b)=>a.hardwareProfileId-b.hardwareProfileId).map(profile=><option key={profile.id} value={profile.hardwareProfileId}>{profiles.name(profile.id)}</option>)}</select><button className="shell-button" disabled={busy||!connected} onClick={()=>void act(()=>profiles.replaceOnboard(active.id,slot))}>Replace slot {slot+1}</button></div></details>
        </>}
      </section>
    </div>
    {(error||view.error||view.applications?.error)&&<p className="profile-error" role="alert">{error||view.error||view.applications?.error}</p>}
    {linkOpen&&<div className="profile-dialog-backdrop"><section className="profile-app-dialog" role="dialog" aria-modal="true" aria-label="Link application"><div className="profiles-section-title"><h2>Link application</h2><button className="shell-button" onClick={()=>setLinkOpen(false)} aria-label="Close application picker">×</button></div><input className="profile-search" autoFocus placeholder="Search running applications" aria-label="Search running applications" value={appSearch} onChange={event=>setAppSearch(event.target.value)}/><div className="profile-running-list">{apps.filter(app=>(app.name+' '+app.path).toLowerCase().includes(appSearch.toLowerCase())).map(app=><button key={app.path} disabled={busy} onClick={()=>choose(app)}><span className="profile-letter">{app.name.slice(0,1).toUpperCase()}</span><span><strong>{app.name}</strong><small>{app.path}</small></span></button>)}{!apps.length&&<p className="analog-hint">No running applications available.</p>}</div><div className="profile-action-row"><button className="shell-button" disabled={busy} onClick={()=>void act(async()=>setApps((await host.applications()).running))}>Refresh</button><button className="shell-button" disabled={busy} onClick={()=>void act(async()=>{const app=await host.browseApplication();if(app){await profiles.associate(active.id,app);setLinkOpen(false);}})}>Browse executable…</button></div></section></div>}
  </section>;
});
