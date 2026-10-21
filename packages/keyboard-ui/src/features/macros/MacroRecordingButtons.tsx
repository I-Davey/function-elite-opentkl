/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { useEffect } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { SecondaryButton } from '../../components/Button.js';
import type { MacroRecordStore } from '../../models/MacroRecordStore.js';
import { macroEditorStyles } from './macroEditorStyles.js';

export interface MacroRecordingButtonsProps {
  recorder: MacroRecordStore;
  isRecordingMacro: boolean;
  isMaxActions: boolean;
  ignoreMouseEvents?: boolean;
  onClickAddFunction: () => void;
  onClickRecordFunctions: () => void;
  onCleanMacroFunctions?: () => void;
}

/** Hovering record/stop excludes its mouse event from recording; keyboard recording keeps that policy on. */
export const MacroRecordingButtons = observer(function MacroRecordingButtons({
  recorder,
  isRecordingMacro: recording,
  isMaxActions,
  ignoreMouseEvents,
  onClickAddFunction,
  onClickRecordFunctions,
  onCleanMacroFunctions,
}: MacroRecordingButtonsProps) {
  const styles = macroEditorStyles(useTheme()),
    { t } = useTranslation(['macro']);
  const leave = () => {
    if (!ignoreMouseEvents) recorder.setIgnoreMouseEvents(false);
  };
  useEffect(() => leave, [recorder, ignoreMouseEvents]);
  return (
    <>
      <SecondaryButton
        css={styles.addFunctionButton}
        disabled={recording || isMaxActions}
        onClick={onClickAddFunction}
      >
        {t('addFunction')}
      </SecondaryButton>
      <SecondaryButton
        css={styles.recordFunctionsButton}
        onMouseOver={() => recorder.setIgnoreMouseEvents(true)}
        onMouseOut={leave}
        onClick={onClickRecordFunctions}
        disabled={!recording && isMaxActions}
      >
        <div css={styles.iconTitleContainer}>
          <div css={recording ? styles.stopIcon : styles.circleDot} />
          {t(recording ? 'stopRecording' : 'startNewRecording')}
        </div>
      </SecondaryButton>
      {onCleanMacroFunctions && !recording && (
        <SecondaryButton
          css={styles.deleteMacrosButton}
          className="on-bottom"
          onClick={onCleanMacroFunctions}
        >
          {t('clearAllMacroActions')}
        </SecondaryButton>
      )}
    </>
  );
});
