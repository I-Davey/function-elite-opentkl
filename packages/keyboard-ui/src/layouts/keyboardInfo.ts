import { ANSI_CMPT_HID, ANSI_CMPT_HID_CODES, ANSI_CMPT_HID_COORDINATES } from './ANSI_CMPT_HID.js';
import { ANSI_FULL_COORDINATES, ANSI_FULL_HID, ANSI_FULL_HID_CODES } from './ANSI_FULL_HID.js';
import { ANSI_TKL_HID, ANSI_TKL_HID_CODES } from './ANSI_TKL_HID.js';
import { ISO_CMPT_HID, ISO_CMPT_HID_CODES, ISO_CMPT_HID_COORDINATES } from './ISO_CMPT_HID.js';
import { ISO_FULL_HID, ISO_FULL_HID_CODES, ISO_FULL_HID_COORDINATES } from './ISO_FULL_HID.js';
import { ISO_TKL_HID, ISO_TKL_HID_CODES, ISO_TKL_HID_COORDINATES } from './ISO_TKL_HID.js';
import { HidKeyCode } from './hidKeys.js';
import type { KeyboardLayoutInfo, KeyboardLayoutDevice } from './types.js';
export const FALLBACK_KEYBOARD_INFO: KeyboardLayoutInfo = {
  physicalLayout: 'ANSI',
  formFactor: 'Fullsize',
  keys: ANSI_FULL_HID_CODES,
  coordinates: ANSI_FULL_COORDINATES,
  layout: ANSI_FULL_HID,
  width: 22,
};
export const KEYBOARD_INFO_ISO: Record<string, KeyboardLayoutInfo | undefined> = {
  Fullsize: {
    physicalLayout: 'ISO',
    formFactor: 'Fullsize',
    keys: ISO_FULL_HID_CODES,
    coordinates: ISO_FULL_HID_COORDINATES,
    layout: ISO_FULL_HID,
    width: 22,
  },
  Tenkeyless: {
    physicalLayout: 'ISO',
    formFactor: 'Tenkeyless',
    keys: ISO_TKL_HID_CODES,
    coordinates: ISO_TKL_HID_COORDINATES,
    layout: ISO_TKL_HID,
    width: 18,
  },
  MiniTkl: {
    physicalLayout: 'ISO',
    formFactor: 'MiniTkl',
    keys: ISO_CMPT_HID_CODES,
    coordinates: ISO_CMPT_HID_COORDINATES,
    layout: ISO_CMPT_HID,
    width: 16,
  },
};
export const KEYBOARD_INFO_ANSI: Record<string, KeyboardLayoutInfo | undefined> = {
  Fullsize: { ...FALLBACK_KEYBOARD_INFO },
  Tenkeyless: {
    physicalLayout: 'ANSI',
    formFactor: 'Tenkeyless',
    keys: ANSI_TKL_HID_CODES,
    coordinates: ANSI_FULL_COORDINATES,
    layout: ANSI_TKL_HID,
    width: 18,
  },
  MiniTkl: {
    physicalLayout: 'ANSI',
    formFactor: 'MiniTkl',
    keys: ANSI_CMPT_HID_CODES,
    coordinates: ANSI_CMPT_HID_COORDINATES,
    layout: ANSI_CMPT_HID,
    width: 16,
  },
};
/** Keep unsupported form-factor results and fallback selection identical to CAM. */
export function getKeyboardInfo(device: KeyboardLayoutDevice): KeyboardLayoutInfo | undefined {
  const layoutInfo = device.capabilityData.physicalKeys?.physicalKeysLayout;
  if (!layoutInfo?.formFactor || !layoutInfo.layout) return FALLBACK_KEYBOARD_INFO;
  switch (layoutInfo.layout) {
    case 'ISO':
      return KEYBOARD_INFO_ISO[layoutInfo.formFactor];
    case 'ANSI':
      return KEYBOARD_INFO_ANSI[layoutInfo.formFactor];
    default:
      return FALLBACK_KEYBOARD_INFO;
  }
}
export function getKeyCoordinate(key: number, device: KeyboardLayoutDevice) {
  const { coordinates } = getKeyboardInfo(device)!;
  return coordinates[key];
}
export const jsKeyToKeyMap: Record<string, number> = {
  F1: HidKeyCode.F1,
  F2: HidKeyCode.F2,
  F3: HidKeyCode.F3,
  F4: HidKeyCode.F4,
  F5: HidKeyCode.F5,
  F6: HidKeyCode.F6,
  F7: HidKeyCode.F7,
  F8: HidKeyCode.F8,
  F9: HidKeyCode.F9,
  F10: HidKeyCode.F10,
  F11: HidKeyCode.F11,
  F12: HidKeyCode.F12,
  F13: HidKeyCode.F13,
  F14: HidKeyCode.F14,
  Digit1: HidKeyCode.N1OrExclamation,
  Digit2: HidKeyCode.N2OrAt,
  Digit3: HidKeyCode.N3OrPound,
  Digit4: HidKeyCode.N4OrDollar,
  Digit5: HidKeyCode.N5OrPercent,
  Digit6: HidKeyCode.N6OrCaret,
  Digit7: HidKeyCode.N7OrAnd,
  Digit8: HidKeyCode.N8OrStar,
  Digit9: HidKeyCode.N9OrLeftParen,
  Digit0: HidKeyCode.N0OrRightParen,
  KeyA: HidKeyCode.A,
  KeyB: HidKeyCode.B,
  KeyC: HidKeyCode.C,
  KeyD: HidKeyCode.D,
  KeyE: HidKeyCode.E,
  KeyF: HidKeyCode.F,
  KeyG: HidKeyCode.G,
  KeyH: HidKeyCode.H,
  KeyI: HidKeyCode.I,
  KeyJ: HidKeyCode.J,
  KeyK: HidKeyCode.K,
  KeyL: HidKeyCode.L,
  KeyM: HidKeyCode.M,
  KeyN: HidKeyCode.N,
  KeyO: HidKeyCode.O,
  KeyP: HidKeyCode.P,
  KeyQ: HidKeyCode.Q,
  KeyR: HidKeyCode.R,
  KeyS: HidKeyCode.S,
  KeyT: HidKeyCode.T,
  KeyU: HidKeyCode.U,
  KeyV: HidKeyCode.V,
  KeyW: HidKeyCode.W,
  KeyX: HidKeyCode.X,
  KeyY: HidKeyCode.Y,
  KeyZ: HidKeyCode.Z,
  BracketLeft: HidKeyCode.LeftSquareOrCurly,
  BracketRight: HidKeyCode.RightSquareOrCurly,
  AltLeft: HidKeyCode.LeftAlt,
  AltRight: HidKeyCode.RightAlt,
  ControlLeft: HidKeyCode.LeftControl,
  ControlRight: HidKeyCode.RightControl,
  ShiftLeft: HidKeyCode.LeftShift,
  ShiftRight: HidKeyCode.RightShift,
  ArrowLeft: HidKeyCode.LeftArrow,
  ArrowRight: HidKeyCode.RightArrow,
  ArrowUp: HidKeyCode.UpArrow,
  ArrowDown: HidKeyCode.DownArrow,
  Quote: HidKeyCode.SingleOrDoubleQuote,
  Backslash: HidKeyCode.BackslashOrPipe,
  BackslashNonUs: HidKeyCode.PounOrTildeNonUs,
  Backspace: HidKeyCode.BackspaceOrDelete,
  CapsLock: HidKeyCode.CapsLock,
  Comma: HidKeyCode.CommaOrLessThan,
  Delete: HidKeyCode.DeleteForward,
  MetaLeft: HidKeyCode.LeftGui,
  MetaRight: HidKeyCode.RightGui,
  End: HidKeyCode.End,
  Enter: HidKeyCode.ReturnOrEnter,
  Equal: HidKeyCode.EqualsOrPlus,
  Escape: HidKeyCode.Escape,
  Home: HidKeyCode.Home,
  Insert: HidKeyCode.Insert,
  IntlBackslash: HidKeyCode.BackslashOrPipeNonUs,
  Minus: HidKeyCode.MinusOrUnderscore,
  Numpad0: HidKeyCode.K0OrInsert,
  Numpad1: HidKeyCode.K1OrEnd,
  Numpad2: HidKeyCode.K2OrDownArrow,
  Numpad3: HidKeyCode.K3OrPageDn,
  Numpad4: HidKeyCode.K4OrLeftArrow,
  Numpad5: HidKeyCode.K5,
  Numpad6: HidKeyCode.K6OrRightArrow,
  Numpad7: HidKeyCode.K7OrHome,
  Numpad8: HidKeyCode.K8OrUpArrow,
  Numpad9: HidKeyCode.K9OrPageUp,
  NumpadAdd: HidKeyCode.KeypadAndAnd,
  NumpadDivide: HidKeyCode.KeypadDivide,
  NumpadDecimal: HidKeyCode.KeypadDecimal,
  NumpadEnter: HidKeyCode.KeypadEnter,
  NumLock: HidKeyCode.NumLockOrClear,
  NumpadMultiply: HidKeyCode.KeypadMultiply,
  NumpadSubtract: HidKeyCode.KeypadSub,
  PageDown: HidKeyCode.PageDown,
  PageUp: HidKeyCode.PageUp,
  Pause: HidKeyCode.Pause,
  Period: HidKeyCode.PeriodOrGreaterThan,
  PrintScreen: HidKeyCode.PrintScreen,
  ScrollLock: HidKeyCode.ScrollLock,
  Semicolon: HidKeyCode.SemiColonOrColon,
  Slash: HidKeyCode.ForwardSlashOrQuestionMark,
  Space: HidKeyCode.Spacebar,
  Tab: HidKeyCode.Tab,
  Backquote: HidKeyCode.GraveAccentOrTilde,
};
