import {keyboardRoutes} from '../../keyboard-ui/src/keyboardRoutes.js';
import { ACTUATION_PRESETS } from '../../keyboard-ui/src/models/actuationPresets.js';
import { KEYBOARD_BASE_EFFECT_INFO_MAP, KEYBOARD_REACTIVE_EFFECT_INFO_MAP } from '../../keyboard-ui/src/models/lightingConstants.js';
import { en } from '../../keyboard-ui/src/i18n/locales/en.js';
import { getVerificationServices, reportVerification } from './runtime.js';
const { activeContext, getSnapshot } = getVerificationServices();
(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    resumed = JSON.parse(sessionStorage.getItem('keyboard-reload-test') || 'null'),
    cases = resumed?.cases || [];
  const assert = (test, message) => {
    if (!test) throw Error(message);
  };
  const canonical = (value) =>
    JSON.stringify(value, (_key, item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(
            Object.keys(item)
              .sort()
              .map((key) => [key, item[key]]),
          )
        : item,
    );
  try {
    for (let i = 0; i < 100 && !activeContext?.api && !activeContext.diagnostics.lastError; i++)
      await wait(50);
    assert(activeContext?.api, 'Startup: ' + activeContext.diagnostics.lastError);
    const api = activeContext?.api;
    const check = async (name, fn) => {
      try {
        await fn();
        assert(!activeContext.diagnostics.lastError, activeContext.diagnostics.lastError);
        cases.push({ name, status: 'passed' });
      } catch (error) {
        cases.push({ name, status: 'failed', error: String(error.stack || error) });
      }
    };

    if (resumed) {
      sessionStorage.removeItem('keyboard-reload-test');
      await wait(350);
      await check('profile settings restore after complete page reload', async () => {
        assert(api.keyboard.keyBrightness === 0.61, 'Brightness did not restore');
        assert(
          api.keyboard.activeProfile.settings.pollingRate === resumed.expected.pollingRate,
          'Polling rate did not restore',
        );
        assert(
          api.remap.activeProfile.physicalKeys.get('26').active.actuation.level ===
            resumed.expected.level,
          'W actuation did not restore',
        );
        assert(
          api.remap.activeProfile.physicalKeys.get('26').active.actuation.isRapidTrigger ===
            resumed.expected.rapid,
          'W rapid trigger did not restore',
        );
      });
      if (resumed.expected.lighting)
        await check('imported lighting survives complete page reload', async () => {
          for (const name of ['baseZones', 'perimeterZones', 'reactiveZones'])
            assert(
              canonical(getSnapshot(api.keyboard.activeProfile.settings[name])) ===
                canonical(resumed.expected.lighting[name]),
              name + ' did not restore',
            );
        });

      await window.keyboardHost.write(resumed.original);
      reportVerification({
        status: cases.every((x) => x.status === 'passed') ? 'passed' : 'failed',
        cases,
      });
      return;
    }
    const original = await window.keyboardHost.read();
    await check('source-built Rust HID descriptor discovery', async () => {
      const result = await api.discover();
      assert(
        result.status === 'ok' &&
          result.nativeLanguage === 'Rust' &&
          result.reportIoPerformed === false,
        'Unexpected Rust HID discovery contract',
      );
      assert(
        result.interfaces.every((i) => i.queryOnly === true),
        'Probe performed more than descriptor discovery',
      );
    });

    for (const name of [
      'keyboardDeviceLighting',
      'keyboardDevicePerformance',
      'keyboardDeviceRemaps',
      'keyboardDeviceMacros',
    ]) {
      try {
        api.resetError();
        api.history.push(keyboardRoutes[name]);
        api.render();
        await wait(350);
        assert(!activeContext.diagnostics.lastError, activeContext.diagnostics.lastError);
        assert(document.querySelector('#keyboard-workspace'), 'Workspace did not mount');
        assert(document.querySelectorAll('[data-code]').length >= 88, 'Keyboard layout missing');
        cases.push({
          name,
          status: 'passed',
          keys: document.querySelectorAll('[data-code]').length,
          text: document.body.innerText.slice(0, 1300),
        });
      } catch (error) {
        cases.push({ name, status: 'failed', error: String(error.stack || error) });
      }
    }
    await check('rapid trigger checkbox changes actual per-key models', async () => {
      api.history.push(keyboardRoutes.keyboardDevicePerformance);
      api.render();
      await wait(350);
      document.querySelector('[data-code="26"]')?.click();
      await wait(60);
      const key = api.remap.activeProfile.physicalKeys.get('26'),
        before = key.active.actuation.isRapidTrigger;
      const input = [...document.querySelectorAll('input[type=checkbox]')].find(
        (e) => e.getAttribute('aria-label') === 'Rapid Trigger',
      );
      assert(input, 'Rapid trigger checkbox missing');
      input.click();
      await wait(60);
      assert(
        key.active.actuation.isRapidTrigger === !before,
        'Checkbox did not change W actuation',
      );
      await api.flushSave();
      assert(
        (await window.keyboardHost.read()).remap.softwareKeyRemapSettingsMap[
          api.keyboard.activeProfile.id
        ].physicalKeys['26'].active.actuation.isRapidTrigger === !before,
        'Rapid trigger was not saved',
      );
    });
    await check('per-key actuation changes persist', async () => {
      const key = api.remap.activeProfile.physicalKeys.get('26');
      api.remap.updateActuationLevel([key], 13);
      await wait(30);
      await api.flushSave();
      assert(key.active.actuation.level === 13, 'Actuation level did not change');
      assert(
        (await window.keyboardHost.read()).remap.softwareKeyRemapSettingsMap[
          api.keyboard.activeProfile.id
        ].physicalKeys['26'].active.actuation.level === 13,
        'Actuation did not reach profile file',
      );
    });
    await check('remapping model preserves physical-key identity', async () => {
      api.remap.updateSimpleRemap(26, 22);
      await wait(30);
      await api.flushSave();
      assert(
        api.remap.activeProfile.physicalKeys.get('26').active.remapTo.targetKeyId === 22,
        'W to S remap failed',
      );
      api.remap.updateSimpleRemap(26, 26);
      await api.flushSave();
    });
    await check('brightness and polling rate save independently of CAM', async () => {
      api.keyboard.setKeyBrightness(0.61, { fromDevice: false });
      api.keyboard.activeProfile.settings.setPollingRate('Hz2000');
      await wait(30);
      await api.flushSave();
      const saved = await window.keyboardHost.read();
      assert(saved.keyBrightness === 0.61, 'Volatile brightness was not persisted');
      assert(
        saved.keyboard.softwareProfiles.find((p) => p.id === api.keyboard.activeProfile.id).settings
          .pollingRate === 'Hz2000',
        'Polling rate was not persisted',
      );
    });
    const enter = (input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    await check('keyboard taps, Ctrl/Shift additions and drag selection update real key membership', async () => {
      api.history.push(keyboardRoutes.keyboardDeviceLighting); await wait(100);
      const key = code => document.querySelector('[data-code="key-' + code + '"]');
      const fire = (node, type, x, y, modifiers = {}) => node.dispatchEvent(new MouseEvent(type, {
        bubbles: true, cancelable: true, button: 0, buttons: type === 'mouseup' ? 0 : 1,
        clientX: x, clientY: y, ...modifiers,
      }));
      const tap = async (code, modifiers = {}) => {
        const node = key(code), rect = node.getBoundingClientRect();
        fire(node, 'mousedown', rect.left + 5, rect.top + 5, modifiers);
        fire(node, 'mouseup', rect.left + 5, rect.top + 5, modifiers); await wait(30);
      };
      await tap(26);
      assert(api.keyboard.selectedKeys.size === 1 && api.keyboard.selectedKeys.has(26), 'Tap did not select W only');
      await tap(22, { ctrlKey: true });
      assert(api.keyboard.selectedKeys.size === 2 && api.keyboard.selectedKeys.has(26) && api.keyboard.selectedKeys.has(22),
        'Ctrl selection did not retain the previous key');
      await tap(7, { shiftKey: true });
      assert(api.keyboard.selectedKeys.size === 3 && api.keyboard.selectedKeys.has(7), 'Shift selection did not add D');
      const start = key(4).getBoundingClientRect(), end = key(7).getBoundingClientRect();
      fire(key(4), 'mousedown', start.left + 3, start.top + 3);
      fire(document, 'mousemove', end.left + end.width - 3, end.top + end.height - 3);
      await Promise.race([
        new Promise(resolve => requestAnimationFrame(resolve)),
        wait(2000).then(() => { throw Error('Hidden integration window did not produce a selection animation frame'); }),
      ]);
      fire(document, 'mouseup', end.left + end.width - 3, end.top + end.height - 3); await wait(35);
      assert(!api.keyboard.selectedKeys.has(26) && [4, 22, 7].every(code => api.keyboard.selectedKeys.has(code)),
        'Drag selection did not replace membership with A/S/D: ' + JSON.stringify([...api.keyboard.selectedKeys]));
      assert(!api.keyboard.selecting, 'Selection state remained active after mouseup');
    });
    await check('every exposed Base, Reactive and Perimeter mode mounts its editor and updates the selected layer', async () => {
      api.history.push(keyboardRoutes.keyboardDeviceLighting); await wait(100);
      api.keyboard.clearSelection(); api.keyboard.addKey(26);
      const capability = api.device.capabilityData.keyboardMouseLighting;
      for (const layer of ['Base', 'Reactive', 'Perimeter']) {
        api.keyboard.setIsPerimeterSelected(layer === 'Perimeter');
        api.stores.viewStateStore.keyboard.setSelectedEffectLayer(layer === 'Reactive' ? 'Reactive' : 'Base');
        await wait(35);
        const map = layer === 'Reactive' ? KEYBOARD_REACTIVE_EFFECT_INFO_MAP : KEYBOARD_BASE_EFFECT_INFO_MAP;
        const supported = layer === 'Perimeter' ? capability.supportedRingEffects.effects
          : layer === 'Reactive' ? capability.supportedReactiveEffects : capability.supportedBaseEffects;
        const modes = Object.values(map).filter(info => supported.includes(info.effectName) || info.effectName === 'Off');
        for (const mode of modes) {
          const label = [...document.querySelectorAll('div')].find(node =>
            !node.children.length && node.textContent === en.keyboard.colorMode);
          const combo = label?.parentElement.querySelector('[role=combobox]');
          assert(combo, layer + ': lighting mode control missing');
          combo.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown', keyCode: 40 }));
          await wait(20);
          const options = [...document.querySelectorAll('[id*="-option-"]')].filter(node => node.querySelector('p[title]'));
          assert(canonical(options.map(option => option.textContent)) === canonical(
            modes.map(info => en.keyboard['keyboardEffect-' + info.effectName])), layer + ': mode order/capabilities changed');
          const option = options.find(option => option.textContent === en.keyboard['keyboardEffect-' + mode.effectName]);
          assert(option, layer + ': mode missing: ' + mode.effectName); option.click(); await wait(35);
          const selected = layer === 'Perimeter' ? api.keyboard.selectedPerimeterEffectInfo
            : layer === 'Reactive' ? api.keyboard.selectedReactiveEffectInfo : api.keyboard.selectedBaseEffectInfo;
          assert(selected.effectName === mode.effectName, layer + ': mode did not reach the model: ' + mode.effectName);
          assert(!activeContext.diagnostics.lastError, activeContext.diagnostics.lastError);
        }
      }
      api.keyboard.setIsPerimeterSelected(false);
      api.stores.viewStateStore.keyboard.setSelectedEffectLayer('Base');
    });
    await check('all four performance presets update base, WASD and Space models through the UI', async () => {
      api.history.push(keyboardRoutes.keyboardDevicePerformance); await wait(80);
      for (const preset of ACTUATION_PRESETS) {
        const label = [...document.querySelectorAll('div')].find(node =>
          !node.children.length && node.textContent === preset.id);
        assert(label, 'Preset missing: ' + preset.id);
        label.parentElement.click(); await wait(30);
        for (const key of api.remap.activeProfile.physicalKeys.values()) {
          if (key.active.kind !== 'Single') continue;
          const custom = preset.custom.find(item => item.code === key.physicalKey);
          const level = custom?.level ?? preset.baseLevel;
          const sensitivity = custom?.rapidSensitivity ?? preset.rapidSensitivity;
          assert(key.active.actuation.level === level, preset.id + ': wrong level for ' + key.physicalKey);
          assert(key.active.actuation.isRapidTrigger === (sensitivity >= 0), preset.id + ': wrong rapid state');
          if (sensitivity >= 0)
            assert(key.active.actuation.rapidSensitivity === sensitivity, preset.id + ': wrong sensitivity');
        }
      }
    });
    await check('remap search, dual levels, Fn isolation and Reset use actual controls', async () => {
      api.keyboard.updateKeyremapLayer('Base');
      api.history.push(keyboardRoutes.keyboardDeviceRemaps); await wait(90);
      api.keyboard.clearSelection(); api.keyboard.addKey(26); await wait(30);
      const key = api.remap.activeProfile.physicalKeys.get('26');
      const dual = [...document.querySelectorAll('label')].find(node => node.textContent.includes('Enable Dual'));
      assert(dual, 'Dual checkbox missing'); dual.querySelector('input').click(); await wait(40);
      assert(key.active.kind === 'Dual', 'Dual checkbox did not switch the model');
      const choose = async label => {
        enter(document.querySelector('input[type=text]'), label.toLowerCase()); await wait(35);
        const target = [...document.querySelectorAll('svg[width="55"]')].filter(svg =>
          [...svg.querySelectorAll('text')].some(text => text.textContent === label)).at(-1);
        assert(target, 'Search target missing: ' + label); target.parentElement.click(); await wait(30);
      };
      await choose('F12');
      document.querySelector('div.dual').click(); await wait(20);
      await choose('F11');
      assert(key.active.remapTo[0].targetKeyId === 69 && key.active.remapTo[1].targetKeyId === 68,
        'Dual target assignment changed the wrong level');
      api.keyboard.updateKeyremapLayer('Fn'); await wait(30); await choose('F12');
      assert(key.active.fnPressed.remapTo[1].targetKeyId === 69 && key.active.remapTo[1].targetKeyId === 68,
        'Fn target assignment changed Base');
      const reset = () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Reset').click();
      reset(); await wait(25);
      assert(key.active.fnPressed.remapTo.every(target => target.targetKeyId === 26), 'Fn Reset missed a level');
      assert(key.active.remapTo[0].targetKeyId === 69, 'Fn Reset modified Base');
      api.keyboard.updateKeyremapLayer('Base'); await wait(25); reset(); await wait(25);
      dual.querySelector('input').click(); await wait(30);
      assert(key.active.kind === 'Single' && key.active.remapTo.targetKeyId === 26,
        'Base Reset or returning to Single failed');
    });
    await check('Profiles page creates, autosaves the name, selects and deletes a software profile', async () => {
      api.ui.tools=true;api.render();await wait(120);
      const count = api.keyboard.profiles.length;
      const previousId=api.keyboard.activeProfile.id;
      const create=[...document.querySelectorAll('.profiles-page button')].find(button=>button.textContent.trim()==='+ New');
      assert(create,'New software profile button missing');create.click();
      for(let n=0;n<80 && (api.keyboard.profiles.length===count || api.keyboard.activeProfile.id===previousId || create.disabled);n++)await wait(25);
      await wait(80);
      const input = document.querySelector('.profile-name-input');
      assert(input, 'Profile name input missing');
      enter(input, 'Standalone profile test');
      await wait(40);
      input.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));
      for(let n=0;n<40 && api.keyboard.activeProfile.name!=='Standalone profile test';n++)await wait(25);
      assert(
        api.keyboard.profiles.length === count + 1 &&
          api.keyboard.activeProfile.name === 'Standalone profile test',
        'New profile did not become active: '+JSON.stringify({count:api.keyboard.profiles.length,expected:count+1,name:api.keyboard.activeProfile.name,error:activeContext.profiles.view.error,text:document.querySelector('.profile-error')?.textContent}),
      );
      const remove=document.querySelector('.profile-delete');assert(remove,'Delete profile button missing');
      for(let n=0;n<80 && remove.disabled;n++)await wait(25);
      await api.flushSave();await wait(80);
      remove.click();await wait(35);
      assert(document.querySelector('.profile-delete').textContent==='Confirm delete','Delete confirmation missing: '+JSON.stringify({text:document.querySelector('.profile-delete').textContent,disabled:document.querySelector('.profile-delete').disabled}));
      document.querySelector('.profile-delete').click();
      for(let n=0;n<40 && api.keyboard.profiles.length!==count;n++)await wait(25);
      assert(api.keyboard.profiles.length === count, 'Profile deletion failed');
      api.ui.tools=false;api.render();
    });
    await check('macro editor creates, edits, reorders and deletes actual actions', async () => {
      api.history.push(keyboardRoutes.keyboardDeviceMacros);
      api.render();
      await wait(300);
      const button = [...document.querySelectorAll('button')].find(
        (e) => e.textContent === 'Add Macro',
      );
      assert(button, 'Add Macro button missing');
      button.click();
      await wait(80);
      const input = document.querySelector('[role=dialog] input[type=text]');
      assert(input, 'Macro name input missing');
      enter(input, 'Standalone macro test');
      await wait(50);
      const add = [...document.querySelectorAll('[role=dialog] button')].find(
        (e) => e.textContent === 'Add',
      );
      assert(add && !add.disabled, 'Macro Add missing');
      add.click();
      await wait(180);
      assert(
        api.history.location.pathname === keyboardRoutes.keyboardMacros,
        'Macro editor route was not opened',
      );
      assert(
        [...document.querySelectorAll('input')].some(
          (input) => input.value === 'Standalone macro test',
        ),
        'Created macro not shown in editor',
      );
      const addFunction = [...document.querySelectorAll('button')].find(
        (e) => e.textContent === 'Add Function',
      );
      assert(addFunction, 'Macro Add Function missing');
      addFunction.click();
      await wait(150);
      assert(
        api.remap.editingMacro.remapTo.action.targetKeys.length === 2,
        'Default press/release action pair was not created',
      );
      const macro = api.remap.editingMacro.remapTo;
      const delay = document.querySelector('input[type=number]');
      assert(delay, 'Action delay input missing');
      enter(delay, '135'); await wait(25);
      assert(macro.action.targetKeys[0].delaySeconds === 0.135, 'Delay milliseconds did not reach the model');
      enter(delay, '-10'); await wait(20);
      delay.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); await wait(25);
      assert(macro.action.targetKeys[0].delaySeconds === 0.02, 'Invalid delay was not clamped on blur');
      const handles = [...document.querySelectorAll('[draggable=true]')];
      assert(handles.length === 2, 'Actual macro drag handles missing');
      const second = macro.action.targetKeys[1], transfer = new DataTransfer();
      const rect = handles[1].parentElement.getBoundingClientRect();
      const fire = (node, type) => node.dispatchEvent(new DragEvent(type, {
        bubbles: true, cancelable: true, dataTransfer: transfer,
        clientX: rect.left + 10, clientY: rect.bottom - 1,
      }));
      fire(handles[0], 'dragstart'); await wait(30);
      assert(api.remap.isDraggingMacro, 'Macro drag did not start');
      fire(handles[1].parentElement, 'dragenter'); fire(handles[1].parentElement, 'dragover'); await wait(40);
      fire(handles[1].parentElement, 'drop'); fire(handles[0], 'dragend'); await wait(35);
      assert(macro.action.targetKeys[0] === second, 'Actual action rows did not reorder');
      assert(!api.remap.isDraggingMacro, 'Drag state remained active');
      const remove = [...document.querySelectorAll('button')].find(
        (e) => e.textContent === 'Delete Macro',
      );
      assert(remove, 'Macro delete control missing');
      remove.click();
      await wait(120);
      assert(
        !api.remap.macroRemaps.some((m) => m.remapTo.name === 'Standalone macro test'),
        'Macro was not deleted',
      );
    });

    const actuation = api.remap.activeProfile.physicalKeys.get('26').active.actuation;
    sessionStorage.setItem(
      'keyboard-reload-test',
      JSON.stringify({
        cases,
        original,
        expected: {
          pollingRate: api.keyboard.activeProfile.settings.pollingRate,
          level: actuation.level,
          rapid: actuation.isRapidTrigger,
          lighting: Object.fromEntries(
            ['baseZones', 'perimeterZones', 'reactiveZones'].map((name) => [
              name,
              getSnapshot(api.keyboard.activeProfile.settings[name]),
            ]),
          ),
        },
      }),
    );
    location.reload();
    return;
  } catch (error) {
    cases.push({ name: 'startup', status: 'failed', error: String(error.stack || error) });
  }
  reportVerification({
    status: cases.every((x) => x.status === 'passed') ? 'passed' : 'failed',
    cases,
  });
})();
