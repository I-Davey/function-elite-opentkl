/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { useState } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { PanelModal } from '../../components/PanelModal.js';
import { SecondarySelect } from '../../components/Select.js';
import { Checkbox } from '../../components/Checkbox.js';
import { TextField } from '../../components/TextField.js';
import { copyToOnboardStyles } from './profileStyles.js';
import type { OnboardSlotChoice } from './types.js';

export interface CopyToOnboardModalProps {
  isOpen: boolean;
  onboardSlotOptions: OnboardSlotChoice[];
  onConfirm: (slot: number, backup: boolean, name: string) => void;
  onCloseModal: () => void;
}

/** Confirmation closes first, then delegates copy/backup to the existing model and clears local input. */
export const CopyToOnboardModal = observer(function CopyToOnboardModal({
  isOpen,
  onboardSlotOptions,
  onConfirm,
  onCloseModal,
}: CopyToOnboardModalProps) {
  const styles = copyToOnboardStyles(useTheme()),
    { t } = useTranslation(['common']);
  const [slot, setSlot] = useState<number | null>(null);
  const [backup, setBackup] = useState(false),
    [backupName, setBackupName] = useState('');
  const enabled = slot !== null && (!backup || !!backupName);
  const clear = () => {
    setBackup(false);
    setBackupName('');
    setSlot(null);
  };
  const close = () => {
    clear();
    onCloseModal();
  };
  const confirm = () => {
    if (enabled && slot !== null) {
      onCloseModal();
      onConfirm(slot, backup, backupName);
    }
    clear();
  };
  return (
    <ClassNames>
      {({ css }) => (
        <PanelModal
          isOpen={isOpen}
          onConfirm={confirm}
          onCancel={close}
          onRequestClose={close}
          heading={t('common:copyCurrentProfileToDevice')}
          confirmButtonText={t('common:save')}
          cancelButtonText={t('common:cancel')}
          contentClassName={css(styles.modalContent)}
          confirmDisabled={!enabled}
          height={400}
          maxWidth={640}
        >
          <div css={styles.optionsContainer}>
            <div css={styles.control}>
              <div css={styles.dropdownLabel}>
                {t('common:selectProfileDestination')}
              </div>
              <SecondarySelect<OnboardSlotChoice>
                value={onboardSlotOptions.find(
                  (option) => option.value === slot,
                )}
                onChange={(option) => {
                  if (option) setSlot(option.value);
                }}
                options={onboardSlotOptions}
                maxMenuHeight={150}
                modal
              />
            </div>
            <div css={styles.control}>
              <Checkbox
                label={t('common:backupExistingOnDeviceProfile')}
                checked={backup}
                onChange={() => setBackup(!backup)}
              />
            </div>
            <div css={styles.control}>
              <TextField
                value={backupName}
                type="text"
                label={t('common:backupName')}
                onChange={(event) => {
                  if (backup) setBackupName(event.currentTarget.value);
                }}
                css={!backup && styles.disabledTextInput}
                maxLength={50}
                disabled={!backup}
              />
            </div>
          </div>
        </PanelModal>
      )}
    </ClassNames>
  );
});
