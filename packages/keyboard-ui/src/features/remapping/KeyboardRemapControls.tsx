/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { useState } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import type { KeyboardReadyDevice } from '../../models/deviceTypes.js';
import type { KeyboardDeviceProfileInstance } from '../../models/KeyboardDeviceProfile.js';
import { KeyboardRemapTargetKeys } from './KeyboardRemapTargetKeys.js';
import { RemapAppliedTargetKey } from './RemapAppliedTargetKey.js';
import { remapControlStyles } from './remapStyles.js';
import type { SelectedRemapKey } from './types.js';

/** The first selected physical key drives the original single/dual Base/Fn remap editor. */
export const KeyboardRemapControls = observer(function KeyboardRemapControls({
  readyKeyboardDevice: device,
  keyboardDeviceProfile: profile,
}: {
  readyKeyboardDevice: KeyboardReadyDevice;
  keyboardDeviceProfile: KeyboardDeviceProfileInstance;
}) {
  const styles = remapControlStyles(useTheme()),
    { t } = useTranslation(),
    [level, setLevel] = useState(0);
  if (!device.capabilityData.uniqueId.id)
    throw Error(`${device.deviceType}: Device uniqueId is not available`);
  const remaps = profile.keyremapProfile;
  if (!remaps) throw Error(`${device.deviceType}: Keyboard remap profile is not available`);
  const isFn = profile.keyremapLayer === 'Fn',
    selected: SelectedRemapKey[] = [];
  profile.selectedKeys.forEach((code) => {
    const key = remaps.activeProfile?.physicalKeys.get(String(code));
    if (key) selected.push({ keyCode: code, physicalKeyModel: key, isFn });
  });
  const keyboardInfo = {
    layout: device.capabilityData.physicalKeys?.physicalKeysLayout?.layout ?? 'ANSI',
    region: profile.keyboardRegion,
  };
  return (
    <div css={styles.container}>
      <div css={styles.section}>
        <div css={styles.title}>{t('keyboard:targetKeys')}</div>
        <KeyboardRemapTargetKeys
          keyboardRegion={profile.keyboardRegion}
          readyKeyboardDevice={device}
          keyRemapDeviceProfile={remaps}
          selectedKey={selected[0]}
          selectedLevel={level}
        />
      </div>
      <div css={styles.section}>
        <div css={styles.title}>{t('keyboard:applied')}</div>
        <RemapAppliedTargetKey
          isFnLayerSelected={isFn}
          keyboardInfo={keyboardInfo}
          keyRemapDeviceProfile={remaps}
          selectedKey={selected[0]}
          selectedLevel={level}
          setSelectedLevel={setLevel}
        />
      </div>
    </div>
  );
});
