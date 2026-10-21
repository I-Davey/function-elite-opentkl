import type { KeyboardHost } from '../../contracts/desktop-host.cjs';
import type { MacroRecordingClient } from '../../keyboard-ui/src/models/MacroRecordStore.js';

export function createMacroRecorderAdapter(
  host: KeyboardHost,
  physicalNames: ReadonlyMap<number, string>,
  keyEnums: Readonly<Record<string, string>>,
): MacroRecordingClient {
  return {
    startMacroRecording(callback, onEnd) {
      const aliases: Record<string, string> = {
        ReturnOrEnter: 'Enter',
        BackspaceOrDelete: 'Backspace',
        Spacebar: 'Space',
        LeftGui: 'LeftWindows',
        RightGui: 'RightWindows',
        LeftSquareOrCurly: 'LeftBracket',
        RightSquareOrCurly: 'RightBracket',
        LeftArrow: 'Left',
        RightArrow: 'Right',
        UpArrow: 'Up',
        DownArrow: 'Down',
        SingleOrDoubleQuote: 'Apostrophe',
        BackslashOrPipe: 'Backslash',
        CommaOrLessThan: 'Comma',
        DeleteForward: 'Delete',
        EqualsOrPlus: 'Equals',
        MinusOrUnderscore: 'Minus',
        PeriodOrGreaterThan: 'Period',
        SemiColonOrColon: 'Semicolon',
        ForwardSlashOrQuestionMark: 'Slash',
        GraveAccentOrTilde: 'Tilde',
      };
      let stopped = false;
      const remove = host.onMacroEvent((value) => {
        if (stopped) return;
        if (value === null) {
          end();
          return;
        }
        const name = physicalNames.get(value.hidKey) ?? String(value.hidKey);
        const key =
          keyEnums[aliases[name] ?? (/^N[0-9]Or/.test(name) ? name.slice(0, 2) : name)] ?? name;
        callback({ ...value, key });
      });
      const end = () => {
        if (stopped) return;
        stopped = true;
        remove();
        void host.stopMacroRecording().catch(() => {});
        onEnd?.();
      };
      void host.startMacroRecording().catch((error) => {
        callback(null, error);
        end();
      });
      return { end };
    },
  };
}
