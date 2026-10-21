/** Keyboard protocol values recovered from CAM core.cjs; no device I/O. */
export const KeyboardPhysicalLayout = { ANSI: 'ANSI', ISO: 'ISO' } as const;
export const KeyboardFormFactor = { Fullsize: 'Fullsize', MiniTkl: 'MiniTkl', Tenkeyless: 'Tenkeyless' } as const;
export const PollingRate = {
  Hz1000: 'Hz1000',
  Hz125: 'Hz125',
  Hz2000: 'Hz2000',
  Hz250: 'Hz250',
  Hz4000: 'Hz4000',
  Hz500: 'Hz500',
  Hz8000: 'Hz8000',
} as const;
export const ResolutionMethod = { LastPressed: 'LastPressed' } as const;
export const BottomMode = { EitherOne: 'EitherOne' } as const;
export const KeyModifier = {
  Alt: 'Alt',
  Control: 'Control',
  Shift: 'Shift',
} as const;
export const TargetKeyState = { Pressed: 'Pressed', Released: 'Released' } as const;
export const KeyboardMouseLightingKeyTrigger = {
  Hold: 'Hold',
  HoldReleased: 'HoldReleased',
  LongHold: 'LongHold',
  LongHoldReleased: 'LongHoldReleased',
  Pressed: 'Pressed',
  Released: 'Released',
} as const;
export const KeyboardMouseLightingDirection = {
  Down: 'Down',
  Left: 'Left',
  Radial: 'Radial',
  RadialReverse: 'RadialReverse',
  Right: 'Right',
  Up: 'Up',
} as const;
export const KeyboardMouseGradientType = {
  Horizontal: 'Horizontal',
  Radial: 'Radial',
  Vertical: 'Vertical',
} as const;
