/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { useEffect, useMemo, useState } from 'react';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/Modal.js';
import { TextField } from '../../components/TextField.js';
import { Checkbox } from '../../components/Checkbox.js';
import { PrimarySelect } from '../../components/Select.js';
import { useKeyboardViewState } from '../../models/useKeyboardViewState.js';
import type { KeyboardDeviceProfileInstance } from '../../models/KeyboardDeviceProfile.js';
import { DEFAULT_PROFILE_ID } from '../../models/profileConstants.js';
import { profileEditStyles } from './profileStyles.js';
import type { ProfileChoice } from './types.js';

export interface KeyboardProfileEditModalProps {
  keyboardDeviceProfile: KeyboardDeviceProfileInstance;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

/** Editing uses Delete as the secondary action; closing always cancels. Names retain the 50-char limit. */
export const KeyboardProfileEditModal = observer(
  function KeyboardProfileEditModal({
    keyboardDeviceProfile: profile,
    onSave,
    onCancel,
    onDelete,
  }: KeyboardProfileEditModalProps) {
    const styles = profileEditStyles(useTheme()),
      { t } = useTranslation(['common', 'keyboard']);
    const { saveAsModal } = useKeyboardViewState().keyboard;
    const edit = profile.profileEditState,
      profiles = profile.profiles;
    const editing = edit?.kind === 'edit',
      name = edit?.name,
      canDelete = profile.activeProfile.canBeDeleted;
    const isOpen = saveAsModal.isOpened;
  // Renaming does not replace the computed profile array; observe labels outside the React memo.
  const profileNames = JSON.stringify(profiles.map((p) => p.name));
    const options = useMemo(
      () => [
        {
          label: t('common:duplicateUserProfileHeading'),
          options: profiles
            .slice()
            .sort((a, b) => +b.lastSelected - +a.lastSelected)
            .map((p): ProfileChoice => ({
              value: p.id,
              label:
                p.id !== DEFAULT_PROFILE_ID || p.name
                  ? p.name
                  : t('common:default'),
            })),
        },
      ],
    [profiles, profileNames, t],
    );
    const [copy, setCopy] = useState({ enabled: false, originId: '' });
    useEffect(() => {
      setCopy({ enabled: false, originId: options[0].options[0]?.value ?? '' });
    }, [options]);
    const selectedCopy =
      options[0].options.find((option) => option.value === copy.originId) ??
      options[0].options[0];
    const save = () => {
      if (!edit?.name) return;
      if (edit.kind === 'add' && copy.enabled)
        runInAction(() => {
          edit.originId = copy.originId;
        });
      onSave();
    };
    return (
      <ClassNames>
        {({ css }) => (
          <Modal
            isOpen={isOpen}
            confirmButtonText={t('common:save')}
            cancelButtonText={t(editing ? 'common:delete' : 'common:cancel')}
            showCloseButton
            onConfirm={save}
            onCancel={editing ? onDelete : onCancel}
            onRequestClose={onCancel}
            contentClassName={css(styles.modalContent)}
            confirmDisabled={!name}
            cancelDisabled={editing && !canDelete}
            maxWidth={editing ? 500 : 600}
            height="auto"
          >
            {edit && (
              <div css={styles.content}>
                <h1 css={styles.heading}>
                  {t(editing ? 'common:editProfile' : 'common:newProfile')}
                </h1>
                <div css={styles.body}>
                  <TextField
                    value={name}
                    type="text"
                    label={t('keyboard:saveThemePackModal-nameLabel')}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      runInAction(() => {
                        edit.name = value;
                      });
                    }}
                    css={styles.textField}
                    maxLength={50}
                  />
                  {!editing && (
                    <div css={styles.copyProfileSection}>
                      <Checkbox
                        label={t('common:duplicateProfile')}
                        checked={copy.enabled}
                        onChange={() =>
                          setCopy({ ...copy, enabled: !copy.enabled })
                        }
                      />
                      <PrimarySelect<ProfileChoice>
                        value={selectedCopy}
                        onChange={(option) => {
                          if (option)
                            setCopy({ enabled: true, originId: option.value });
                        }}
                        options={options}
                        isDisabled={!copy.enabled}
                        menuPlacement="top"
                        maxMenuHeight={200}
                        className={css(styles.profileSelect)}
                        modal
                        tooltip
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </Modal>
        )}
      </ClassNames>
    );
  },
);
