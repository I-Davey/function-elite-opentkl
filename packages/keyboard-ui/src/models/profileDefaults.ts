import { KeyboardSettings } from './KeyboardSettings.js';
import { getDefaultBaseZone, getDefaultReactiveZone, getDefaultPerimeterZone, type KeyboardLightingDevice } from './defaultZones.js';
import { KeyboardProfile } from './KeyboardProfile.js';
import { DEFAULT_PROFILE_ID, FUNCTION_ELITE_DEFAULT_SETTINGS } from './profileConstants.js';

export const DefaultSoftwareProfile: Partial<Record<string, typeof FUNCTION_ELITE_DEFAULT_SETTINGS>> = {
  FunctionEliteIso: FUNCTION_ELITE_DEFAULT_SETTINGS,
  FunctionEliteAnsi: FUNCTION_ELITE_DEFAULT_SETTINGS,
};

export function getDefaultKeyboardProfileSettings(device?: KeyboardLightingDevice) {
  if (!device) return KeyboardSettings.create(FUNCTION_ELITE_DEFAULT_SETTINGS);
  const defaults = DefaultSoftwareProfile[device.deviceType];
  if (!defaults) throw new Error(`No default profile settings for ${device.deviceType}`);
  return KeyboardSettings.create({ ...defaults, baseZones: getDefaultBaseZone(device),
    reactiveZones: getDefaultReactiveZone(device), perimeterZones: getDefaultPerimeterZone(device) });
}

export function createDefaultKeyboardProfile(device?: KeyboardLightingDevice) {
  return KeyboardProfile.create({ id: DEFAULT_PROFILE_ID, name: 'Software Profile 1',
    settings: getDefaultKeyboardProfileSettings(device) });
}
