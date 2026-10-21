/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router';
import { SecondaryButton } from '../../components/Button.js';
import { useKeyboardViewState } from '../../models/useKeyboardViewState.js';
import { getValidPhysicalKeysForRemapForDevice } from '../../models/remapKeyUtils.js';
import { keyboardRoutes } from '../../keyboardRoutes.js';
import type { KeyboardWorkspaceProps } from '../workspace/KeyboardPreviewRouter.js';
import { KeyboardMacroCreationModal } from './KeyboardMacroCreationModal.js';
import { KeyboardMacroListItem } from './KeyboardMacroListItem.js';
import { unavailableMacroKeys } from './macroAvailability.js';
import { macroControlStyles } from './macroControlStyles.js';

/** List actions use the linked remap model, keeping Base/Fn assignment and hardware names in sync. */
export const KeyboardMacroControls = observer(function KeyboardMacroControls({
  readyKeyboardDevice: device,
  keyboardDeviceProfile: profile,
}: KeyboardWorkspaceProps) {
  const styles = macroControlStyles(useTheme()),
    { t } = useTranslation(['macro']);
  const { keyboard } = useKeyboardViewState(),
    history = useHistory();
  const list = useRef<HTMLDivElement>(null),
    [scrollbar, setScrollbar] = useState(false);
  if (!device.capabilityData.uniqueId.id)
    throw Error(`${device.deviceType}: Device uniqueId is not available`);
  const remaps = profile.keyremapProfile;
  if (!remaps)
    throw Error(
      `${device.deviceType}: Keyboard remap profile is not available`,
    );
  const isFn = profile.keyremapLayer === 'Fn';
  const macros = isFn ? remaps.singleFnMacroRemaps : remaps.singleMacroRemaps;
  const keyboardInfo = {
    region: profile.keyboardRegion,
    layout:
      device.capabilityData.physicalKeys?.physicalKeysLayout?.layout ?? 'ANSI',
  };
  useEffect(() => {
    if (list.current)
      setScrollbar(list.current.scrollHeight > list.current.clientHeight);
  }, [macros.length]);
  const valid = getValidPhysicalKeysForRemapForDevice(device)[
    profile.keyremapLayer
  ].map((key) => key.keyId);
  const unavailable = unavailableMacroKeys(remaps, isFn);
  return (
    <div css={styles.container}>
      <div css={styles.section}>
        <div css={styles.title}>
          {t('macros')}
          <SecondaryButton
            onClick={() => keyboard.setIsMacroCreationModalOpen(true)}
          >
            {t('addMacro')}
          </SecondaryButton>
        </div>
        {macros.length > 0 ? (
          <div css={styles.macroContent}>
            <div
              css={styles.macroListItem}
              style={{ paddingRight: 12 * (scrollbar ? 2 : 1) }}
            >
              <div css={[styles.label, styles.nameColumn]}>
                {t('common:name')}
              </div>
              <div css={[styles.label, styles.activationButtonColumn]}>
                {t('activationButton')}
              </div>
            </div>
            <div css={styles.macroList} ref={list}>
              {macros.map(({ remapTo: macro, physicalKey }, index) => (
                <KeyboardMacroListItem
                  key={`macro-${index}`}
                  macro={macro}
                  numMacros={macros.length}
                  triggerKey={physicalKey}
                  isFnLayer={isFn}
                  keyboardInfo={keyboardInfo}
                  validPhysicalKeys={valid}
                  unavailablePhysicalKeys={unavailable}
                  setTriggerKey={(key) =>
                    key === undefined
                      ? remaps.resetMacroPhysicalKey(macro.id, isFn)
                      : remaps.updateMacroPhysicalKey(macro.id, key, 0, isFn)
                  }
                  setMacroName={(id, name) => {
                    remaps.getMacroRemap(id)?.remapTo.setName(name);
                    remaps.storeHardwareMacroInfo(
                      name,
                      id,
                      physicalKey,
                      0,
                      isFn,
                    );
                  }}
                  onDeleteMacro={(id) => remaps.deleteMacro(id, isFn)}
                  onEditMacro={(id) => {
                    keyboard.setIsNewMacro(false);
                    remaps.setMacroEditId(id);
                    history.push(keyboardRoutes.keyboardMacros);
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div css={styles.macroDescription}>
            <p>{t('macrosDescription')}</p>
          </div>
        )}
        <KeyboardMacroCreationModal keyRemapDeviceProfile={remaps} />
      </div>
    </div>
  );
});
