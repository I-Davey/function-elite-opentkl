import type { StateTicket } from '../../application-state/src/index.js';
import type { LiveControls } from '../../renderer-state/src/device-controls.js';
import type { RendererContext, ProfileSync, HardwareSync } from './context.js';
import type { HardwareProfileModel } from './model-types.js';
import { getSnapshot } from 'mobx-state-tree';
import { createDefaultKeyboardProfile } from '../../keyboard-ui/src/models/profileDefaults.js';
import { HardwareKeyboardProfile } from '../../keyboard-ui/src/models/KeyboardProfile.js';
import { KeyboardSettings } from '../../keyboard-ui/src/models/KeyboardSettings.js';
import { validatedSnapshot } from '../../keyboard-ui/src/models/validation.js';
import { i18n } from '../../ui-platform/src/i18n.cjs';

/** Reads may update models only while the coordinator's connection/selection ticket is current. */
export function createProfileSync(
  context: RendererContext,
  requestedHardwareId: string | null,
): ProfileSync {
  const { keyboard, remap, device, host, state } = context;
  const loadedSlots = new Set<number>();
  let cacheGeneration = state.getSnapshot().connectionGeneration;
  keyboard.addHardwareProfiles([0,1,2,3].filter(slot => !keyboard.hardwareProfiles.some(profile => profile.hardwareProfileId === slot)).map(slot =>
    HardwareKeyboardProfile.create({ id: 'hardware-' + slot, hardwareProfileId: slot,
      name: i18n.t('keyboard:onboardProfile', { profileNumber: slot + 1 }),
      settings: getSnapshot(createDefaultKeyboardProfile(device).settings) })));
  // The shared state owns the DOM lock too: an old read cannot unlock its replacement.
  const mirrorHydration = (): void => {
    const workspace = document.getElementById('keyboard-workspace');
    const selected = keyboard.activeProfile.hardwareProfileId;
    const loading = selected !== undefined && !loadedSlots.has(selected) && state.getSnapshot().phase !== 'disconnected';
    if (state.getSnapshot().hydrationDepth > 0 || loading) {
      workspace?.setAttribute('inert', '');
      workspace?.setAttribute('aria-busy', 'true');
    } else {
      workspace?.removeAttribute('inert');
      workspace?.removeAttribute('aria-busy');
    }
  };
  const disposeHydration = state.subscribe(mirrorHydration);
  async function syncHardwareProfiles(
    ownerTicket?: StateTicket,
  ): Promise<HardwareSync> {
    if (
      state.getSnapshot().phase === 'disconnected' ||
      state.getSnapshot().phase === 'error'
    ) {
      const attempt = state.beginConnection();
      try {
        const connection = await host.connection();
        state.connected(
          {
            id: connection.devicePath ?? 'nzxt-function-elite',
            firmware: connection.firmware,
          },
          attempt,
        );
      } catch (error) {
        if (state.isCurrent(attempt)) state.disconnect();
        throw error;
      }
    }
    const generation = state.getSnapshot().connectionGeneration;
    if (generation !== cacheGeneration) { loadedSlots.clear(); cacheGeneration = generation; }
    const connection = await host.connection();
    if (ownerTicket) state.assertCurrent(ownerTicket);
    if (ownerTicket && connection.activeProfileIndex !== keyboard.activeProfile.hardwareProfileId)
      throw Error('Keyboard profile changed during selection; refresh');
    if (loadedSlots.has(connection.activeProfileIndex) && context.diagnostics.hardwareSync) {
      const hydration = state.beginHydration(ownerTicket);
      try {
        hydration.commit(() => keyboard.setActiveProfileId('hardware-' + connection.activeProfileIndex, { fromDevice: true }));
        syncLiveValues(connection, ownerTicket);
      } finally { hydration.close(); }
      state.selectProfile({ kind: 'onboard', wireIndex: connection.activeProfileIndex });
      const summary = { ...context.diagnostics.hardwareSync, activeWireSlot: connection.activeProfileIndex };
      context.diagnostics.hardwareSync = summary;
      return summary;
    }
    const scope = state.beginHydration(ownerTicket);
    const workspace = document.getElementById('keyboard-workspace');
    workspace?.setAttribute('inert', '');
    workspace?.setAttribute('aria-busy', 'true');
    let activeSlot: number | null = null;
    let summary: HardwareSync | undefined;
    try {
      context.setStatusLabel('Loading selected onboard profile…');
      const snapshot = await host.state(true);
      const actuation = await host.actuation();
      if (snapshot.activeProfile.wireIndex !== actuation.activeProfileIndex)
        throw Error('Keyboard profile changed during synchronization; refresh');
      const nativeRemaps = await host.remaps(actuation.activeProfileIndex);
      if (nativeRemaps.activeProfileIndex !== actuation.activeProfileIndex)
        throw Error('Profile changed while loading remaps');
      const snapProfiles = await host.snap(true);
      summary = scope.commit(() => {
        for (const { key, active } of nativeRemaps.configs)
          remap.addHardwareKeyRemapSetting(
            { kind: 'Hardware', id: actuation.activeProfileIndex },
            key,
            active,
          );
        const target = remap.hardwareKeyRemapSettingsMap?.get(
          String(actuation.activeProfileIndex),
        );
        if (!target || actuation.actuations.length !== 88)
          throw Error('Incomplete keyboard actuation model');
        remap.resetHardwareSnapOverrides(actuation.activeProfileIndex);
        for (const profile of snapProfiles.filter(profile => profile.wireIndex === actuation.activeProfileIndex))
          for (const config of profile.configs)
            remap.addHardwareSnapOverride(
              { kind: 'Hardware', id: profile.wireIndex },
              config,
            );
        const profiles: HardwareProfileModel[] = snapshot.profiles
          .filter((profile) => profile.kind === 'Hardware' && profile.wireIndex === actuation.activeProfileIndex)
          .map((profile) => {
            const lighting = snapshot.lighting.profiles.find(
              (layer) => layer.wireIndex === profile.wireIndex,
            );
            if (!lighting) throw Error('Missing onboard lighting profile');
            const settings = getSnapshot(
              createDefaultKeyboardProfile(device).settings,
            );
            return HardwareKeyboardProfile.create(
              validatedSnapshot(HardwareKeyboardProfile, {
                id: 'hardware-' + profile.id,
                hardwareProfileId: profile.id,
                name: i18n.t('keyboard:onboardProfile', {
                  profileNumber: profile.id + 1,
                }),
                keyBrightness:snapshot.brightnessKeys,
                perimeterBrightness:snapshot.brightnessRing,
                settings: {
                  ...settings,
                  pollingRate: profile.pollingRate,
                  gameModeEnabled: profile.gameModeEnabled,
                  fnLockEnabled: profile.fnLockEnabled ?? false,
                  idleTimeout: {
                    ...settings.idleTimeout,
                    ...profile.idleTimeout,
                  },
                  baseZones: lighting.baseZones,
                  perimeterZones: lighting.perimeterZones,
                  reactiveZones: lighting.reactiveZones,
                },
              }),
            );
          });
        for (const key of actuation.actuations) {
          const physical = target.physicalKeys.get(String(key.physicalKey));
          if (!physical) throw Error('Missing physical key in actuation model');
          const active = physical.active;
          if (active.kind === 'Single') {
            active.actuation.setLevel(key.levelIndex);
            active.actuation.setRapidTrigger(key.config.kind === 'Rapid');
            if (key.config.kind === 'Rapid')
              active.actuation.setRapidSensitivity(key.rapidSensitivityIndex);
          } else if (active.kind === 'Dual') {
            active.actuation.setLevel1(key.levelIndex);
            active.actuation.setLevel2(key.secondLevelIndex);
          } else throw Error('HE physical keys require configurable actuation');
        }
        keyboard.addHardwareProfiles(profiles);
        loadedSlots.add(actuation.activeProfileIndex);
        if (loadedSlots.size === 4) state.markHardwareProfilesLoaded(scope.ticket);
        context.diagnostics.deviceState = snapshot;
        context.diagnostics.nativeActuation = actuation;
        context.diagnostics.nativeRemaps = nativeRemaps;
        const value: HardwareSync = {
          source: 'Rust',
          hardwareProfiles: loadedSlots.size,
          actuationKeys: actuation.actuations.length,
          activeWireSlot: actuation.activeProfileIndex,
          completeProfile: false,
          completeActiveProfile: true,
          inactiveActuationSource: 'read-on-selection',
          allProfilesRead: loadedSlots.size === 4,
          deviceSettingsLinked: context.deviceControls !== null,
          remapRecords: nativeRemaps.records.length,
        };
        context.diagnostics.hardwareSync = value;
        if (
          requestedHardwareId ||
          !new URLSearchParams(window.location.search).has('test')
        ) {
          keyboard.setActiveProfileId(
            'hardware-' + actuation.activeProfileIndex,
            {
              fromDevice: true,
            },
          );
          keyboard.setKeyBrightness(snapshot.brightnessKeys, {
            fromDevice: true,
          });
          keyboard.setPerimeterBrightness(snapshot.brightnessRing, {
            fromDevice: true,
          });
        }
        activeSlot = actuation.activeProfileIndex;
        return value;
      });
      context.setStatusLabel('Keyboard settings and remaps read from device');
    } finally {
      scope.close();
      mirrorHydration();
    }
    // Profile selection invalidates old work, so mirror it after closing hydration.
    if (activeSlot !== null) {
      const selected = keyboard.activeProfile;
      state.selectProfile(
        selected.hardwareProfileId === undefined
          ? { kind: 'software', id: selected.id, wireIndex: 4 }
          : { kind: 'onboard', wireIndex: selected.hardwareProfileId },
      );
    }
    if (!summary) throw Error('Missing hardware synchronization result');
    return summary;
  }
  function syncLiveValues(
    value: LiveControls,
    ownerTicket?: StateTicket,
  ): void {
    if (
      value.brightnessChannels.length !== 2 ||
      value.brightnessChannels.some(
        (channel) => !Number.isInteger(channel) || channel < 0 || channel > 100,
      )
    )
      throw Error('Invalid live keyboard controls');
    const scope = state.beginHydration(ownerTicket);
    try {
      scope.commit(() => {
        if (keyboard.keyBrightness !== value.brightnessChannels[0] / 100)
          keyboard.setKeyBrightness(value.brightnessChannels[0] / 100, {
            fromDevice: true,
          });
        if (keyboard.perimeterBrightness !== value.brightnessChannels[1] / 100)
          keyboard.setPerimeterBrightness(value.brightnessChannels[1] / 100, {
            fromDevice: true,
          });
        const selected = keyboard.activeProfile;
        if ((selected.hardwareProfileId ?? 4) === value.activeProfileIndex) {
          if (selected.settings.gameModeEnabled !== value.gameModeEnabled)
            selected.settings.setGameModeEnabled(value.gameModeEnabled, {
              fromDevice: true,
            });
          if (selected.settings.fnLockEnabled !== value.fnLockEnabled)
            selected.settings.setFnLockEnabled(value.fnLockEnabled);
        }
      });
    } finally {
      scope.close();
    }
  }
  return {
    syncHardwareProfiles,
    syncLiveValues,
    isHardwareProfileLoaded: (slot: number) => loadedSlots.has(slot),
    invalidateHardwareCache: (slot?: number) => { if (slot === undefined) loadedSlots.clear(); else loadedSlots.delete(slot); state.invalidateHardwareCache(); },
    dispose: disposeHydration,
  };
}
