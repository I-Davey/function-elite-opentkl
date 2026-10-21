/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { useState } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { Header } from '../../components/Header.js';
import { Tooltip } from '../../components/Tooltip.js';
import {
  SecondaryButton,
  SecondaryShimlessButton,
} from '../../components/Button.js';
import { PrimarySelect } from '../../components/Select.js';
import { SettingsIcon } from '../../components/icons/SettingsIcon.js';
import { useKeyboardViewState } from '../../models/useKeyboardViewState.js';
import type { KeyboardDeviceProfileInstance } from '../../models/KeyboardDeviceProfile.js';
import type { KeyboardReadyDevice } from '../../models/deviceTypes.js';
import { DEFAULT_PROFILE_ID } from '../../models/profileConstants.js';
import { KeyboardProfileEditModal } from './KeyboardProfileEditModal.js';
import { CopyToOnboardModal } from './CopyToOnboardModal.js';
import { profileHeaderStyles } from './profileStyles.js';
import type { ProfileChoice } from './types.js';

export const ADD_PROFILE_OPTION_ID = 'add-new-profile';
export interface KeyboardHeaderProps {
  keyboardDevice?: KeyboardReadyDevice;
  keyboardDeviceProfile?: KeyboardDeviceProfileInstance;
  showProfileControls?: boolean;
}

/** The standalone workspace has one keyboard; profile changes stay on its existing linked models. */
export const KeyboardHeader = observer(function KeyboardHeader({
  keyboardDevice: device,
  keyboardDeviceProfile: profile,
  showProfileControls = true,
}: KeyboardHeaderProps) {
  const styles = profileHeaderStyles(useTheme()),
    { t } = useTranslation(['common', 'keyboard']);
  const { keyboard } = useKeyboardViewState();
  const [infoOpen, setInfoOpen] = useState(false);
  if (!device || !profile)
    return (
      <ClassNames>
        {({ css }) => (
          <Header
            title={t('common:keyboard')}
            className={css(styles.header)}
            contentClassName={css(styles.headerContent)}
          />
        )}
      </ClassNames>
    );
  const active = profile.activeProfile,
    stored = active.isHardwareProfile,
    slot = active.hardwareProfileId;
  const slotOptions = profile.hardwareProfiles.map((p) => ({
    value: p.hardwareProfileId,
    label: `${t('keyboard:onboardProfile', { profileNumber: p.hardwareProfileId !== undefined ? p.hardwareProfileId + 1 : '' })}: Currently ${p.name}`,
  }));
  const choices: ProfileChoice[] = [
    {
      value: ADD_PROFILE_OPTION_ID,
      label: t('common:newProfile'),
      isBold: true,
    },
    ...profile.profiles.map((p) => ({
      value: p.id,
      label:
        p.id !== DEFAULT_PROFILE_ID || p.name ? p.name : t('common:default'),
    })),
  ];
  const selected = choices.find((choice) => choice.value === active.id);
  const copyOpen = keyboard.isCopyToHardwareModalOpen;
  const change = (choice: ProfileChoice | null) => {
    if (!choice) return;
    if (choice.value === ADD_PROFILE_OPTION_ID) {
      profile.beginProfileEdit();
      keyboard.saveAsModal.open();
    } else profile.setActiveProfileId(choice.value, { fromDevice: false });
  };
  const edit = () => {
    profile.beginProfileEdit(active.id);
    keyboard.saveAsModal.open();
  };
  const save = () => {
    profile.saveProfileEdit();
    keyboard.saveAsModal.close();
  };
  const cancel = () => {
    profile.cancelProfileEdit();
    keyboard.saveAsModal.close();
  };
  const remove = () => {
    profile.deleteActiveProfile();
    keyboard.saveAsModal.close();
  };
  return (
    <>
      <ClassNames>
        {({ css }) => (
          <div css={styles.container}>
            <Header
              className={css(styles.header)}
              contentClassName={css(styles.headerContent)}
            >
              {showProfileControls && (
                <div css={styles.profileControls}>
                  <div
                    css={styles.profileSelection}
                    data-testid="keyboard-profile-selection"
                  >
                    <Tooltip
                      className={css(styles.tooltipInner)}
                      placement="bottom-start"
                      open={infoOpen}
                      tooltip={
                        <>
                          <h1 css={styles.tooltipHeader}>
                            {t(
                              stored
                                ? 'common:onboardProfile'
                                : 'common:softwareProfile',
                            )}
                          </h1>
                          <p css={styles.tooltipBody}>
                            {t(
                              stored
                                ? 'common:onboardProfileDescription'
                                : 'common:softwareProfileDescription',
                            )}
                          </p>
                          {stored && (
                            <p css={styles.tooltipBody}>
                              {t('keyboard:onboardProfileSwitchDescription')}
                            </p>
                          )}
                        </>
                      }
                      containerClassName={css(styles.tooltipContainer)}
                    >
                      <div
                        css={styles.hardwareInfo}
                        onMouseEnter={() => setInfoOpen(true)}
                        onMouseLeave={() => setInfoOpen(false)}
                      >
                        {stored
                          ? t('keyboard:onboardProfile', {
                              profileNumber: slot !== undefined ? slot + 1 : '',
                            })
                          : t('common:softwareProfile')}
                      </div>
                    </Tooltip>
                    {!stored && (
                      <SecondaryButton
                        css={styles.copyToHardwareButton}
                        onClick={() =>
                          keyboard.setIsCopyToHardwareModalOpen(true)
                        }
                      >
                        {t('common:copyProfileToOnboardShort')}
                      </SecondaryButton>
                    )}
                    <PrimarySelect<ProfileChoice>
                      value={selected}
                      onChange={change}
                      options={choices}
                      className={css(styles.profileSelect)}
                      tooltip
                    />
                  </div>
                  {!stored && (
                    <div css={styles.editButtonContainer}>
                      <SecondaryShimlessButton
                        css={styles.editButton}
                        aria-label="Edit profile"
                        onClick={edit}
                      >
                        <SettingsIcon />
                      </SecondaryShimlessButton>
                    </div>
                  )}
                </div>
              )}
            </Header>
          </div>
        )}
      </ClassNames>
      <KeyboardProfileEditModal
        keyboardDeviceProfile={profile}
        onSave={save}
        onCancel={cancel}
        onDelete={remove}
      />
      <CopyToOnboardModal
        isOpen={copyOpen}
        onboardSlotOptions={slotOptions}
        onConfirm={profile.copyCurrentProfileToHardware}
        onCloseModal={() => keyboard.setIsCopyToHardwareModalOpen(false)}
      />
    </>
  );
});
