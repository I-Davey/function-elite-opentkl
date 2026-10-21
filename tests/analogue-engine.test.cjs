const {test}=require('node:test');
const assert=require('node:assert/strict');
const {AnalogueEngine,binding,parseProfile,evaluate,axes,buttons,feedbackColor,controllerContribution}=require('../dist/app/main/desktop-analogue.cjs');
const profile=bindings=>parseProfile({schemaVersion:2,bindings,normalizeSticks:false});
test('every axis and button supports per-key depth with neutral release',()=>{
  for(const channel of Object.keys({...axes,...buttons})){
    const b=binding({enabled:true,channel,startMm:0,endMm:4}), settings=profile({26:b}), engine=new AnalogueEngine();
    const halfway=engine.update({26:2},settings,16),full=engine.update({26:4},settings,16),off=engine.update({26:0},settings,16);
    if(channel in axes){assert.equal(halfway.axes[channel],.5);assert.equal(full.axes[channel],1);assert.equal(off.axes[channel],0);}
    else{assert.equal(full.buttonMask,buttons[channel]);assert.equal(off.buttonMask,0);}
    assert.equal(controllerContribution(full,'26',b),1);
  }
});
test('curves, travel bounds, output range, smoothing, opposing axes and diagonal normalization',()=>{
  for(const curve of ['linear','exponential','logarithmic','custom']){
    const b=binding({curve,startMm:1,endMm:3,strength:2,points:[{x:.5,y:.8}],outputMin:.1,outputMax:.9});
    assert.equal(evaluate(1,b),0);assert.equal(evaluate(3,b),.9);assert.equal(evaluate(4,b),.9);
    const middle=evaluate(2,b);assert.ok(middle>.1&&middle<.9);
    if(curve==='exponential')assert.ok(middle<.5);
    if(curve==='logarithmic'||curve==='custom')assert.ok(middle>.5);
  }
  const b=binding({enabled:true,channel:'lx',smoothMs:100}),engine=new AnalogueEngine();
  const eased=engine.update({26:4},profile({26:b}),16).axes.lx;assert.ok(eased>0&&eased<1);
  engine.reset();assert.equal(engine.update({26:0},profile({26:b}),16).axes.lx,0);
  const bindings={26:binding({enabled:true,channel:'lx'}),22:binding({enabled:true,channel:'lx',direction:-1}),7:binding({enabled:true,channel:'ly'})};
  assert.equal(engine.update({26:4,22:4,7:0},profile(bindings),16).axes.lx,0);
  const diagonal=engine.update({26:4,22:0,7:4},{...profile(bindings),normalizeSticks:true},16);assert.ok(Math.abs(Math.hypot(diagonal.axes.lx,diagonal.axes.ly)-1)<1e-10);
  assert.throws(()=>engine.update({},profile({26:b}),16),/sensor unavailable/);
});
test('button hysteresis and custom feedback colours follow controller mode',()=>{
  const b=binding({enabled:true,channel:'a',startMm:0,endMm:4,pressThreshold:.6,releaseThreshold:.4}),engine=new AnalogueEngine(),settings=profile({26:b});
  for(const [mm,held] of [[2,false],[3,true],[2,true],[1,false]])assert.equal(!!engine.update({26:mm},settings,16).buttons.a,held);
  const feedback={...settings.feedback,brightness:1,activeColor:'#123456',suppressedColor:'#abcdef',overrideColor:'#fedcba'};
  assert.equal(feedbackColor(b,false,feedback),'#123456');assert.equal(feedbackColor({...b,overwriteDefault:true},false,feedback),'#abcdef');assert.equal(feedbackColor(b,true,feedback),'#fedcba');
  const half={...feedback,brightness:.5};
  assert.equal(feedbackColor(b,false,half),'#091a2b');assert.equal(feedbackColor({...b,overwriteDefault:true},false,half),'#566778');assert.equal(feedbackColor(b,true,half),'#7f6e5d');
  for(const overwritten of [false,true])assert.equal(feedbackColor({...b,overwriteDefault:overwritten},false,{...feedback,brightness:0}),'#000000');
});
