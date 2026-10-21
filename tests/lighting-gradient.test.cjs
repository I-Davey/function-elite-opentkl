const {test}=require('node:test');
const assert=require('node:assert/strict');
const {encodeZones}=require('../dist/backend/lighting.cjs');

test('custom picker hex colours encode identically to prefixed gradient colours on every layer',()=>{
  const golden=require('./backend-golden.json');
  let covered=0;
  for(const entry of golden.lighting){
    const effect=structuredClone(entry.effect);
    const stops=effect.gradient??effect.color?.gradient;
    if(!stops?.length)continue;
    const zone={...(entry.layer==='Ring'?{leds:[0,1]}:{keys:[26,22]}),effectSettings:effect};
    const prefixed=encodeZones([zone],entry.layer);
    for(const stop of stops)stop.color='Ab12Cd';
    const bare=encodeZones([zone],entry.layer);
    for(const stop of stops)stop.color='#Ab12Cd';
    assert.equal(encodeZones([zone],entry.layer),bare);
    assert.ok(prefixed.length>0);covered++;
    for(const invalid of ['#abcde','1234567','gg1234','#12345z']){
      stops[0].color=invalid;assert.throws(()=>encodeZones([zone],entry.layer),/Invalid RGB color/);
    }
  }
  assert.ok(covered>0,'No gradient fixtures were exercised');
});
