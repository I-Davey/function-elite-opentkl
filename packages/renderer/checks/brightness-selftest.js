import {keyboardRoutes} from '../../keyboard-ui/src/keyboardRoutes.js';
import {getVerificationServices,reportVerification} from './runtime.js';
import {keyBrightness} from '../../keyboard-ui/src/logic/key-brightness.js';
const {activeContext,getKeyBrightnessControl} = getVerificationServices();
(async () => {
  if (!new URLSearchParams(location.search).has('brightness')) return;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const assert = (value, message) => { if (!value) throw Error(message); };
  const cases = []; let controls, backup;
  try {
    for (let n = 0; n < 100 && !activeContext?.api; n++) await wait(30);
    const api = activeContext?.api;
    await api.syncHardwareProfiles();
    const before = await window.keyboardHost.state(), slot = before.activeProfile.wireIndex;
    api.keyboard.setActiveProfileId('hardware-' + slot, { fromDevice: true });
    api.history.push(keyboardRoutes.keyboardDeviceLighting); api.render(); await wait(120);
    api.stores.viewStateStore.keyboard.setSelectedEffectLayer('Base');
    api.keyboard.clearSelection(); api.keyboard.addKey(37); await wait(80);
    const text = document.querySelector('[data-testid=key-brightness]')?.textContent;
    assert(text?.includes('Selected key brightness'), 'Selected key slider is missing: ' + text);
    assert(getKeyBrightnessControl().selected && getKeyBrightnessControl().keys.length === 1, 'Selection is not one key');
    controls = activeContext.api.connectDeviceControls();
    getKeyBrightnessControl().apply(.5); await controls.flush();
    assert(controls.last?.editKind === 'lighting', 'Per-key dimming sent a master brightness edit');
    backup = controls.last.backup;
    const after = await window.keyboardHost.state();
    assert(after.brightnessKeys === before.brightnessKeys, 'Master brightness changed');
    const old = before.lighting.profiles.find(p => p.wireIndex === slot).baseZones;
    const now = after.lighting.profiles.find(p => p.wireIndex === slot).baseZones;
    const palette = effect => JSON.stringify(effect, (key,value) => key === 'id' ? undefined : value);
    for (const key of activeContext.diagnostics.nativeActuation.actuations) {
      if (key.physicalKey === 37) continue;
      assert(palette(old.find(z => z.keys.includes(key.physicalKey))?.effectSettings) === palette(now.find(z => z.keys.includes(key.physicalKey))?.effectSettings), 'Changed unselected key ' + key.physicalKey);
    }
    assert(keyBrightness.inspect(now, [37]) <= .51, 'Selected key did not dim');
    cases.push({ name: 'Selected-key brightness changes one key, preserves all other palettes and master brightness', status: 'passed' });
  } catch (error) { cases.push({ name: 'Per-key brightness', status: 'failed', error: String(error.stack || error) }); }
  finally {
    try { if (backup) await window.keyboardHost.restoreLighting(backup); }
    catch (error) { cases.push({ name: 'Restore original lighting', status: 'failed', error: error.message }); }
    controls?.dispose();
  }
  reportVerification({status:cases.every(c => c.status === 'passed') ? 'passed' : 'failed',cases});
})();
