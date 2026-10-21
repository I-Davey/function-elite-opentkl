import type { ControlSnapshot } from '../../renderer-state/src/device-controls.js';
import type { RendererContext } from './context.js';
import type { PhysicalKeyInstance } from '../../keyboard-ui/src/models/KeyRemapSettings.js';
import { getSnapshot } from 'mobx-state-tree';

export function captureControlSnapshot(context: RendererContext): ControlSnapshot {
  const { keyboard, remap } = context;
  if (keyboard.keyBrightness === undefined || keyboard.perimeterBrightness === undefined)
    throw Error('Keyboard brightness has not been hydrated');
  function snapshotPhysicalKeys(keys: Iterable<PhysicalKeyInstance>) {
    return [...keys].map((key) => {
      const snapshot = getSnapshot(key);
      if (snapshot.active.kind === 'NoConfigurableActuation')
        throw Error('HE physical keys require configurable actuation');
      return {
        physicalKey: snapshot.physicalKey,
        active: { ...snapshot.active, fnPressed: snapshot.active.fnPressed ?? undefined },
      };
    });
  }

  const selected = keyboard.activeProfile,
    settings = selected.settings,
    activeRemap = remap.activeProfile;
  const physical = snapshotPhysicalKeys(activeRemap?.physicalKeys.values() ?? []);
  const remaps: ControlSnapshot['remaps'] = physical.flatMap((key) => {
    const active = key.active,
      out: ControlSnapshot['remaps'] = [];
    for (const fnLayer of [false, true]) {
      const outputs = fnLayer ? active.fnPressed?.remapTo : active.remapTo;
      if (!outputs) continue;
      (Array.isArray(outputs) ? outputs : [outputs]).forEach((output, level) =>
        out.push({ physicalKey: key.physicalKey, level, fnLayer, remap: output }),
      );
    }
    return out;
  });
  return {
    id: selected.id,
    slot: selected.hardwareProfileId,
    brightnessKeys: keyboard.keyBrightness,
    brightnessRing: keyboard.perimeterBrightness,
    pollingRate: settings.pollingRate,
    gameMode: settings.gameModeEnabled,
    fnLock: settings.fnLockEnabled,
    idleMinutes: settings.idleTimeout.disabled
      ? 0
      : Math.ceil(settings.idleTimeout.timeoutSeconds / 60),
    snap: activeRemap ? getSnapshot(activeRemap.snapOverrideConfigs) : [],
    remaps,
    hardware: keyboard.hardwareProfiles.map((profile) => {
      const mappings = remap.hardwareKeyRemapSettingsMap?.get(String(profile.hardwareProfileId));
      return {
        wireIndex: profile.hardwareProfileId,
        settings: {...getSnapshot(profile.settings),keyBrightness:profile.keyBrightness,perimeterBrightness:profile.perimeterBrightness},
        physicalKeys: snapshotPhysicalKeys(mappings?.physicalKeys.values() ?? []),
        snapConfigs: mappings ? getSnapshot(mappings.snapOverrideConfigs) : [],
      };
    }),
    software:
      selected.hardwareProfileId === undefined && activeRemap
        ? {
            wireIndex: 4,
            settings: {...getSnapshot(settings),keyBrightness:selected.keyBrightness,perimeterBrightness:selected.perimeterBrightness},
            physicalKeys: physical,
            snapConfigs: getSnapshot(activeRemap.snapOverrideConfigs),
          }
        : null,
    actuation: physical.map((key) =>
      key.active.kind === 'Dual'
        ? {
            physicalKey: key.physicalKey,
            kind: 'Dual',
            levelIndex: key.active.actuation.level1,
            secondLevelIndex: key.active.actuation.level2,
            rapidSensitivityIndex: 0,
          }
        : {
            physicalKey: key.physicalKey,
            kind: key.active.actuation.isRapidTrigger ? 'Rapid' : 'Single',
            levelIndex: key.active.actuation.level,
            secondLevelIndex: 0,
            rapidSensitivityIndex: key.active.actuation.rapidSensitivity,
          },
    ),
    Base: getSnapshot(settings.baseZones),
    Ring: getSnapshot(settings.perimeterZones),
    Reactive: getSnapshot(settings.reactiveZones),
    originatedFromDevice: new Set([
      ...keyboard.originatedFromDevice,
      ...settings.originatedFromDevice,
    ]),
  };
}
