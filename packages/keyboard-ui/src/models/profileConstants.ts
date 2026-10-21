/** Keyboard default identity and values; independent of model initialization. Recovered from packages/keyboard-ui/src/recovered/cycles/KeyboardProfile-getDefaultProfile-ee6e2a5195.jsx. */

import { PollingRate } from './keyboardEnums.js';
const DEFAULT_PROFILE_ID = 'DEFAULT';

const FUNCTION_ELITE_DEFAULT_SETTINGS = {
  idleTimeout: {
    disabled: true,
    timeoutSeconds: 60,
  },
  fnLockEnabled: false,
  gameModeEnabled: false,
  pollingRate: PollingRate.Hz1000,
  baseZones: [],
  reactiveZones: [],
};
export { DEFAULT_PROFILE_ID, FUNCTION_ELITE_DEFAULT_SETTINGS };
