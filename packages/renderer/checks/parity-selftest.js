import {getVerificationServices,reportVerification} from './runtime.js';
const {activeContext} = getVerificationServices();
// Targeted regression: device-originated values must update the real CAM models
// while the connected write observer remains idle. Only temporary onboard selection is used to hydrate the models.
(async()=>{
  if(!new URLSearchParams(location.search).has('parity'))return;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),cases=[];
  let controls,api,before;
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  try{
    for(let n=0;n<100&&!activeContext?.api;n++)await wait(30);
    api=activeContext?.api;assert(api,'Renderer did not mount');
    const advertised=api.device.capabilityData.keyRemap.validSimpleRemapTargetKeys.custom.flatMap(group=>group.keys);
    assert(advertised.length===86,'Remap availability does not match implemented destinations');
    await api.syncHardwareProfiles();assert(activeContext.diagnostics.hardwareSync.allProfilesRead,'All onboard profile tables were not loaded');before=await window.keyboardHost.connection();
    assert(before.readOnly&&before.settingsWritePerformed===false,'Connection read contract');
    api.keyboard.setActiveProfileId('hardware-'+before.activeProfileIndex,{fromDevice:true});
    controls=activeContext.api.connectDeviceControls();
    assert(!controls.busy(),'Unexpected pending device edit');
    const receipt=controls.last;
    const simulated={...before,brightnessChannels:before.brightnessChannels.map(n=>n===0?23:0),gameModeEnabled:!before.gameModeEnabled,fnLockEnabled:!before.fnLockEnabled};
    api.syncLiveValues(simulated);
    assert(api.keyboard.keyBrightness===simulated.brightnessChannels[0]/100,'Key brightness did not refresh');
    assert(api.keyboard.perimeterBrightness===simulated.brightnessChannels[1]/100,'Ring brightness did not refresh');
    assert(api.keyboard.activeProfile.settings.gameModeEnabled===simulated.gameModeEnabled,'Game mode did not refresh');
    assert(api.keyboard.activeProfile.settings.fnLockEnabled===simulated.fnLockEnabled,'Fn lock did not refresh');
    await wait(250);await controls.flush();
    assert(controls.last===receipt&&!controls.busy(),'Device-originated update echoed a hardware edit');
    cases.push({name:'Live brightness and locks update recovered models without scheduling hardware writes',status:'passed'});
    api.syncLiveValues(before);
    const after=await window.keyboardHost.connection();
    for(const key of ['activeProfileIndex','brightnessChannels','gameModeEnabled','fnLockEnabled'])assert(JSON.stringify(before[key])===JSON.stringify(after[key]),'Hardware changed: '+key);
    cases.push({name:'Read-only connection snapshot exposes brightness and locks; hardware state unchanged',status:'passed'});
  }catch(error){cases.push({name:'Parity regression',status:'failed',error:String(error.stack||error)});}
  finally{if(api&&before)api.syncLiveValues(before);controls?.dispose();}
  reportVerification({status:cases.every(c=>c.status==='passed')?'passed':'failed',temporaryProfileSelection:true,profileContentsWritten:false,cases});
})();
