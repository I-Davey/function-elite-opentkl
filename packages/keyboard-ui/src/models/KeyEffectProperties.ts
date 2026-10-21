import {
  KeyboardMouseLightingKeyTrigger,
  KeyboardMouseLightingDirection,
  KeyboardMouseGradientType,
} from './keyboardEnums.js';
import { types, type Instance, type SnapshotIn } from 'mobx-state-tree';

/** Speed__s792v1414. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectProperties.ts. */
const Speed = types
  .model('Speed', {
    speedPercent: types.number,
  })
  .actions((self) => ({
    setSpeedPercent(speedPercent: typeof self.speedPercent) {
      self.speedPercent = speedPercent;
    },
  }));
/** KeyEvent. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectProperties.ts. */
const KeyEvent = types
  .model('KeyEvent', {
    keyEvent: types.enumeration(Object.values(KeyboardMouseLightingKeyTrigger)),
  })
  .actions((self) => ({
    setKeyEvent(keyEvent: typeof self.keyEvent) {
      self.keyEvent = keyEvent;
    },
  }));
/** Direction__s792v1416. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectProperties.ts. */
const Direction = types
  .model('Direction', {
    direction: types.enumeration(Object.values(KeyboardMouseLightingDirection)),
  })
  .actions((self) => ({
    setDirection(direction: typeof self.direction) {
      self.direction = direction;
    },
  }));
/** Value. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectProperties.ts. */
const Value = types
  .model('Value', {
    value: types.number,
  })
  .actions((self) => ({
    setValue(size: typeof self.value) {
      self.value = size;
    },
  }));
/** Size. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectProperties.ts. */
const Size = types
  .model('Size', {
    size: types.model({
      value: types.number,
    }),
  })
  .actions((self) => ({
    setSize(size: typeof self.size.value) {
      self.size.value = size;
    },
  }));
/** GradientType. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectProperties.ts. */
const GradientType = types
  .model('GradientType', {
    gradientType: types.enumeration(Object.values(KeyboardMouseGradientType)),
  })
  .actions((self) => ({
    setGradientType(gradientType: typeof self.gradientType) {
      self.gradientType = gradientType;
    },
  }));
/** PulseColorTypeRainbow. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectProperties.ts. */
const PulseColorTypeRainbow =
  (types
    .model('Smooth', {
      isSmooth: types.optional(types.boolean, true),
    })
    .actions((self) => ({
      setIsSmooth(isSmooth: typeof self.isSmooth) {
        self.isSmooth = isSmooth;
      },
    })),
  types.model({
    kind: types.literal('Rainbow'),
  }));
export { Speed, KeyEvent, Direction, Value, Size, GradientType, PulseColorTypeRainbow };

export type SpeedInstance = Instance<typeof Speed>;
export type SpeedSnapshot = SnapshotIn<typeof Speed>;
export type KeyEventInstance = Instance<typeof KeyEvent>;
export type KeyEventSnapshot = SnapshotIn<typeof KeyEvent>;
export type DirectionInstance = Instance<typeof Direction>;
export type DirectionSnapshot = SnapshotIn<typeof Direction>;
export type ValueInstance = Instance<typeof Value>;
export type ValueSnapshot = SnapshotIn<typeof Value>;
export type SizeInstance = Instance<typeof Size>;
export type SizeSnapshot = SnapshotIn<typeof Size>;
export type GradientTypeInstance = Instance<typeof GradientType>;
export type GradientTypeSnapshot = SnapshotIn<typeof GradientType>;
export type PulseColorTypeRainbowInstance = Instance<typeof PulseColorTypeRainbow>;
export type PulseColorTypeRainbowSnapshot = SnapshotIn<typeof PulseColorTypeRainbow>;
