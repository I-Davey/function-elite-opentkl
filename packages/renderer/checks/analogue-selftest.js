import {getVerificationServices,reportVerification} from './runtime.js';

/** Use the mounted renderer and real IPC, with new profiles in isolated test storage. */
const {activeContext:context}=getVerificationServices();
const {api,host,profiles}=context;
const cases=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(value,message)=>{if(!value)throw Error(message);};
const check=async(name,action)=>{
  const started=performance.now();
  try{await action();cases.push({name,status:'passed',elapsedMs:Math.round(performance.now()-started)});}
  catch(error){cases.push({name,status:'failed',error:String(error.stack||error)});throw error;}
};
const until=async(predicate,message)=>{
  const end=performance.now()+7000;
  while(performance.now()<end){const state=await host.analogueState();assert(!state.error,state.error);assert(!state.feedbackError,state.feedbackError);if(predicate(state))return state;await wait(35);}
  throw Error(message);
};
const lighting=async()=>{
  const state=await host.state();return state.lighting.profiles.map(({wireIndex,baseZones,reactiveZones,perimeterZones})=>({wireIndex,baseZones,reactiveZones,perimeterZones}));
};
const canonical=value=>JSON.stringify(value,(key,item)=>key==='id'?undefined:item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item);
const fingerprint=async()=>{
  const connection=await host.connection(),all=await host.allProfileConfigs(),state=await host.state();
  return canonical({slot:connection.activeProfileIndex,brightness:connection.brightnessChannels,metadata:state.profiles.map(({wireIndex,pollingRate,idleTimeout,gameModeEnabled,fnLockEnabled,uninterpretedField7})=>({wireIndex,pollingRate,idleTimeout,gameModeEnabled,fnLockEnabled,uninterpretedField7})),snap:(await host.snap()).map(({wireIndex,configs})=>({wireIndex,configs})),lighting:await lighting(),onboard:all.profiles.map(p=>({
    wireIndex:p.wireIndex,brightness:p.brightnessChannels,actuation:p.actuation.actuations.map(k=>({physicalKey:k.physicalKey,rawWord:k.rawWord})),
    remaps:p.remaps.records.map(({physicalKey,level,fnLayer,data})=>({physicalKey,level,fnLayer,data}))
  })).sort((a,b)=>a.wireIndex-b.wireIndex)});
};
let initial,initialLocal,testId,copyId,settings,before,after,controls,failed=false;
try{
  await check('Connect and hydrate all four onboard profiles',async()=>{
    initialLocal=await host.read();initial=await host.connection();assert(initial.activeProfileIndex<4,'Close the existing software session first');
    controls=api.connectDeviceControls();await api.syncHardwareProfiles();api.syncLiveValues(initial);
    await api.flushSave();
    before=await fingerprint();
  });
  await check('Create and select a fresh software profile through the Profiles workflow',async()=>{
    testId=await profiles.duplicate();await profiles.rename(testId,'Analogue acceptance');
    assert(api.keyboard.activeProfileId===testId,'New profile not selected');
    assert((await host.connection()).activeProfileIndex===4,'Software profile not applied to slot 4');
    const state=await host.analogueState();assert(state.profileId===testId,'Analogue profile not selected');assert(!Object.keys(state.settings.bindings).length,'New profile inherited bindings');
    settings=state.settings;
  });
  await check('Save mappings, all four curve types and output ranges in the new profile',async()=>{
    const bind={enabled:true,overwriteDefault:false,channel:'ly',direction:1,startMm:.1,endMm:3.8,curve:'linear',strength:2,points:[{x:0,y:0},{x:.45,y:.7},{x:1,y:1}],outputMin:0,outputMax:.9,smoothMs:12,pressThreshold:.6,releaseThreshold:.4};
    for(const curve of ['linear','exponential','logarithmic','custom']){
      settings={...settings,bindings:{37:{...bind,curve},38:{...bind,channel:'a'}}};
      const saved=await host.analogueSave(settings,testId);assert(saved.settings.bindings[37].curve===curve,'Curve did not save');settings=saved.settings;
    }
    const saved=await host.read();assert(saved.analogueProfiles[testId].bindings[37].curve==='custom','Parent profile did not persist curves');
  });
  await check('Attach the actual virtual controller and read fresh sensors',async()=>{
    await host.analogueEnable(true);const state=await until(s=>s.running&&s.connected&&s.rateHz>0,'Controller did not start');
    assert(Object.keys(state.rawMm).length===88,'Not all 88 sensors are available');assert(state.axes.ly===0&&state.buttonMask===0,'Released keys are not neutral');
  });
  await check('Overwrite default key completes verified native writes and repeated restoration',async()=>{
    settings={...settings,bindings:{...settings.bindings,37:{...settings.bindings[37],overwriteDefault:true}}};
    await host.analogueSave(settings,testId);await until(s=>s.running,'Overwrite restart failed');
    assert((await host.analogueState()).recoveryPending,'Native suppression did not create its recovery record');
    for(let n=0;n<3;n++){
      await host.analogueEnable(false);await until(s=>!s.running&&!s.transitioning&&s.overriddenKeys.length===2&&!s.recoveryPending,'Disable/verified key restoration did not settle');
      await host.analogueEnable(true);await until(s=>s.running&&!s.transitioning&&s.recoveryPending,'Enable/verified suppression did not settle');
    }
  });
  await check('Custom feedback colours update repeatedly without journal or lighting errors',async()=>{
    for(const color of ['#123456','#f28412','#31c875']){
      settings={...settings,feedback:{...settings.feedback,enabled:true,activeColor:color,suppressedColor:color,overrideColor:color,brightness:1,fadeMs:0}};
      await host.analogueSave(settings,testId);await wait(250);const state=await host.analogueState();assert(!state.error&&!state.feedbackError,state.error||state.feedbackError);
    }
    await host.analogueEnable(false);await until(s=>!s.running&&!s.transitioning,'Controller did not disable with feedback');await wait(200);
    settings={...settings,feedback:{...settings.feedback,enabled:false}};await host.analogueSave(settings,testId);await wait(200);
    await until(s=>!s.recoveryPending,'Feedback/suppression journal was not cleared');
  });
  await check('Calibration collects live samples, rejects premature capture and cancels cleanly',async()=>{
    await host.analogueEnable(true);await until(s=>s.running&&s.connected,'Controller did not resume');
    let state=await host.analogueCalibrate({key:37,action:'start'});assert(!state.running&&state.calibration.phase==='released','Calibration failed to pause output');
    state=await host.analogueCalibrate({key:37,action:'capture'});assert(!!state.calibration.error,'Premature calibration was accepted');
    await wait(550);state=await host.analogueCalibrate({key:37,action:'capture'});assert(state.calibration.phase==='pressed',state.calibration.error||'Released capture failed');
    await host.analogueCalibrate({key:37,action:'cancel'});await until(s=>s.running&&!s.calibration,'Calibration cancel failed to resume');
  });
  await check('Duplicate includes every analogue setting and inactive saves stay with their target',async()=>{
    copyId=await profiles.duplicate(testId);assert(canonical((await host.analogueState()).settings)===canonical(settings),'Complete duplicate lost analogue settings');
    const changed={...settings,normalizeSticks:!settings.normalizeSticks};await host.analogueSave(changed,testId);
    const state=await host.analogueState();assert(state.profileId===copyId,'Delayed save changed selected profile');assert(state.settings.normalizeSticks===settings.normalizeSticks,'Inactive save changed active settings');
    await profiles.select(testId);assert((await host.analogueState()).settings.normalizeSticks===changed.normalizeSticks,'Targeted save did not persist');settings=changed;
  });
  await check('Render the live analogue page, select keys and exercise curve copy/paste',async()=>{
    api.ui.analogue=true;api.ui.depth=false;api.ui.tools=false;api.render();await wait(300);
    const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
    assert(document.querySelectorAll('.analogue-keyboard-surface [data-code]').length>=88,'Analogue keyboard did not render');
    assert(button('Copy curve')&&button('Paste curve'),'Curve tools missing');
    const exponential=button('exponential');assert(exponential,'Curve type controls missing');exponential.click();await wait(100);button('Copy curve').click();await wait(80);
    document.querySelector('.analogue-keyboard-surface [data-code="key-38"]').click();await wait(100);assert(!button('Paste curve').disabled,'Copy did not enable Paste');button('Paste curve').click();await wait(650);
    const state=await host.analogueState();assert(state.settings.bindings[38].curve==='exponential','Curve paste did not autosave to selected key');
    assert(!document.querySelector('.analog-error'),'Analogue view shows an error');
    api.ui.analogue=false;api.render();await wait(100);
  });
}catch{failed=true;}
finally{
  await check('Restore keyboard contents, brightness and normal typing after the test',async()=>{
    api.ui.analogue=false;api.render();await wait(100);context.state.cancelPending();
    if(testId){await host.analogueSave({...settings,override:{...settings.override,enabled:false},feedback:{...settings.feedback,enabled:false}},api.keyboard.activeProfileId);await host.analogueEnable(false);await until(s=>!s.running&&!s.transitioning,'Output did not stop');}
    if(initial){await profiles.select('hardware-'+initial.activeProfileIndex);await host.releaseSoftwareProfile();
      if((await host.connection()).activeProfileIndex!==initial.activeProfileIndex)await host.applyField({field:'activeProfile',wireIndex:initial.activeProfileIndex,value:initial.activeProfileIndex});
      for(const [channel,field] of ['brightnessKeys','brightnessRing'].entries())await host.applyField({field,wireIndex:initial.activeProfileIndex,value:initial.brightnessChannels[channel]});
      after=await fingerprint();
      assert(before===after,'Keyboard fingerprint differs after restoration');
    }
    assert(!(await host.analogueState()).recoveryPending,'A recovery journal remains');
    if(initialLocal)await host.write(initialLocal);
  }).catch(()=>{failed=true;});
  reportVerification({status:failed?'failed':'passed',suite:'analogue-new-software-profile',cases,testProfileId:testId,fingerprints:{match:!!before&&before===after},physicalPressVerified:false});
}
