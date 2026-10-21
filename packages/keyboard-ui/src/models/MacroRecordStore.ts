import { action, makeObservable, observable } from 'mobx';
import logger from '../../../ui-platform/src/logger.cjs';
import {
  MacroKeyEvent, MACRO_DELAY_MINIMUM, MACRO_DELAY_MAXIMUM, MAX_MACRO_ACTIONS,
  type RecordedMacroAction,
} from './macroConstants.js';

export interface MacroRecordEvent {
  hidKey: number;
  state: 'Pressed' | 'Released';
  timestamp: number;
  key: string | number;
}

/** Stream adapter owned by the renderer; ending a subscription releases its host listener. */
export interface MacroRecordingClient {
  startMacroRecording(
    callback: (event: MacroRecordEvent | null, error?: unknown) => void,
    onEnd?: () => void,
  ): { end(): void };
}

export interface MacroRecordingOptions {
  ignoreMouseEvents?: boolean;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  validTimeoutRange?: { minSeconds: number; maxSeconds: number; stepSeconds: number };
}

/** Converts the host event stream into editor actions and updates the preceding delay.
 * Host timestamps and configured ranges use seconds; editor callbacks use milliseconds.
 * Call beforeDestroy when disposing the store to stop recording and remove listeners.
 */
export class MacroRecordStore {
  isNewMacro = false;
  isRecording = false;
  lastAction: MacroRecordEvent | null = null;
  lastActionIndex = 0;
  ignoreMouseEvents = false;
  macroRecordCall: { end(): void } | undefined;

  constructor(
    private readonly client: MacroRecordingClient,
    private readonly keyboardKeys: ReadonlySet<string | number>,
  ) {
    makeObservable(this, { isNewMacro: observable, isRecording: observable });
  }

  setIsNewMacro = action((isNewMacro: boolean) => { this.isNewMacro = isNewMacro; });
  setIsRecording = action((value: boolean) => {
    this.isRecording = value;
    if (!value) {
      this.lastAction = null;
      this.lastActionIndex = 0;
      this.ignoreMouseEvents = false;
    }
  });
  setIgnoreMouseEvents = action((ignoreMouseEvents: boolean) => {
    this.ignoreMouseEvents = ignoreMouseEvents;
  });

  handleError(error: Error) {
    const translationId = error.message.split(':')[0];
    logger.error('Error occurred while Macro recording: ', error.message);
    return translationId === 'failed to receive key from macro recording';
  }

  startMacroRecording(
    onUpdate: (actions: RecordedMacroAction[]) => void,
    updateDelay: (index: number, delayMs: number) => void,
    lastActionIndex: number,
    options: MacroRecordingOptions = {},
  ) {
    const { ignoreMouseEvents, onEnd, validTimeoutRange, onError } = options;
    try {
      if (this.isRecording) return;
      this.setIsRecording(true);
      this.lastActionIndex = lastActionIndex;
      this.setIgnoreMouseEvents(!!ignoreMouseEvents);
      this.macroRecordCall = this.client.startMacroRecording((data, error) => {
        try {
          if (error) {
            const recordingError = error instanceof Error ? error : new Error(String(error));
            onError?.(recordingError);
            if (this.handleError(recordingError)) this.endMacroRecording();
            return;
          }
          if (!data) { this.endMacroRecording(); return; }
          // The standalone platform's cannotUseInMacros list is empty; preserve all key outputs.
          if (!this.keyboardKeys.has(data.key) && this.ignoreMouseEvents) return;
          if (this.lastActionIndex + 1 < MAX_MACRO_ACTIONS) {
            onUpdate([{
              hidKey: data.hidKey,
              macroKey: data.key,
              state: data.state === 'Pressed' ? MacroKeyEvent.DOWN : MacroKeyEvent.UP,
              delayMs: 1000 * (validTimeoutRange?.minSeconds ?? 0.02),
            }]);
          } else {
            this.endMacroRecording();
            return;
          }
          if (!this.isRecording) return;
          if (!this.lastAction) {
            this.lastAction = data;
            this.lastActionIndex += 1;
            return;
          }
          let delayMs = Math.round(1000 * (data.timestamp - this.lastAction.timestamp));
          if (validTimeoutRange) {
            const { minSeconds, maxSeconds, stepSeconds } = validTimeoutRange;
            delayMs = Math.max(1000 * minSeconds, Math.min(1000 * maxSeconds, delayMs));
            delayMs = Math.round(delayMs / (1000 * stepSeconds)) * (1000 * stepSeconds);
          } else delayMs = Math.min(MACRO_DELAY_MAXIMUM, Math.max(MACRO_DELAY_MINIMUM, delayMs));
          updateDelay(this.lastActionIndex, delayMs);
          this.lastAction = data;
          this.lastActionIndex += 1;
        } catch (error) { logger.error(error); }
      }, () => {
        this.macroRecordCall = undefined;
        this.setIsRecording(false);
        onEnd?.();
      });
    } catch (error) {
      const recordingError = error instanceof Error ? error : new Error(`unknown error ${String(error)}`);
      this.setIsRecording(false);
      this.macroRecordCall = undefined;
      this.handleError(recordingError);
      onError?.(recordingError);
    }
  }

  endMacroRecording() {
    try {
      if (this.macroRecordCall) {
        this.macroRecordCall.end();
        this.macroRecordCall = undefined;
      }
      if (this.isRecording) this.setIsRecording(false);
    } catch (error) { logger.error(error); }
  }

  beforeDestroy() { this.endMacroRecording(); }
}
