const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { OverrideShortcut, parseProfile, binding } = require('../dist/app/main/desktop-analogue.cjs');

test('chords toggle all output once per press and preserve off state while rearming', () => {
  const profile = parseProfile({ schemaVersion: 2, bindings: {}, override: { enabled: true, mode: 'hold', scope: 'group', keys: [26] } });
  assert.equal(profile.override.mode, 'toggle');
  assert.equal(profile.override.scope, 'all');
  assert.deepEqual(profile.override.shortcut, [226, 225, 30]);
  const shortcut = new OverrideShortcut(), chord = Object.fromEntries(profile.override.shortcut.map(key => [key, 1]));
  shortcut.update({}, profile.override);
  assert.equal(shortcut.update({226: 1, 225: 1}, profile.override), false);
  assert.equal(shortcut.update(chord, profile.override), true);
  assert.equal(shortcut.update(chord, profile.override), true);
  shortcut.rearm();
  assert.equal(shortcut.update(chord, profile.override), true);
  shortcut.update({}, profile.override);
  assert.equal(shortcut.update(chord, profile.override), false);
});

test('desktop listener can enable output from off, disable every binding, then enable again', async t => {
  const parent = path.resolve(__dirname, '../.build/analogue-toggle');
  fs.mkdirSync(parent, { recursive: true });
  const profile = fs.mkdtempSync(path.join(parent, 'case-'));
  fs.writeFileSync(path.join(profile, 'profiles.json'), JSON.stringify({schemaVersion:1,keyboard:{softwareProfiles:[],activeProfileId:'fixture'},remap:{}}));
  let raw = {}, lastReport = '', slot = 4, rejectWrite = false, writes = 0, samples = 0;
  let attached=false,attachments=0,detachments=0;
  const records = [26,22].flatMap(physicalKey => [0,1].flatMap(level => [false,true].map(fnLayer => ({physicalKey,level,fnLayer,data:'',canonicalKey:34,status:'ok'}))));
  const mocks = [
    ['../dist/backend/devices.cjs', {
      connection: async () => ({ devicePath: 'fixture', activeProfileIndex: slot }),
      sensors: async () => {samples++;return { keys: [26, 22, 226, 225, 30].map(physicalKeyId => ({ physicalKeyId, millimetresEstimate: raw[physicalKeyId] ?? 0, adc:8000+(raw[physicalKeyId]??0)*7000+(samples%2 ? 25 : -25), baseline:10000, pressed:36000, scale:653 })) };},
      remaps: async request => ({activeProfileIndex:slot,records:records.filter(r=>request.physicalKeys.includes(r.physicalKey)).map(r=>({...r}))}),
      applyRemap: async request => {
        assert.deepEqual(Object.keys(request).sort(),['wireIndex','physicalKey','level','fnLayer','data','expectedData','expectedActive'].sort(), 'Read-only reply fields must not leak into native requests');
        if (rejectWrite) { rejectWrite=false; throw Error('fixture write failure'); }
        const record=records.find(r=>r.physicalKey===request.physicalKey && r.level===request.level && r.fnLayer===request.fnLayer);
        assert.equal(record.data,request.expectedData);record.data=request.data;writes++;
        return {outcome:'applied'};
      },
    }],
    ['../dist/backend/depth.cjs', { decode: value => value, estimate: value=>value*4, fullCoefficient:1 }],
    ['../dist/app/main/analogue-feedback.cjs', { createAnalogueFeedback: () => ({ stop: async () => {}, update: async () => {} }), restoreAnalogueLighting: async () => {} }],
    ['../dist/native/analog-controller/controller.node', {
      initialize: () => 'ready', setEnabled: enabled => {
        if(enabled&&!attached)attachments++;
        if(!enabled&&attached)detachments++;
        attached=enabled;return enabled ? 'enabled' : 'disabled';
      },
      update: report => { if(!attached)return 'disabled';lastReport = report; return 'updated'; },
    }],
  ];
  const previous = mocks.map(([file, exports]) => {
    const id = require.resolve(file), old = require.cache[id];
    require.cache[id] = { id, filename: id, loaded: true, exports };
    return [id, old];
  });
  const { createAnalogue } = require('../dist/app/main/analogue.cjs');
  let queue = Promise.resolve();
  const serial = operation => { const result = queue.then(operation); queue = result.catch(() => {}); return result; };
  const app = createAnalogue(profile, serial), handlers = new Map();
  app.register({ handle: (name, callback) => handlers.set(name, callback) }, {});
  const invoke = (name, value) => handlers.get('keyboard:' + name)({}, value);
  t.after(async () => {
    await serial(() => app.stopInside());
    for (const [id, old] of previous) { if (old) require.cache[id] = old; else delete require.cache[id]; }
    assert.ok(profile.startsWith(parent + path.sep));
    fs.rmSync(profile, { recursive: true, force: true });
  });
  const wait = async predicate => {
    const until = Date.now() + 1000;
    while (!predicate()) { if (Date.now() > until) assert.fail(JSON.stringify(app.state())); await new Promise(resolve => setTimeout(resolve, 5)); }
  };
  await invoke('analogue-profile', 'fixture');
  await invoke('analogue-save', parseProfile({ schemaVersion: 2, bindings: {26: binding({enabled: true, channel: 'ly'}), 22: binding({enabled: true, channel: 'a'})}, override: {enabled: true} }));
  await wait(() => app.state().connected);
  assert.equal(app.state().running, false);
  const chord = {226: 1, 225: 1, 30: 1};
  raw = chord;
  await wait(() => app.state().running);
  raw = {26: 4, 22: 4};
  await wait(() => app.state().axes.ly === 1 && app.state().buttonMask !== 0);
  raw = {...raw, ...chord};
  await wait(() => !app.state().running && !app.state().buttonMask && app.state().axes.ly === 0);
  assert.equal(lastReport, '0,0,0,0,0,0,0');
  raw = {};
  await new Promise(resolve => setTimeout(resolve, 15));
  await invoke('analogue-shortcut-capture', true);
  raw = chord;
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(app.state().running, false, 'Recording the shortcut must not toggle output');
  await invoke('analogue-shortcut-capture', false);
  raw = {};
  await new Promise(resolve => setTimeout(resolve, 15));
  raw = chord;
  await wait(() => app.state().running);
  await invoke('analogue-enable', false);
  assert.equal(app.state().running, false);
  const resumePaused = await serial(() => app.beforeConfiguration());
  assert.equal(app.state().connected, false);
  assert.equal(attached,true,'Colour edits must leave the Xbox controller attached');
  assert.equal(lastReport,'0,0,0,0,0,0,0','Configuration must release every controller input');
  await serial(resumePaused);
  await wait(() => app.state().connected);
  assert.equal(app.state().running, false, 'Lighting changes must preserve controller-off mode');
  raw = {};
  await new Promise(resolve => setTimeout(resolve, 15));
  raw = chord;
  await wait(() => app.state().running);
  const resumeActive = await serial(() => app.beforeConfiguration());
  await serial(resumeActive);
  await wait(() => app.state().connected);
  assert.equal(app.state().running, true, 'Lighting changes must resume the active controller session');
  raw={};
  const overwrite = parseProfile({...app.state().settings,bindings:{26:binding({enabled:true,overwriteDefault:true,channel:'ly'})}});
  await invoke('analogue-save',overwrite);
  assert.equal(records.filter(r=>r.data==='01010000000000').length,4,'Silence all actuation/Fn layers');
  assert.equal(app.state().recoveryPending,true);
  await invoke('analogue-enable',false);
  await wait(()=>!app.state().transitioning && records.every(r=>r.data===''));
  await invoke('analogue-enable',true);
  await wait(()=>records.filter(r=>r.data==='01010000000000').length===4);
  assert.ok(writes>=12,'Repeated toggle writes and restoration completed');
  await invoke('analogue-calibrate',{action:'start',key:26});
  assert.equal(app.state().running,false);
  assert.ok(records.every(r=>r.data===''),'Calibration restores normal keys');
  await invoke('analogue-calibrate',{action:'capture',key:26});
  assert.match(app.state().calibration.error,/steadily/);
  await new Promise(resolve=>setTimeout(resolve,350));
  await invoke('analogue-calibrate',{action:'capture',key:26});
  assert.equal(app.state().calibration.phase,'pressed');
  await new Promise(resolve=>setTimeout(resolve,350));
  await invoke('analogue-calibrate',{action:'capture',key:26});
  assert.match(app.state().calibration.error,/fully down/);
  raw={26:4};await new Promise(resolve=>setTimeout(resolve,750));
  await invoke('analogue-calibrate',{action:'capture',key:26});
  assert.equal(app.state().calibration.phase,'review');
  raw={};await invoke('analogue-calibrate',{action:'apply',key:26});
  assert.ok(Math.abs(app.state().settings.bindings[26].calibration.pressed-36000)<5);
  assert.equal(app.state().running,true);
  await invoke('analogue-save',{profileId:'other',settings:parseProfile({schemaVersion:2,bindings:{}})});
  assert.equal(app.state().profileId,'fixture','Delayed saves must not select another profile');
  assert.ok(app.state().settings.bindings[26].calibration);
  assert.equal(attachments,1,'Lighting, overwrite, shortcut and calibration edits reuse the same controller');
  assert.equal(detachments,0,'Normal edits must not produce controller disconnect notifications');
  await serial(()=>app.stopInside());
  assert.equal(attached,false,'Explicit shutdown still detaches the controller');
  rejectWrite=true;
  await assert.rejects(invoke('analogue-enable',true),/fixture write failure/);
  assert.ok(records.every(r=>r.data===''));
  assert.equal(app.state().recoveryPending,false,'Failed starts restore and remove the recovery journal');
  await invoke('analogue-enable',true);
  slot=0;await serial(()=>app.observeConnection({devicePath:'fixture',activeProfileIndex:slot}));
  assert.equal(app.state().running,false);
  assert.ok(records.every(r=>r.data===''),'Profile changes restore suppressed keys');
  assert.equal(attached,true,'Switching keyboard profiles preserves the virtual controller');
  slot=4;await invoke('analogue-enable',true);
  await serial(()=>app.observeConnection({devicePath:'replacement',activeProfileIndex:slot}));
  assert.equal(attached,false,'Changing physical keyboards still detaches the controller');
});
