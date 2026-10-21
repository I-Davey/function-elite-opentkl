/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../../components/Checkbox.js';
import { TextField } from '../../components/TextField.js';
import { getValidPhysicalKeysForRemapForDevice } from '../../models/remapKeyUtils.js';
import { keyboardRoutes } from '../../keyboardRoutes.js';
import type { KeyboardWorkspaceProps } from '../workspace/KeyboardPreviewRouter.js';
import { ActivationKeyInput } from './ActivationKeyInput.js';
import { unavailableMacroKeys } from './macroAvailability.js';
import { MacroEditor } from './MacroEditor.js';
import { keyboardMacroEditStyles } from './macroEditorStyles.js';

/** Keyboard-only options use the same eligibility as the list and ignore mouse recording. */
export const KeyboardMacroEdit = observer(function KeyboardMacroEdit({
  readyKeyboardDevice: device,
  keyboardDeviceProfile: profile,
}: KeyboardWorkspaceProps) {
  const styles = keyboardMacroEditStyles(useTheme()),
    { t } = useTranslation(['macro']);
  const remaps = profile.keyremapProfile;
  if (!remaps)
    throw Error(
      `${device.deviceType}: Keyboard remap profile is not available`,
    );
  const isFn = profile.keyremapLayer === 'Fn';
  const valid = getValidPhysicalKeysForRemapForDevice(device)[
    profile.keyremapLayer
  ].map((key) => key.keyId);
  const unavailable = unavailableMacroKeys(remaps, isFn);
  const keyboardInfo = {
    layout:
      device.capabilityData.physicalKeys?.physicalKeysLayout?.layout ?? 'ANSI',
    region: profile.keyboardRegion,
  };
  return (
    <MacroEditor
      readyDevice={device}
      keyRemapDeviceProfile={remaps}
      isFnLayer={isFn}
      keyboardInfo={keyboardInfo}
      ignoreMouseEvents
      backRoute={keyboardRoutes.keyboardDeviceMacros}
    >
      {(options) => (
        <div css={styles.macroOptionsContainer}>
          <div css={styles.subContainer}>
            <div css={styles.macroOptionsHeader}>
              <h2 css={styles.sectionTitleNoPadding}>{t('macroOptions')}</h2>
              <Checkbox
                label={t('keyboard:fnLayer')}
                checked={isFn}
                disabled={options.isRecordingMacro}
                onChange={() => {
                  profile.updateKeyremapLayer(isFn ? 'Base' : 'Fn');
                  if (options.triggerKey !== undefined)
                    options.switchLayerToTriggerKey(options.triggerKey, isFn);
                }}
              />
            </div>
            <div css={styles.column}>
              <TextField
                value={options.macro.name}
                type="text"
                label={t('macroName')}
                onChange={options.onChangeMacroName}
                css={styles.textField}
                maxLength={50}
                onBlur={options.onBlurMacroName}
                disabled={options.isRecordingMacro}
              />
              <div css={styles.textField}>
                <ActivationKeyInput
                  keyboardInfo={keyboardInfo}
                  innerLabel={t('activationButton')}
                  isFnLayer={isFn}
                  isNoAction={options.macro.action.targetKeys.length === 0}
                  isRecordingMacro={options.isRecordingMacro}
                  triggerKey={options.triggerKey}
                  setTriggerKey={options.setTriggerKey}
                  unavailablePhysicalKeys={unavailable}
                  validPhysicalKeys={valid}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </MacroEditor>
  );
});
