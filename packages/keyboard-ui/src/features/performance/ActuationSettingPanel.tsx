/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash';
import numeral from 'numeral';
import { getValidActuationTypesForDevice } from '../../models/remapKeyUtils.js';
import { KeyboardSwitchIcon } from '../../components/icons/KeyboardSwitchIcon.js';
import { ActuationSlider } from './ActuationSlider.js';
import { RapidTrigger } from './RapidTrigger.js';
import { actuationSettingStyles } from './performanceStyles.js';
import type { PerformanceProps, SelectedActuationKey } from './types.js';

/** Selected single-actuation keys share a slider; mixed/dual selections retain the original empty state. */
export const ActuationSettingPanel = observer(function ActuationSettingPanel({
  readyKeyboardDevice: device,
  keyboardDeviceProfile: profile,
  keyRemapDeviceProfile: remaps,
}: PerformanceProps) {
  const styles = actuationSettingStyles(useTheme()),
    { t } = useTranslation();
  const active = remaps.activeProfile,
    {
      Single: { validLevels },
    } = getValidActuationTypesForDevice(device);
  const selected: SelectedActuationKey[] = [];
  profile.selectedKeys.forEach((code) => {
    const key = active?.physicalKeys.get(String(code));
    if (key) selected.push({ keyCode: code, physicalKeyModel: key });
  });
  if (selected.some((key) => key.physicalKeyModel.active.kind === 'NoConfigurableActuation'))
    throw Error(`${device.deviceType}: No Configurable Actuation`);
  const first = selected[0]?.physicalKeyModel.active;
  const allSingle =
    selected.length > 0 && selected.every((key) => key.physicalKeyModel.active.kind === 'Single');
  return (
    <>
      <RapidTrigger
        readyKeyboardDevice={device}
        keyRemapDeviceProfile={remaps}
        firstKeyActive={first}
        selectedKeys={selected}
        disabled={selected.length === 0}
      />
      <div css={[styles.container, styles.flexCenter]}>
        <KeyboardSwitchIcon css={styles.switch} />
        {selected.length === 0 ? (
          <div css={styles.hintText}>
            <p>{t('keyboard:nothingSelected')}</p>
          </div>
        ) : allSingle && first?.kind === 'Single' ? (
          <ActuationSlider
            domain={[0, validLevels.length - 1]}
            step={1}
            values={[first.actuation.level]}
            onChange={debounce(
              (values) =>
                remaps.updateActuationLevel(
                  selected.map((key) => key.physicalKeyModel),
                  values[0],
                ),
              250,
            )}
            tickCount={validLevels.length}
            tickFormat={(value) => `${numeral((validLevels[value] ?? 0) / 1000).format('0.00')} mm`}
          />
        ) : (
          <></>
        )}
      </div>
    </>
  );
});
