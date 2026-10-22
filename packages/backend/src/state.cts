import type * as C from './contracts.cjs';
import { required } from './validation.cjs';

const rates = ['Hz8000', 'Hz4000', 'Hz2000', 'Hz1000', 'Hz500', 'Hz250', 'Hz125'];
/** Decode only verified fields. Lighting effects, remaps and HE words are absent. */
export const decode = (raw: C.DeviceState, activeOnly = false) => {
  if (
    raw.status !== 'ok' ||
    raw.firmware !== '2.2.14' ||
    raw.readOnly !== true ||
    raw.settingsWritePerformed !== false
  )
    throw Error('Unverified device-state contract');
  const integer = (value: number, min: number, max: number, name: string) => {
    if (!Number.isInteger(value) || value < min || value > max) throw Error('Invalid ' + name);
    return value;
  };
  const active = integer(raw.activeProfileIndex, 0, 4, 'active profile');
  if (!Array.isArray(raw.brightnessChannels) || raw.brightnessChannels.length !== 2)
    throw Error('Missing brightness channels');
  const brightness = raw.brightnessChannels.map((v) => integer(v, 0, 100, 'brightness') / 100);
  if (!Array.isArray(raw.profiles) || raw.profiles.length !== (activeOnly ? 1 : 5))
    throw Error('Incomplete profile metadata');
  const seen = new Set(),
    profiles = raw.profiles
      .map((p) => {
        const wireIndex = integer(p.wireIndex, 0, 4, 'profile index');
        if (seen.has(wireIndex)) throw Error('Duplicate profile index');
        seen.add(wireIndex);
        const rateCode = integer(p.field0, 0, 6, 'polling rate code'),
          gameMode = integer(p.field3, 0, 1, 'game mode'),
          idleMinutes = integer(p.field5, 0, 100, 'idle minutes');
        return {
          wireIndex,
          kind: wireIndex < 4 ? 'Hardware' : 'Software',
          id: wireIndex < 4 ? wireIndex : 0,
          pollingRate: rates[rateCode],
          idleTimeout: { disabled: idleMinutes === 0, timeoutSeconds: idleMinutes * 60 },
          gameModeEnabled: gameMode === 1,
          fnLockEnabled:
            p.field4 === undefined ? undefined : integer(p.field4, 0, 1, 'Fn lock') === 1,
          uninterpretedField7: integer(p.field7, 0, 255, 'metadata field 7'),
        };
      })
      .sort((a, b) => a.wireIndex - b.wireIndex);
  return {
    firmware: raw.firmware,
    activeProfile: required(profiles.find((p) => p.wireIndex === active)),
    brightnessKeys: brightness[0],
    brightnessRing: brightness[1],
    profiles,
    readOnly: true,
    settingsWritePerformed: false,
    completeProfile: false,
    source: 'direct-hid',
    sampledAt: new Date().toISOString(),
    nativeReadMs: raw.elapsedMs,
  };
};
