import { object, jsonObject, type ProfileDocument } from '../../contracts/desktop.cjs';
import { profileEdit } from '../../contracts/desktop-requests.cjs';
import type { KeyboardSnapshot, ProfileSnapshot, RemapSnapshot } from './model-types.js';
import { KeyboardSettings } from '../../keyboard-ui/src/models/KeyboardSettings.js';
import { validatedSnapshot } from '../../keyboard-ui/src/models/validation.js';
import { KeyboardDeviceProfile } from '../../keyboard-ui/src/models/KeyboardDeviceProfile.js';

function nonempty(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw Error('Invalid ' + name);
  return value;
}
export function keyboardSnapshot(value: unknown): KeyboardSnapshot {
  const row = object(value, 'keyboard profiles');
  if (!Array.isArray(row.softwareProfiles)) throw Error('Invalid software profiles');
  const softwareProfiles = row.softwareProfiles.map((entry: unknown): ProfileSnapshot => {
    const profile = object(entry, 'software profile');
    return {
      ...profile,
      id: nonempty(profile.id, 'profile id'),
      ...(typeof profile.name === 'string' ? { name: profile.name } : {}),
      ...(typeof profile.lastSelected === 'number' ? { lastSelected: profile.lastSelected } : {}),
      settings: validatedSnapshot(
        KeyboardSettings,
        profileEdit({
          wireIndex: 0,
          settings: profile.settings,
          physicalKeys: [],
          snapConfigs: [],
        }).settings,
      ),
    };
  });
  return {
    ...row,
    deviceUniqueId: nonempty(row.deviceUniqueId, 'device identity'),
    deviceType: nonempty(row.deviceType, 'device type'),
    activeProfileId: nonempty(row.activeProfileId, 'active profile'),
    softwareProfiles,
    ...(typeof row.keyboardRegion === 'string'
      ? {
          keyboardRegion: validatedSnapshot(
            KeyboardDeviceProfile.properties.keyboardRegion,
            row.keyboardRegion,
          ),
        }
      : {}),
  };
}
export function remapSnapshot(value: unknown): RemapSnapshot {
  const row = object(value, 'remap profiles');
  const result: RemapSnapshot = {
    ...row,
    deviceUniqueId: nonempty(row.deviceUniqueId, 'remap device identity'),
    deviceType: nonempty(row.deviceType, 'remap device type'),
  };
  if (row.activeProfileId !== undefined) {
    const active = object(row.activeProfileId, 'remap profile selection');
    if (active.kind === 'Hardware' && typeof active.id === 'number')
      result.activeProfileId = { kind: active.kind, id: active.id };
    else if (active.kind === 'Software' && typeof active.id === 'string')
      result.activeProfileId = { kind: active.kind, id: active.id };
    else throw Error('Invalid remap profile selection');
  }
  return result;
}
export function profileDocument(value: unknown): ProfileDocument {
  const row = jsonObject(value);
  const keyboard = object(row.keyboard, 'keyboard snapshot');
  if (
    row.schemaVersion !== 1 ||
    typeof keyboard.activeProfileId !== 'string' ||
    !Array.isArray(keyboard.softwareProfiles)
  )
    throw Error('Invalid saved keyboard snapshot');
  object(row.remap, 'remap snapshot');
  return row as ProfileDocument;
}
