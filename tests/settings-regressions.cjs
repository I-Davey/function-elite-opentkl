'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const settings=require('../dist/backend/settings.cjs'),snap=require('../dist/backend/snap.cjs'),remaps=require('../dist/backend/remaps.cjs');
const profile=path.resolve(__dirname,'../.build/settings-regressions/mock-profile');fs.mkdirSync(profile,{recursive:true});
let configs=[{physicalKey1:26,physicalKey2:22,resolutionMethod:'LastPressed',bottomMode:'EitherOne'}],words=new Map([[26,12<<8],[22,12<<8]]),data=new Map(),events=[];
const backend={
 snap:async()=>({activeProfileIndex:0,profiles:[{wireIndex:0,response:'010003'+snap.encode(configs)}]}),
 actuation:async()=>({activeProfileIndex:0,actuations:[...words].map(([physicalKey,rawWord])=>({physicalKey,rawWord,config:{kind:(rawWord&3)===1?'Dual':(rawWord&3)===2?'Rapid':'Single'}}))}),
 remaps:async input=>({activeProfileIndex:0,records:input.physicalKeys.flatMap(physicalKey=>[0,1].flatMap(level=>[false,true].map(fnLayer=>({physicalKey,level,fnLayer,data:data.get(physicalKey+':'+level+':'+fnLayer)||''}))))}),
 applySnap:async input=>{assert.equal(input.expectedData,snap.encode(configs));events.push('snap:'+input.data);configs=snap.decode({profiles:[{wireIndex:0,response:'010003'+input.data}]}).flatMap(p=>p.configs);return{outcome:'applied'};},
 applyRemap:async input=>{assert.equal(input.expectedData,data.get(input.physicalKey+':'+input.level+':'+input.fnLayer)||'');assert.equal(configs.length,0,'Snap must be cleared before remapping');events.push('remap');data.set(input.physicalKey+':'+input.level+':'+input.fnLayer,input.data);return{outcome:'applied'};},
 applyActuation:async input=>{assert.equal(configs.length,0,'Snap must be cleared before actuation');events.push('actuation');for(const key of input.keys){assert.equal(words.get(key.physicalKey),key.expectedWord);words.set(key.physicalKey,key.word);}return{outcome:'applied',after:await backend.actuation()};}
};
(async()=>{
 for(const modifier of ['Shift','Control','Alt'])assert.deepEqual(remaps.decode(remaps.encode({kind:'Modifier',modifier},26),26),{kind:'Modifier',modifier});
 const pair=structuredClone(configs);
 const request={wireIndex:0,physicalKey:26,level:0,fnLayer:false,remap:{kind:'SimpleRemap',targetKeyId:4}};
 const edit=await settings.applyRemap(profile,request,backend);assert.equal(configs.length,0);assert.equal(edit.snapConfigs.length,0);assert.equal(events[1],'remap');
 await settings.restoreRemap(profile,edit.backup,backend);assert.deepEqual(configs,pair);assert.equal(data.get('26:0:false'),'');
 const a=await settings.applyActuation(profile,{wireIndex:0,keys:[{physicalKey:26,kind:'Dual',levelIndex:12,secondLevelIndex:20,rapidSensitivityIndex:0}]},backend);assert.equal(configs.length,0);
 await settings.restoreActuation(profile,a.batches[0].backup,backend);assert.deepEqual(configs,pair);assert.equal(words.get(26),12<<8);
 const fn=await settings.applyRemap(profile,{...request,fnLayer:true},backend);assert.deepEqual(configs,pair);await settings.restoreRemap(profile,fn.backup,backend);assert.deepEqual(configs,pair);
 words.set(26,(12<<8)|1);await settings.applySnap(profile,{wireIndex:0,configs:pair},backend);assert.equal(configs.length,0);
 // Off assignments are excluded before the firmware zone limit is checked.
 const lighting=require('../dist/backend/lighting.cjs');for(const layer of ['Base','Ring','Reactive'])assert.equal(lighting.encodeZones(Array.from({length:20},()=>({effectSettings:{kind:'Off'}})),layer),'');
 const report={status:'passed',hardwareWrites:false,checks:['Clear/remap/filter ordering','Remap undo restores original Snap pairs','Dual actuation removes incompatible pairs','Actuation undo restores original Snap pairs','Fn remap preserves base Snap eligibility','Explicit Snap apply filters incompatible pairs','Off assignments omitted on all layers']};
 fs.writeFileSync(path.resolve(__dirname,'../.build/settings-regressions/regression-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1;});
