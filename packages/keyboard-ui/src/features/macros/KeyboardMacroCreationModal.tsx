/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { useState } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router';
import { PanelModal } from '../../components/PanelModal.js';
import { TextField } from '../../components/TextField.js';
import { SecondarySelect } from '../../components/Select.js';
import { useKeyboardViewState } from '../../models/useKeyboardViewState.js';
import type { KeyRemapDeviceProfileInstance } from '../../models/KeyRemapDeviceProfile.js';
import { keyboardRoutes } from '../../keyboardRoutes.js';
import { macroCreationStyles } from './macroControlStyles.js';

interface MacroChoice {
  value: string;
  label: string;
}
export interface KeyboardMacroCreationModalProps {
  keyRemapDeviceProfile: KeyRemapDeviceProfileInstance;
}

/** New/copy confirmation closes, creates the model, resets inputs, then opens the existing editor. */
export const KeyboardMacroCreationModal = observer(
  function KeyboardMacroCreationModal({
    keyRemapDeviceProfile: profile,
  }: KeyboardMacroCreationModalProps) {
    const styles = macroCreationStyles(useTheme()),
      { t } = useTranslation();
    const history = useHistory(),
      { keyboard } = useKeyboardViewState();
    const [mode, setMode] = useState<'new' | 'copy'>('new'),
      [name, setName] = useState('');
    const [selected, setSelected] = useState<string>();
    const isOpen = keyboard.isMacroCreationModalOpen,
      isNew = mode === 'new';
    const options = profile.macroRemaps.map(({ remapTo }) => ({
      value: remapTo.id,
      label: remapTo.name,
    }));
    const reset = () => {
      setMode('new');
      setName('');
      setSelected(undefined);
    };
    const close = () => {
      reset();
      keyboard.setIsMacroCreationModalOpen(false);
    };
    const confirm = () => {
      keyboard.setIsMacroCreationModalOpen(false);
      keyboard.setIsNewMacro(true);
      if (isNew && name) profile.addMacro(name);
      else if (!isNew && selected) profile.cloneMacro(selected);
      reset();
      history.push(keyboardRoutes.keyboardMacros);
    };
    return (
      <ClassNames>
        {({ css }) => (
          <PanelModal
            isOpen={isOpen}
            onConfirm={confirm}
            onCancel={close}
            onRequestClose={close}
            heading={t('macro:addMacro')}
            confirmButtonText={t('common:add')}
            cancelButtonText={t('common:cancel')}
            contentClassName={css(styles.modalContent)}
            confirmDisabled={isNew ? !name : !selected}
            height={380}
            maxWidth={640}
          >
            {/* The retired radio package supplied only this div and controlled native inputs. */}
            <div>
              <div css={styles.optionsContainer}>
                <label css={[styles.radioContainer, styles.item]}>
                  <input
                    css={styles.radio}
                    type="radio"
                    value="new"
                    checked={isNew}
                    onChange={() => setMode('new')}
                  />
                  <span>{t('macro:createANewMacro')}</span>
                </label>
                <TextField
                  value={name}
                  type="text"
                  label={t('macro:macroName')}
                  onChange={(event) => setName(event.currentTarget.value)}
                  css={styles.textField}
                  maxLength={50}
                  disabled={!isNew}
                />
                <div css={[styles.existingMacroItem, styles.item]}>
                  <label css={styles.radioContainer}>
                    <input
                      css={styles.radio}
                      type="radio"
                      value="copy"
                      checked={!isNew}
                      onChange={() => setMode('copy')}
                    />
                    <span>{t('macro:useExistingMacro')}</span>
                  </label>
                  <SecondarySelect<MacroChoice>
                    value={options.find((option) => option.value === selected)}
                    onChange={(option) => {
                      if (option) setSelected(option.value);
                    }}
                    className={css(styles.macroDropdown)}
                    options={options}
                    isDisabled={isNew}
                    menuPlacement="top"
                    maxMenuHeight={150}
                    modal
                  />
                </div>
              </div>
            </div>
          </PanelModal>
        )}
      </ClassNames>
    );
  },
);
