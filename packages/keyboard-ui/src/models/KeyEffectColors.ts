import { types, type Instance, type SnapshotIn } from 'mobx-state-tree';
import { Colors, Rgb, Color } from './Color.js';
import { PulseColorTypeRainbow, Value, Size } from './KeyEffectProperties.js';
import { Gradient } from './Gradient.js';
/** PulseColorTypeRandom. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const PulseColorTypeRandom = types.model({
  kind: types.literal('Random'),
});
/** PulseColorTypeColors. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const PulseColorTypeColors = types.compose(
  types.model({
    kind: types.literal('Colors'),
  }),
  Colors,
);
/** PulseColorType. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const PulseColorType = types.union(
  PulseColorTypeRainbow,
  PulseColorTypeRandom,
  PulseColorTypeColors,
);
/** FadeColorTypeRainbow. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const FadeColorTypeRainbow = types.model({
  kind: types.literal('Rainbow'),
});
/** FadeColorTypeRandom. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const FadeColorTypeRandom = types.model({
  kind: types.literal('Random'),
});
/** FadeColorTypeColor. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const FadeColorTypeColor = types.compose(
  types.model({
    kind: types.literal('Color'),
  }),
  Rgb,
);
/** FadeColorType. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const FadeColorType = types.union(FadeColorTypeRainbow, FadeColorTypeRandom, FadeColorTypeColor);
/** ColorTypeNoPickerRainbow. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ColorTypeNoPickerRainbow = types.model({
  kind: types.literal('Rainbow'),
});
/** ColorTypeNoPickerRandom. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ColorTypeNoPickerRandom = types.model({
  kind: types.literal('Random'),
});
/** ColorTypeNoPickerGradient. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ColorTypeNoPickerGradient = types.compose(
  types.model({
    kind: types.literal('Gradient'),
  }),
  Gradient,
);
/** ColorTypeNoPicker. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ColorTypeNoPicker = types.union(
  ColorTypeNoPickerRainbow,
  ColorTypeNoPickerRandom,
  ColorTypeNoPickerGradient,
);
/** ReactiveEffectColorTypeWithSizeRainbow. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ReactiveEffectColorTypeWithSizeRainbow = types.compose(
  types.model({
    kind: types.literal('Rainbow'),
  }),
  Value,
);
/** ReactiveEffectColorTypeWithSizeRandom. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ReactiveEffectColorTypeWithSizeRandom = types.compose(
  types.model({
    kind: types.literal('Random'),
  }),
  Value,
);
/** ReactiveEffectColorTypeWithSizeColor. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ReactiveEffectColorTypeWithSizeColor = types.compose(
  types.model({
    kind: types.literal('Color'),
  }),
  Color,
  Size,
);
/** ReactiveEffectColorTypeWithSizeGradient. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ReactiveEffectColorTypeWithSizeGradient = types.compose(
  types.model({
    kind: types.literal('Gradient'),
  }),
  Gradient,
  Size,
);
/** ReactiveEffectColorTypeWithSize. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ReactiveEffectColorTypeWithSize = types.union(
  ReactiveEffectColorTypeWithSizeRainbow,
  ReactiveEffectColorTypeWithSizeRandom,
  ReactiveEffectColorTypeWithSizeColor,
  ReactiveEffectColorTypeWithSizeGradient,
);
/** ReactiveEffectColorTypeNoSizeRainbow. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ReactiveEffectColorTypeNoSizeRainbow = types.model({
  kind: types.literal('Rainbow'),
});
/** ReactiveEffectColorTypeNoSizeRandom. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ReactiveEffectColorTypeNoSizeRandom = types.model({
  kind: types.literal('Random'),
});
/** ReactiveEffectColorTypeNoSizeColor. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ReactiveEffectColorTypeNoSizeColor = types.compose(
  types.model({
    kind: types.literal('Color'),
  }),
  Rgb,
);
/** ReactiveEffectColorTypeNoSizeGradient. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ReactiveEffectColorTypeNoSizeGradient = types.compose(
  types.model({
    kind: types.literal('Gradient'),
  }),
  Gradient,
);
/** ReactiveEffectColorTypeNoSize. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ReactiveEffectColorTypeNoSize = types.union(
  ReactiveEffectColorTypeNoSizeRainbow,
  ReactiveEffectColorTypeNoSizeRandom,
  ReactiveEffectColorTypeNoSizeColor,
  ReactiveEffectColorTypeNoSizeGradient,
);
/** ShiftColorType. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const ShiftColorType = ColorTypeNoPicker;
/** WaveColorTypeRainbow. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const WaveColorTypeRainbow = types.compose(
  types.model({
    kind: types.literal('Rainbow'),
  }),
  Value,
);
/** WaveColorTypeColor. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const WaveColorTypeColor = types.compose(
  types.model({
    kind: types.literal('Color'),
  }),
  Color,
  Size,
);
/** WaveColorTypeGradient. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const WaveColorTypeGradient = types.compose(
  types.model({
    kind: types.literal('Gradient'),
  }),
  Gradient,
);
/** WaveColorType. Recovered from src/renderer/keyboard/v2/models/effects/KeyEffectColors.ts. */
const WaveColorType = types.union(WaveColorTypeRainbow, WaveColorTypeColor, WaveColorTypeGradient);
export {
  PulseColorTypeRandom,
  PulseColorTypeColors,
  PulseColorType,
  FadeColorTypeRainbow,
  FadeColorTypeRandom,
  FadeColorTypeColor,
  FadeColorType,
  ColorTypeNoPickerRainbow,
  ColorTypeNoPickerRandom,
  ColorTypeNoPickerGradient,
  ColorTypeNoPicker,
  ReactiveEffectColorTypeWithSizeRainbow,
  ReactiveEffectColorTypeWithSizeRandom,
  ReactiveEffectColorTypeWithSizeColor,
  ReactiveEffectColorTypeWithSizeGradient,
  ReactiveEffectColorTypeWithSize,
  ReactiveEffectColorTypeNoSizeRainbow,
  ReactiveEffectColorTypeNoSizeRandom,
  ReactiveEffectColorTypeNoSizeColor,
  ReactiveEffectColorTypeNoSizeGradient,
  ReactiveEffectColorTypeNoSize,
  ShiftColorType,
  WaveColorTypeRainbow,
  WaveColorTypeColor,
  WaveColorTypeGradient,
  WaveColorType,
};

