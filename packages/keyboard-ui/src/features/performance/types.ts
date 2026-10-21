import type { KeyboardReadyDevice } from '../../models/deviceTypes.js';
import type { KeyboardDeviceProfileInstance } from '../../models/KeyboardDeviceProfile.js';
import type { KeyRemapDeviceProfileInstance } from '../../models/KeyRemapDeviceProfile.js';
import type { PhysicalKeyInstance } from '../../models/KeyRemapSettings.js';

export interface PerformanceProps {
  readyKeyboardDevice: KeyboardReadyDevice;
  keyboardDeviceProfile: KeyboardDeviceProfileInstance;
  keyRemapDeviceProfile: KeyRemapDeviceProfileInstance;
}
export interface SelectedActuationKey {
  keyCode: number;
  physicalKeyModel: PhysicalKeyInstance;
}
