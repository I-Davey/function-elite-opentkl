/** Retained lighting defaults and effect metadata. */
const KeyboardEffectLayer = { Base: 'Base', Reactive: 'Reactive' } as const;
const MAX_RIPPLE_SIZE = 10;
const DEFAULT_COLOR = '#510079';
const DEFAULT_PULSE_COLORS = [
  '#FF0000',
  '#FF7F00',
  '#FFFF00',
  '#7FFF00',
  '#00FF00',
  '#00FF7F',
  '#00FFFF',
  '#007FFF',
  '#0000FF',
  '#8B00FF',
];
export { KeyboardEffectLayer, MAX_RIPPLE_SIZE, DEFAULT_COLOR, DEFAULT_PULSE_COLORS };

const OFF_BASE_EFFECT_INFO = {
  effectLayer: KeyboardEffectLayer.Base,
  effectName: 'Off',
  isDrivenBySoftware: false,
} as const;
const MIXED_BASE_EFFECT_INFO = {
  effectLayer: KeyboardEffectLayer.Base,
  effectName: 'Mixed',
  isDrivenBySoftware: false,
} as const;
const KEYBOARD_BASE_EFFECT_INFO_MAP = {
  Color: {
    effectLayer: KeyboardEffectLayer.Base,
    effectName: 'Color',
    isDrivenBySoftware: false,
  },
  SolidGradient: {
    effectLayer: KeyboardEffectLayer.Base,
    effectName: 'SolidGradient',
    isDrivenBySoftware: false,
  },
  SolidGradient2: {
    effectLayer: KeyboardEffectLayer.Base,
    effectName: 'SolidGradient2',
    isDrivenBySoftware: false,
  },
  ShiftColor: {
    effectLayer: KeyboardEffectLayer.Base,
    effectName: 'ShiftColor',
    isDrivenBySoftware: false,
  },
  PulseColor: {
    effectLayer: KeyboardEffectLayer.Base,
    effectName: 'PulseColor',
    isDrivenBySoftware: false,
  },
  CoveringMarquee: {
    effectLayer: KeyboardEffectLayer.Base,
    effectName: 'CoveringMarquee',
    isDrivenBySoftware: false,
  },
  Wave: {
    effectLayer: KeyboardEffectLayer.Base,
    effectName: 'Wave',
    isDrivenBySoftware: false,
  },
  Mixed: MIXED_BASE_EFFECT_INFO,
  Off: OFF_BASE_EFFECT_INFO,
} as const;
const OFF_REACTIVE_EFFECT_INFO = {
  effectLayer: KeyboardEffectLayer.Reactive,
  effectName: 'Off',
  isDrivenBySoftware: false,
} as const;
const MIXED_REACTIVE_EFFECT_INFO = {
  effectLayer: KeyboardEffectLayer.Reactive,
  effectName: 'Mixed',
  isDrivenBySoftware: false,
} as const;
const KEYBOARD_REACTIVE_EFFECT_INFO_MAP = {
  Fade: {
    effectLayer: KeyboardEffectLayer.Reactive,
    effectName: 'Fade',
    isDrivenBySoftware: false,
  },
  Line: {
    effectLayer: KeyboardEffectLayer.Reactive,
    effectName: 'Line',
    isDrivenBySoftware: false,
  },
  Ripple: {
    effectLayer: KeyboardEffectLayer.Reactive,
    effectName: 'Ripple',
    isDrivenBySoftware: false,
  },
  Mixed: MIXED_REACTIVE_EFFECT_INFO,
  Off: OFF_REACTIVE_EFFECT_INFO,
} as const;
const FALLBACK_BASE_KEYBOARD_EFFECT_INFO = KEYBOARD_BASE_EFFECT_INFO_MAP.Color;
const FALLBACK_REACTIVE_KEYBOARD_EFFECT_INFO = KEYBOARD_REACTIVE_EFFECT_INFO_MAP.Fade;
export {
  OFF_BASE_EFFECT_INFO,
  MIXED_BASE_EFFECT_INFO,
  KEYBOARD_BASE_EFFECT_INFO_MAP,
  OFF_REACTIVE_EFFECT_INFO,
  MIXED_REACTIVE_EFFECT_INFO,
  KEYBOARD_REACTIVE_EFFECT_INFO_MAP,
  FALLBACK_BASE_KEYBOARD_EFFECT_INFO,
  FALLBACK_REACTIVE_KEYBOARD_EFFECT_INFO,
};
