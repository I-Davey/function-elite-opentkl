import { HidKeyCode } from '../layouts/hidKeys.js';
/** Existing preset indices refer to firmware-supported level/sensitivity tables. */
export interface ActuationPreset {
  id: string;
  rapidSensitivity: number;
  baseLevel: number;
  displayed: { wasdLevel: number; spaceLevel: number; rapidSensitivity: number };
  custom: { code: number; rapidSensitivity: number; level: number }[];
}
export const WASD_KEYS = [HidKeyCode.W, HidKeyCode.A, HidKeyCode.S, HidKeyCode.D];
export const ACTUATION_PRESETS: ActuationPreset[] = [
  {
    id: 'FPS',
    rapidSensitivity: -1,
    baseLevel: 16,
    displayed: {
      wasdLevel: 4,
      spaceLevel: 4,
      rapidSensitivity: 11,
    },
    custom: [
      {
        code: HidKeyCode.Spacebar,
        rapidSensitivity: 11,
        level: 4,
      },
      {
        code: HidKeyCode.W,
        rapidSensitivity: 11,
        level: 4,
      },
      {
        code: HidKeyCode.A,
        rapidSensitivity: 11,
        level: 4,
      },
      {
        code: HidKeyCode.S,
        rapidSensitivity: 11,
        level: 4,
      },
      {
        code: HidKeyCode.D,
        rapidSensitivity: 11,
        level: 4,
      },
      {
        code: HidKeyCode.LeftGui,
        rapidSensitivity: -1,
        level: 39,
      },
      {
        code: HidKeyCode.Q,
        rapidSensitivity: -1,
        level: 4,
      },
      {
        code: HidKeyCode.E,
        rapidSensitivity: -1,
        level: 4,
      },
      {
        code: HidKeyCode.R,
        rapidSensitivity: -1,
        level: 4,
      },
      {
        code: HidKeyCode.F,
        rapidSensitivity: -1,
        level: 4,
      },
      {
        code: HidKeyCode.LeftShift,
        rapidSensitivity: 11,
        level: 4,
      },
      {
        code: HidKeyCode.G,
        rapidSensitivity: -1,
        level: 4,
      },
      {
        code: HidKeyCode.C,
        rapidSensitivity: 11,
        level: 4,
      },
      {
        code: HidKeyCode.LeftControl,
        rapidSensitivity: -1,
        level: 4,
      },
    ],
  },
  {
    id: 'MOBA',
    displayed: {
      wasdLevel: 16,
      spaceLevel: 16,
      rapidSensitivity: -1,
    },
    rapidSensitivity: -1,
    baseLevel: 16,
    custom: [
      {
        code: HidKeyCode.Q,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.W,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.E,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.D,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.F,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.G,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.V,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.B,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.R,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.T,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.N1OrExclamation,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.N2OrAt,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.N3OrPound,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.N4OrDollar,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.N5OrPercent,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.N6OrCaret,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.N7OrAnd,
        rapidSensitivity: -1,
        level: 5,
      },
    ],
  },
  {
    id: 'RPG',
    displayed: {
      wasdLevel: 5,
      spaceLevel: 5,
      rapidSensitivity: 11,
    },
    rapidSensitivity: -1,
    baseLevel: 16,
    custom: [
      {
        code: HidKeyCode.Spacebar,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.W,
        rapidSensitivity: 11,
        level: 5,
      },
      {
        code: HidKeyCode.A,
        rapidSensitivity: 11,
        level: 5,
      },
      {
        code: HidKeyCode.S,
        rapidSensitivity: 11,
        level: 5,
      },
      {
        code: HidKeyCode.D,
        rapidSensitivity: 11,
        level: 5,
      },
      {
        code: HidKeyCode.Q,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.E,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.R,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.T,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.F,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.Z,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.X,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.C,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.N1OrExclamation,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.N2OrAt,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.N3OrPound,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.N4OrDollar,
        rapidSensitivity: -1,
        level: 10,
      },
      {
        code: HidKeyCode.LeftShift,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.LeftControl,
        rapidSensitivity: -1,
        level: 5,
      },
      {
        code: HidKeyCode.LeftAlt,
        rapidSensitivity: -1,
        level: 5,
      },
    ],
  },
  {
    id: 'Typing',
    displayed: {
      wasdLevel: 21,
      spaceLevel: 21,
      rapidSensitivity: -1,
    },
    rapidSensitivity: -1,
    baseLevel: 21,
    custom: [],
  },
];
