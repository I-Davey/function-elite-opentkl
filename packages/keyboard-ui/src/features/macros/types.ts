/** Physical legends used by activation inputs and the keyboard macro editor. */
export interface MacroKeyboardInfo {
  layout: string;
  region: string;
}

export interface MacroActivationProps {
  keyboardInfo: MacroKeyboardInfo;
  isFnLayer: boolean;
  triggerKey?: number;
  setTriggerKey: (key: number | undefined) => void;
  isNoAction: boolean;
  isRecordingMacro?: boolean;
  innerLabel?: string;
  validPhysicalKeys: readonly number[];
  unavailablePhysicalKeys: readonly number[];
}
