/** Recording events and limits shared by the recorder and stored remap models. */
export const MacroKeyEvent = { PRESS: 'KeyPress', DOWN: 'KeyDown', UP: 'KeyUp' } as const;
export const MACRO_DELAY_MINIMUM = 20;
export const MACRO_DELAY_MAXIMUM = 1000;
export const MAX_MACRO_ACTIONS = 256;

/** Recorder delays are milliseconds; stored macro delays are seconds. */
export interface RecordedMacroAction {
  hidKey?: number;
  macroKey?: string | number;
  state: (typeof MacroKeyEvent)[keyof typeof MacroKeyEvent];
  delayMs: number;
}
