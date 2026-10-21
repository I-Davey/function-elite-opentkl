/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { useState } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import type { KeyboardReadyDevice } from '../../models/deviceTypes.js';
import { getValidSimpleRemapTargetKeysForDevice } from '../../models/remapKeyUtils.js';
import { getKeyInfo } from '../../layouts/keyInfo.js';
import { TextField } from '../../components/TextField.js';
import { RemapTargetKeyCategory } from './RemapTargetKeyCategory.js';
import { remapTargetStyles } from './remapStyles.js';
import type { RemapTargetProps, RemapTargetLabel } from './types.js';

/** Retain supported HID/media/custom destinations and their region-specific search metadata. */
export const KeyboardRemapTargetKeys = observer(function KeyboardRemapTargetKeys({
  readyKeyboardDevice: device,
  selectedKey,
  selectedLevel,
  keyRemapDeviceProfile: remaps,
  keyboardRegion,
}: Omit<RemapTargetProps, 'selectedKey'> & {
  readyKeyboardDevice: KeyboardReadyDevice;
  selectedKey?: RemapTargetProps['selectedKey'];
  keyboardRegion: string;
}) {
  const styles = remapTargetStyles(useTheme()),
    { t } = useTranslation(),
    [search, setSearch] = useState('');
  const layout = device.capabilityData.physicalKeys?.physicalKeysLayout?.layout ?? 'ANSI';
  const groups: Record<'common' | 'numbers' | 'special', RemapTargetLabel[]> = {
    common: [],
    numbers: [],
    special: [],
  };
  for (const key of getValidSimpleRemapTargetKeysForDevice(device)) {
    const info = getKeyInfo(key.keyId, layout, keyboardRegion);
    if (!info.label) continue;
    const group = info.keyTerms.includes('number')
      ? 'numbers'
      : info.keyTerms.includes('special')
        ? 'special'
        : 'common';
    groups[group].push({ ...info, keyCode: key.keyId });
  }
  if (!selectedKey)
    return (
      <div css={styles.hintText}>
        <p>{t('keyboard:nothingSelected')}</p>
      </div>
    );
  return (
    <>
      <ClassNames>
        {({ css }) => (
          <TextField
            value={search}
            placeholder={t('keyboard:search')}
            type="text"
            label=""
            onChange={(event) => setSearch(event.target.value)}
            className={css(styles.searchField)}
            inputClassName={css(styles.searchFieldText)}
          />
        )}
      </ClassNames>
      <div css={styles.keysContainer}>
        {Object.entries(groups).map(([category, keyInfo]) => (
          <RemapTargetKeyCategory
            key={category}
            category={category}
            keyInfo={keyInfo}
            searchTerm={search}
            keyRemapDeviceProfile={remaps}
            selectedKey={selectedKey}
            selectedLevel={selectedLevel}
          />
        ))}
      </div>
    </>
  );
});