export type PulseColorTypeRandomInstance = Instance<typeof PulseColorTypeRandom>;
export type PulseColorTypeRandomSnapshot = SnapshotIn<typeof PulseColorTypeRandom>;
export type PulseColorTypeColorsInstance = Instance<typeof PulseColorTypeColors>;
export type PulseColorTypeColorsSnapshot = SnapshotIn<typeof PulseColorTypeColors>;
export type PulseColorTypeInstance = Instance<typeof PulseColorType>;
export type PulseColorTypeSnapshot = SnapshotIn<typeof PulseColorType>;
export type FadeColorTypeRainbowInstance = Instance<typeof FadeColorTypeRainbow>;
export type FadeColorTypeRainbowSnapshot = SnapshotIn<typeof FadeColorTypeRainbow>;
export type FadeColorTypeRandomInstance = Instance<typeof FadeColorTypeRandom>;
export type FadeColorTypeRandomSnapshot = SnapshotIn<typeof FadeColorTypeRandom>;
export type FadeColorTypeColorInstance = Instance<typeof FadeColorTypeColor>;
export type FadeColorTypeColorSnapshot = SnapshotIn<typeof FadeColorTypeColor>;
export type FadeColorTypeInstance = Instance<typeof FadeColorType>;
export type FadeColorTypeSnapshot = SnapshotIn<typeof FadeColorType>;
export type ColorTypeNoPickerRainbowInstance = Instance<typeof ColorTypeNoPickerRainbow>;
export type ColorTypeNoPickerRainbowSnapshot = SnapshotIn<typeof ColorTypeNoPickerRainbow>;
export type ColorTypeNoPickerRandomInstance = Instance<typeof ColorTypeNoPickerRandom>;
export type ColorTypeNoPickerRandomSnapshot = SnapshotIn<typeof ColorTypeNoPickerRandom>;
export type ColorTypeNoPickerGradientInstance = Instance<typeof ColorTypeNoPickerGradient>;
export type ColorTypeNoPickerGradientSnapshot = SnapshotIn<typeof ColorTypeNoPickerGradient>;
export type ColorTypeNoPickerInstance = Instance<typeof ColorTypeNoPicker>;
export type ColorTypeNoPickerSnapshot = SnapshotIn<typeof ColorTypeNoPicker>;
export type ReactiveEffectColorTypeWithSizeRainbowInstance = Instance<
  typeof ReactiveEffectColorTypeWithSizeRainbow
