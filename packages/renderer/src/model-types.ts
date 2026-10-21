import type {
  KeyRemapDeviceProfileInstance,
  KeyRemapDeviceProfileSnapshot,
  InitialRemapSetting,
} from '../../keyboard-ui/src/models/KeyRemapDeviceProfile.js';
import type { KeyboardReadyDevice } from '../../keyboard-ui/src/models/deviceTypes.js';
import type {
  KeyboardDeviceProfileInstance,
  KeyboardDeviceProfileSnapshot,
} from '../../keyboard-ui/src/models/KeyboardDeviceProfile.js';
import type {
  KeyboardProfileSnapshot,
  HardwareKeyboardProfileInstance,
} from '../../keyboard-ui/src/models/KeyboardProfile.js';

/** Composition types use actual model definitions and device contracts. */
export type ProfileSnapshot = KeyboardProfileSnapshot;
export type HardwareProfileModel = HardwareKeyboardProfileInstance;
/** Persisted selection/list fields are required by the existing storage reader. */
export type KeyboardSnapshot = KeyboardDeviceProfileSnapshot & {
  activeProfileId: string;
  softwareProfiles: KeyboardProfileSnapshot[];
};
export type KeyboardModel = KeyboardDeviceProfileInstance;
export type RemapSnapshot = KeyRemapDeviceProfileSnapshot;
export type FixtureRemap = InitialRemapSetting;
export type RemapModel = KeyRemapDeviceProfileInstance;
export type Device = KeyboardReadyDevice;
