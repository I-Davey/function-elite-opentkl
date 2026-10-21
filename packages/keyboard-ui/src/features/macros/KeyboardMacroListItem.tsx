/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { TextField } from '../../components/TextField.js';
import { SecondaryShimlessButton } from '../../components/Button.js';
import { SettingsIcon } from '../../components/icons/SettingsIcon.js';
import { CloseXIcon } from '../../components/icons/CloseXIcon.js';
import type { RemapMacroInstance } from '../../models/RemapMacro.js';
import { ActivationKeyInput } from './ActivationKeyInput.js';
import { macroListItemStyles } from './macroControlStyles.js';
import type { MacroActivationProps } from './types.js';

export interface KeyboardMacroListItemProps extends Omit<
  MacroActivationProps,
  'isNoAction' | 'isRecordingMacro' | 'innerLabel'
> {
  macro: RemapMacroInstance;
  numMacros: number;
  setMacroName: (id: string, name: string) => void;
  onDeleteMacro: (id: string) => void;
  onEditMacro: (id: string) => void;
}

/** Blank names revert on blur; assignment remains disabled until the macro has an action. */
export const KeyboardMacroListItem = observer(function KeyboardMacroListItem({
  macro,
  numMacros,
  setMacroName,
  onDeleteMacro,
  onEditMacro,
  ...activation
}: KeyboardMacroListItemProps) {
  const styles = macroListItemStyles(useTheme()),
    { t } = useTranslation(['macro']);
  const id = macro.id,
    name = macro.name,
    noAction = macro.action.targetKeys.length === 0;
  return (
    <ClassNames>
      {({ css }) => (
        <div css={styles.macroListItem}>
          <TextField
            value={name}
            type="text"
            label=""
            onChange={(event) => setMacroName(id, event.target.value)}
            maxLength={50}
            css={[styles.inputField, styles.nameColumn]}
            inputClassName={css(styles.nameFieldText)}
            onBlur={(event) => {
              if (!/^(?!\s*$).+/.test(event.currentTarget.value))
                setMacroName(id, `${t('macro')} ${numMacros}`);
            }}
          />
          <div css={[styles.inputField, styles.activationButtonColumn]}>
            <ActivationKeyInput {...activation} isNoAction={noAction} />
          </div>
          <SecondaryShimlessButton
            css={styles.iconButton}
            onClick={() => onEditMacro(id)}
          >
            <SettingsIcon css={styles.icon} />
          </SecondaryShimlessButton>
          <SecondaryShimlessButton
            css={styles.iconButton}
            className="with-border"
            onClick={() => onDeleteMacro(id)}
          >
            <CloseXIcon css={styles.icon} />
          </SecondaryShimlessButton>
        </div>
      )}
    </ClassNames>
  );
});