>;
export type ReactiveEffectColorTypeWithSizeRainbowSnapshot = SnapshotIn<
  typeof ReactiveEffectColorTypeWithSizeRainbow
>;
export type ReactiveEffectColorTypeWithSizeRandomInstance = Instance<
  typeof ReactiveEffectColorTypeWithSizeRandom
>;
export type ReactiveEffectColorTypeWithSizeRandomSnapshot = SnapshotIn<
  typeof ReactiveEffectColorTypeWithSizeRandom
>;
export type ReactiveEffectColorTypeWithSizeColorInstance = Instance<
  typeof ReactiveEffectColorTypeWithSizeColor
>;
export type ReactiveEffectColorTypeWithSizeColorSnapshot = SnapshotIn<
  typeof ReactiveEffectColorTypeWithSizeColor
>;
export type ReactiveEffectColorTypeWithSizeGradientInstance = Instance<
  typeof ReactiveEffectColorTypeWithSizeGradient
>;
export type ReactiveEffectColorTypeWithSizeGradientSnapshot = SnapshotIn<
  typeof ReactiveEffectColorTypeWithSizeGradient
>;
export type ReactiveEffectColorTypeWithSizeInstance = Instance<
  typeof ReactiveEffectColorTypeWithSize
>;
export type ReactiveEffectColorTypeWithSizeSnapshot = SnapshotIn<
  typeof ReactiveEffectColorTypeWithSize
>;
export type ReactiveEffectColorTypeNoSizeRainbowInstance = Instance<
  typeof ReactiveEffectColorTypeNoSizeRainbow
>;
export type ReactiveEffectColorTypeNoSizeRainbowSnapshot = SnapshotIn<
  typeof ReactiveEffectColorTypeNoSizeRainbow
>;
export type ReactiveEffectColorTypeNoSizeRandomInstance = Instance<
  typeof ReactiveEffectColorTypeNoSizeRandom
>;
export type ReactiveEffectColorTypeNoSizeRandomSnapshot = SnapshotIn<
  typeof ReactiveEffectColorTypeNoSizeRandom
>;
export type ReactiveEffectColorTypeNoSizeColorInstance = Instance<
  typeof ReactiveEffectColorTypeNoSizeColor
>;
export type ReactiveEffectColorTypeNoSizeColorSnapshot = SnapshotIn<
  typeof ReactiveEffectColorTypeNoSizeColor
>;
export type ReactiveEffectColorTypeNoSizeGradientInstance = Instance<
  typeof ReactiveEffectColorTypeNoSizeGradient
>;
export type ReactiveEffectColorTypeNoSizeGradientSnapshot = SnapshotIn<
  typeof ReactiveEffectColorTypeNoSizeGradient
>;
export type ReactiveEffectColorTypeNoSizeInstance = Instance<typeof ReactiveEffectColorTypeNoSize>;
export type ReactiveEffectColorTypeNoSizeSnapshot = SnapshotIn<
  typeof ReactiveEffectColorTypeNoSize
>;
export type ShiftColorTypeInstance = Instance<typeof ShiftColorType>;
export type ShiftColorTypeSnapshot = SnapshotIn<typeof ShiftColorType>;
export type WaveColorTypeRainbowInstance = Instance<typeof WaveColorTypeRainbow>;
export type WaveColorTypeRainbowSnapshot = SnapshotIn<typeof WaveColorTypeRainbow>;
export type WaveColorTypeColorInstance = Instance<typeof WaveColorTypeColor>;
export type WaveColorTypeColorSnapshot = SnapshotIn<typeof WaveColorTypeColor>;
export type WaveColorTypeGradientInstance = Instance<typeof WaveColorTypeGradient>;
export type WaveColorTypeGradientSnapshot = SnapshotIn<typeof WaveColorTypeGradient>;
export type WaveColorTypeInstance = Instance<typeof WaveColorType>;
export type WaveColorTypeSnapshot = SnapshotIn<typeof WaveColorType>;
