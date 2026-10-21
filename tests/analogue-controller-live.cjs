// Explicit live test: creates one temporary virtual controller; never writes to the keyboard.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {spawn}=require('node:child_process'),{createInterface}=require('node:readline');
const controller=require('../dist/native/analog-controller/controller.node');
const root=path.resolve(__dirname,'..'),cases=[];
const reader=spawn('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'xinput-reader.ps1')],{stdio:['pipe','pipe','pipe'],windowsHide:true});
const lines=createInterface({input:reader.stdout})[Symbol.asyncIterator]();
const deadline=setTimeout(()=>reader.kill(),30000);
let stderr='',interval;
reader.stderr.on('data',value=>{stderr+=value;});
const next=async()=>{const value=await lines.next();assert.ok(!value.done,stderr||'XInput reader exited');return JSON.parse(value.value);};
const read=async()=>{reader.stdin.write('read\n');return (await next()).controllers;};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=async(name,operation)=>{await operation();cases.push({name,status:'passed'});};
(async()=>{
  assert.equal((await next()).ready,true);
  const before=await read();
  assert.equal(controller.initialize(path.join(root,'dist/resources/controller/ViGEmClient.dll')),'ready');
  assert.equal(controller.setEnabled(true),'enabled');
  const attached=(await read()).find(c=>!before.some(old=>old.index===c.index));assert.ok(attached,'A new XInput controller did not appear');
  const sample=async(report)=>{
    const send=()=>assert.equal(controller.update(report.join(',')),'updated');
    send();interval=setInterval(send,30);
    try{await wait(30);const actual=(await read()).find(c=>c.index===attached.index);assert.ok(actual,'Controller disappeared');return actual;}
    finally{clearInterval(interval);}
  };
  for(let axis=0;axis<6;axis++)for(const value of axis<4?[-1,-.25,0,.5,1]:[0,.25,.5,1])await check(`XInput axis ${axis} at ${value}`,async()=>{
    const report=Array(7).fill(0);report[axis]=value;const actual=await sample(report);
    const expected=Array(6).fill(0);expected[axis]=Math.round(value*(axis<4?(value<0?32768:32767):255));
    assert.deepEqual(actual.axes,expected);assert.equal(actual.buttons,0);
  });
  for(const mask of [1,2,4,8,16,32,64,128,256,512,4096,8192,16384,32768,0xf3ff])await check(`XInput button mask ${mask}`,async()=>{
    const actual=await sample([0,0,0,0,0,0,mask]);assert.equal(actual.buttons,mask);assert.deepEqual(actual.axes,[0,0,0,0,0,0]);
  });
  await check('Stalled input is neutralized by the native watchdog',async()=>{
    await sample([1,1,-1,-1,1,1,0xf3ff]);await wait(400);const actual=(await read()).find(c=>c.index===attached.index);
    assert.deepEqual(actual.axes,[0,0,0,0,0,0]);assert.equal(actual.buttons,0);assert.equal(JSON.parse(controller.status()).stale,true);
  });
  await check('Disable removes the virtual controller',async()=>{
    assert.equal(controller.setEnabled(false),'disabled');await wait(80);assert.ok(!(await read()).some(c=>c.index===attached.index));
  });
})().catch(error=>{cases.push({name:'Native controller acceptance',status:'failed',error:String(error.stack||error)});process.exitCode=1;}).finally(()=>{
  clearTimeout(deadline);clearInterval(interval);controller.setEnabled(false);reader.stdin.end();reader.kill();
  const report={at:new Date().toISOString(),status:process.exitCode?'failed':'passed',hardwareWrites:false,xinputVerified:true,cases};
  fs.writeFileSync(path.join(root,'reports/analogue-controller-live.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:cases.length,failed:cases.filter(c=>c.status==='failed')}));
});
