import {keyboardRoutes} from '../../keyboard-ui/src/keyboardRoutes.js';
import { getVerificationServices, reportVerification } from './runtime.js';
import { keyBrightness } from '../../keyboard-ui/src/logic/key-brightness.js';
const { activeContext, captureControlSnapshot, getKeyBrightnessControl } = getVerificationServices();

/** Native acceptance uses one live controller. Local UI exercises run in the offline suite. */
(async () => {
  const query = new URLSearchParams(location.search);
  if (
    !query.has('test') ||
    !query.has('live') ||
    ['brightness', 'parity'].some((key) => query.has(key))
  )
    return;
  const cases = [],
    restores = [],
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const assert = (value, message) => {
    if (!value) throw Error(message);
  };
  const canonical = (value) =>
    JSON.stringify(value, (key, item) =>
      key === 'id'
        ? undefined
        : item && typeof item === 'object' && !Array.isArray(item)
          ? Object.fromEntries(
              Object.keys(item)
                .sort()
                .map((name) => [name, item[name]]),
            )
          : item,
    );
  const clone = (value) => JSON.parse(JSON.stringify(value));
  let context,
    api,
    host,
    controls,
    initialLocal,
    before,
    after,
    initialSlot,
    originalSelection,
    softwareStarted = false,
    fixtureLightingUsed = false,
    failed = false;
  const info = {
    scope: 'native transactions, independent content reads and renderer integration',
    stockFirmware: true,
    controllerDisposed: false,
    temporaryProfileSelection: true,
  };
  const check = async (name, operation) => {
    try {
      await operation();
      assert(!context.diagnostics.lastError, context.diagnostics.lastError);
      cases.push({ name, status: 'passed' });
    } catch (error) {
      cases.push({ name, status: 'failed', error: String(error.stack || error) });
      throw error;
    }
  };
  function local(action) {
    const hydration = context.state.beginHydration();
    try {
      hydration.commit(action);
    } finally {
      hydration.close();
    }
    const selected = api.keyboard.activeProfile;
    context.state.selectProfile(
      selected.hardwareProfileId === undefined
        ? { kind: 'software', id: selected.id, wireIndex: 4 }
        : { kind: 'onboard', wireIndex: selected.hardwareProfileId },
    );
  }
  function chooseOnboard() {
    local(() => api.keyboard.setActiveProfileId('hardware-' + initialSlot, { fromDevice: true }));
  }
  async function fingerprint() {
    assert(!controls.busy(), 'Pending edit before independent capture');
    const hydration = context.state.beginHydration();
    let value;
    try {
      const connection = await host.connection();
      assert(
        connection.activeProfileIndex < 4,
        'Finish the software session before profile-content capture',
      );
      const state = await host.state(),
        all = await host.allProfileConfigs(),
        snaps = await host.snap();
      assert(
        state.readOnly && state.settingsWritePerformed === false,
        'State capture performed a content write',
      );
      assert(
        all.profiles.length === 4 &&
          all.returnedToOriginalSlot &&
          all.profileContentsWritten === false,
        'Full onboard capture did not restore its selected slot',
      );
      value = {
        activeSlot: state.activeProfile.wireIndex,
        brightnessKeys: state.brightnessKeys,
        brightnessRing: state.brightnessRing,
        metadata: state.profiles
          .map((profile) => ({
            wireIndex: profile.wireIndex,
            pollingRate: profile.pollingRate,
            idleTimeout: profile.idleTimeout,
            gameModeEnabled: profile.gameModeEnabled,
            fnLockEnabled: profile.fnLockEnabled,
            uninterpretedField7: profile.uninterpretedField7,
          }))
          .sort((a, b) => a.wireIndex - b.wireIndex),
        lighting: state.lighting.profiles
          .map((profile) => ({
            wireIndex: profile.wireIndex,
            baseZones: profile.baseZones,
            perimeterZones: profile.perimeterZones,
            reactiveZones: profile.reactiveZones,
          }))
          .sort((a, b) => a.wireIndex - b.wireIndex),
        onboard: all.profiles
          .map((profile) => ({
            wireIndex: profile.wireIndex,
            actuation: profile.actuation.actuations
              .map((key) => ({ physicalKey: key.physicalKey, rawWord: key.rawWord }))
              .sort((a, b) => a.physicalKey - b.physicalKey),
            remaps: profile.remaps.records
              .map((record) => ({
                physicalKey: record.physicalKey,
                level: record.level,
                fnLayer: record.fnLayer,
                data: record.data,
              }))
              .sort(
                (a, b) =>
                  a.physicalKey - b.physicalKey ||
                  a.level - b.level ||
                  Number(a.fnLayer) - Number(b.fnLayer),
              ),
          }))
          .sort((a, b) => a.wireIndex - b.wireIndex),
        snap: snaps
          .map((profile) => ({ wireIndex: profile.wireIndex, configs: profile.configs }))
          .sort((a, b) => a.wireIndex - b.wireIndex),
      };
    } finally {
      hydration.close();
    }
    const serialized = canonical(value),
      digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
    return {
      value,
      sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
        '',
      ),
    };
  }
  async function restoreReceipt(edit) {
    const ticket = context.state.beginRecovery('Restore native acceptance edit');
    try {
      if (edit.kind === 'software') await host.releaseSoftwareProfile();
      else {
        const method = {
          field: 'restoreField',
          lighting: 'restoreLighting',
          actuation: 'restoreActuation',
          remap: 'restoreRemap',
          profile: 'restoreProfile',
        }[edit.kind];
        assert(method, 'Unknown recovery kind');
        const backups =
          edit.kind === 'actuation' && edit.receipt.batches?.length
            ? [...edit.receipt.batches].reverse().map((batch) => batch.backup)
            : [edit.receipt.backup];
        for (const backup of backups) await host[method](backup);
      }
      context.state.finishRecovery(ticket);
      await api.syncHardwareProfiles();
    } catch (error) {
      if (
        context.state.isCurrent(ticket) &&
        context.state.getSnapshot().recovery.status === 'running'
      )
        context.state.finishRecovery(ticket, error);
      throw error;
    }
  }
  async function nativeEdit(kind, action, verify) {
    await controls.flush();
    let edit;
    try {
      await action();
      await controls.flush();
      const receipt = controls.last;
      assert(receipt?.editKind === kind, 'Model edit did not dispatch ' + kind);
      assert(
        receipt.outcome === (kind === 'software' ? 'acknowledged' : 'applied'),
        'Unverified ' + kind + ' outcome: ' + receipt.outcome,
      );
      edit = { kind, receipt };
      restores.push(edit);
      if (kind === 'software') softwareStarted = true;
      await verify(receipt);
    } catch (error) {
      if (!edit) {
        const suffix = { field: '', lighting: '-lighting', profile: '-profile' }[kind];
        const candidates =
          String(error.message || error).match(/device-edits\/[\w.-]+-before\.json/g) || [];
        const backup = candidates.find(
          (value) => suffix !== undefined && value.endsWith(suffix + '-before.json'),
        );
        if (backup) {
          edit = { kind, receipt: { backup } };
          restores.push(edit);
        }
        if (kind === 'software') softwareStarted = true;
      }
      throw error;
    } finally {
      if (edit) {
        if (controls.last?.backup === edit.receipt.backup) await controls.undo();
        else await restoreReceipt(edit);
        restores.splice(restores.indexOf(edit), 1);
        if (kind === 'software') softwareStarted = false;
      }
    }
  }
  try {
    context = activeContext;
    assert(context?.api, 'Renderer did not initialize');
    ({ api, host } = context);
    controls = api.connectDeviceControls();
    assert(
      !sessionStorage.getItem('keyboard-reload-test'),
      'A previous reload test is unfinished; preserve its recovery data before running native checks',
    );
    assert(!controls.disposed, 'Live singleton controller was disposed');
    initialLocal = await host.read();
    originalSelection = api.keyboard.activeProfileId;
    const connection = await host.connection();
    assert(
      connection.activeProfileIndex < 4,
      'An existing software session must finish before acceptance',
    );
    initialSlot = connection.activeProfileIndex;
    await check('Rust discovery, stock firmware and complete native model hydration', async () => {
      const discovery = await api.discover();
      assert(
        discovery.status === 'ok' &&
          discovery.nativeLanguage === 'Rust' &&
          discovery.reportIoPerformed === false,
        'Descriptor discovery contract changed',
      );
      const version = await host.firmware();
      assert(
        version.firmware === '2.2.14' &&
          version.readOnly &&
          version.settingsWritePerformed === false,
        'Firmware contract changed',
      );
      const result = await api.syncHardwareProfiles();
      assert(
        result.hardwareProfiles === 4 && result.actuationKeys === 88 && result.remapRecords === 352,
        'Native hydration incomplete',
      );
      assert(context.state.getSnapshot().allProfilesLoaded, 'Four-profile cache not loaded');
      const hydratedConnection = await host.connection();
      assert(
        canonical(hydratedConnection.brightnessChannels) ===
          canonical(connection.brightnessChannels),
        'Initial model hydration changed runtime brightness',
      );
      assert(
        hydratedConnection.activeProfileIndex === connection.activeProfileIndex,
        'Initial model hydration changed the active profile',
      );
      chooseOnboard();
      // Test mode retains local profiles; align live controls before making a model edit.
      api.syncLiveValues(hydratedConnection);
      assert(
        api.keyboard.keyBrightness === hydratedConnection.brightnessChannels[0] / 100,
        'Live brightness fixture was not hydrated',
      );
      for (const key of context.diagnostics.nativeActuation.actuations) {
        const model = api.remap.activeProfile.physicalKeys.get(String(key.physicalKey));
        assert(model, 'Missing hydrated key ' + key.physicalKey);
        if (model.active.kind === 'Single')
          assert(model.active.actuation.level === key.levelIndex, 'Hydrated actuation differs');
      }
    });
    await check(
      'Independent before fingerprint captures every onboard word, remap and lighting layer',
      async () => {
        before = await fingerprint();
        assert(
          before.value.onboard.every(
            (profile) => profile.actuation.length === 88 && profile.remaps.length === 352,
          ),
          'Incomplete profile content capture',
        );
      },
    );
    await check(
      'Fresh sensors and the original Performance monitor show 88 mapped keys and depth guides',
      async () => {
        const sample = await host.sensors();
        assert(
          sample.keys.length === 88 &&
            new Set(sample.keys.map((key) => key.physicalKeyId)).size === 88,
          'Incomplete sensor mapping',
        );
        assert(sample.keys.find((key) => key.label === 'W')?.sensorId === 34, 'W sensor changed');
        api.ui.depth = true;
        api.ui.deviceState = false;
        api.render();
        for (let n = 0; n < 80 && document.querySelectorAll('[data-depth-fill]').length !== 88; n++)
          await wait(50);
        assert(
          document.querySelectorAll('[data-depth-fill]').length === 88,
          'Live keyboard bars missing',
        );
        assert(document.querySelector('[data-mm-reference="0.1"]'), '0.1 mm depth guide missing');
        assert(
          document.querySelectorAll('[data-raw-sensor]').length === 88,
          'Raw sensor table incomplete',
        );
        api.ui.depth = false;
        api.render();
        await wait(80);
      },
    );
    await check(
      'One master-brightness model edit reaches hardware and undo restores it',
      async () => {
        const old = (await host.state()).brightnessKeys,
          next = old < 1 ? old + 0.01 : old - 0.01;
        await nativeEdit(
          'field',
          () => api.keyboard.setKeyBrightness(next, { fromDevice: false }),
          async () => {
            assert(
              (await host.state()).brightnessKeys === Math.round(next * 100) / 100,
              'Brightness readback differs',
            );
          },
        );
        assert((await host.state()).brightnessKeys === old, 'Brightness undo differs');
      },
    );
    await check(
      'Selected-key brightness edits lighting only, preserves other keys and supports undo',
      async () => {
        const baseline = await host.state(),
          original = baseline.lighting.profiles.find(
            (profile) => profile.wireIndex === initialSlot,
          ).baseZones;
        const physical = [...api.remap.activeProfile.physicalKeys.keys()].map(Number);
        async function dimOne() {
          const state = await host.state(),
            zones = state.lighting.profiles.find(
              (profile) => profile.wireIndex === initialSlot,
            ).baseZones;
          const candidate = physical.find((id) => {
            try {
              const level = keyBrightness.inspect(zones, [id]);
              if (level <= 0) return false;
              keyBrightness.adjust(zones, [id], level > 0.4 ? 0.25 : 0.5);
              return true;
            } catch {
              return false;
            }
          });
          assert(candidate !== undefined, 'Controlled palette has no editable key');
          const level = keyBrightness.inspect(zones, [candidate]) > 0.4 ? 0.25 : 0.5;
          api.history.push(keyboardRoutes.keyboardDeviceLighting);
          api.stores.viewStateStore.keyboard.setSelectedEffectLayer('Base');
          api.render();
          await wait(120);
          api.keyboard.clearSelection();
          api.keyboard.addKey(candidate);
          await wait(70);
          const control = getKeyBrightnessControl();
          assert(
            control?.selected && control.keys.length === 1 && control.keys[0] === candidate,
            'Brightness control is not scoped to one key',
          );
          await nativeEdit(
            'lighting',
            () => control.apply(level),
            async () => {
              const read = await host.state(),
                actual = read.lighting.profiles.find(
                  (profile) => profile.wireIndex === initialSlot,
                ).baseZones;
              assert(
                read.brightnessKeys === baseline.brightnessKeys,
                'Per-key dimming changed master brightness',
              );
              for (const id of physical.filter((value) => value !== candidate))
                assert(
                  canonical(zones.find((zone) => zone.keys.includes(id))?.effectSettings) ===
                    canonical(actual.find((zone) => zone.keys.includes(id))?.effectSettings),
                  'Changed unselected key ' + id,
                );
              assert(
                keyBrightness.inspect(actual, [candidate]) <= level + 0.01,
                'Selected key did not dim',
              );
            },
          );
        }
        const editable = physical.some((id) => {
          try {
            return (
              keyBrightness.inspect(original, [id]) > 0 &&
              keyBrightness.adjust(original, [id], 0.25).length <= 10
            );
          } catch {
            return false;
          }
        });
        if (editable) await dimOne();
        else {
          fixtureLightingUsed = true;
          const fixture = [
            {
              id: 'native-acceptance-palette',
              keys: physical,
              effectSettings: { layer: 'Base', kind: 'Color', color: { r: 180, g: 90, b: 255 } },
            },
          ];
          await nativeEdit(
            'lighting',
            () => api.keyboard.activeProfile.settings.setBaseZones(fixture),
            dimOne,
          );
        }
        assert(
          canonical(
            (await host.state()).lighting.profiles.find(
              (profile) => profile.wireIndex === initialSlot,
            ).baseZones,
          ) === canonical(original),
          'Original lighting was not restored',
        );
        api.keyboard.clearSelection();
      },
    );
    await check(
      'A complete captured profile uploads through the native transaction and undo restores it',
      async () => {
        const profile = clone(
          captureControlSnapshot(context).hardware.find((value) => value.wireIndex === initialSlot),
        );
        assert(profile?.physicalKeys.length >= 88, 'No complete hydrated profile');
        profile.settings.gameModeEnabled = !profile.settings.gameModeEnabled;
        await nativeEdit(
          'profile',
          () => controls.schedule({ kind: 'profile', wireIndex: initialSlot, profile }),
          async () => {
            assert(
              (await host.state()).profiles.find((value) => value.wireIndex === initialSlot)
                .gameModeEnabled === profile.settings.gameModeEnabled,
              'Uploaded profile was not read back',
            );
          },
        );
      },
    );
    await check(
      'Software actuation is acknowledged in slot 4 and release restores onboard state',
      async () => {
        const profile = clone(
          captureControlSnapshot(context).hardware.find((value) => value.wireIndex === initialSlot),
        );
        profile.wireIndex = 4;
        profile.settings.gameModeEnabled = !profile.settings.gameModeEnabled;
        await nativeEdit(
          'software',
          () => controls.schedule({ kind: 'software', wireIndex: 4, profile }),
          async (receipt) => {
            assert(
              receipt.actuationReadbackAvailable === false,
              'Software acknowledgement was mislabelled as readback',
            );
            assert(
              (await host.connection()).activeProfileIndex === 4,
              'Software profile did not use slot 4',
            );
          },
        );
        assert(
          (await host.connection()).activeProfileIndex === initialSlot,
          'Software release did not restore the original onboard slot',
        );
      },
    );
    await check(
      'Independent after fingerprint exactly matches all captured device content',
      async () => {
        after = await fingerprint();
        assert(
          after.sha256 === before.sha256,
          'Native content fingerprint differs after restoration',
        );
      },
    );
  } catch (error) {
    failed = true;
    if (!cases.length || cases.at(-1).status !== 'failed')
      cases.push({
        name: 'Native acceptance startup',
        status: 'failed',
        error: String(error.stack || error),
      });
  } finally {
    if (context && controls) {
      api.ui.depth = false;
      api.ui.deviceState = false;
      try {
        context.state.cancelPending();
        if (softwareStarted) await host.releaseSoftwareProfile();
        for (const edit of [...restores].reverse()) {
          await restoreReceipt(edit);
          restores.splice(restores.indexOf(edit), 1);
        }
        if (initialSlot !== undefined) {
          const connection = await host.connection();
          if (connection.activeProfileIndex !== initialSlot)
            await host.applyField({
              field: 'activeProfile',
              wireIndex: initialSlot,
              value: initialSlot,
            });
        }
        if (before && !after) {
          after = await fingerprint();
          assert(before.sha256 === after.sha256, 'Recovery fingerprint differs');
        }
        if (
          originalSelection &&
          api.keyboard.profiles.some((profile) => profile.id === originalSelection)
        )
          local(() => api.keyboard.setActiveProfileId(originalSelection, { fromDevice: true }));
        await api.flushSave();
        if (initialLocal !== undefined) await host.write(initialLocal);
      } catch (error) {
        failed = true;
        cases.push({
          name: 'Restore original controls and profiles',
          status: 'failed',
          error: String(error.stack || error),
        });
      }
      assert(!controls.disposed, 'Acceptance disposed the singleton controller');
    }
    const report = {
      status:
        !failed && cases.length && cases.every((value) => value.status === 'passed')
          ? 'passed'
          : 'failed',
      suite: 'native-lifecycle',
      cases,
      ...info,
      fixtureLightingUsed,
      fingerprints: {
        before: before?.sha256 ?? null,
        after: after?.sha256 ?? null,
        match: !!before && !!after && before.sha256 === after.sha256,
        coverage:
          '4 onboard actuation/remap tables; 5 metadata/lighting profiles; onboard Snap. External acceptance also captures software remaps.',
      },
      pendingRecovery: restores.map((edit) => ({ kind: edit.kind, backup: edit.receipt.backup })),
      softwareActuationEvidence: 'acknowledgement only',
    };
    reportVerification(report);
  }
})();
