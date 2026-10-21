/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { useState } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash';
import numeral from 'numeral';
import { getValidActuationTypesForDevice } from '../../models/remapKeyUtils.js';
import type { PhysicalKeyInstance } from '../../models/KeyRemapSettings.js';
import { Checkbox } from '../../components/Checkbox.js';
import { Tooltip } from '../../components/Tooltip.js';
import { SliderWithTickValues } from '../../components/SliderWithTickValues.js';
import { rapidTriggerStyles } from './performanceStyles.js';
import type { PerformanceProps, SelectedActuationKey } from './types.js';

/** Rapid enablement uses the first selected key; sensitivity remains a device-table index. */
export const RapidTrigger = observer(function RapidTrigger({
  readyKeyboardDevice: device,
  keyRemapDeviceProfile: remaps,
  firstKeyActive: first,
  selectedKeys,
  disabled,
}: Pick<PerformanceProps, 'readyKeyboardDevice' | 'keyRemapDeviceProfile'> & {
  firstKeyActive?: PhysicalKeyInstance['active'];
  selectedKeys: SelectedActuationKey[];
  disabled?: boolean;
}) {
  const styles = rapidTriggerStyles(useTheme()),
    { t } = useTranslation();
  const [infoOpen, setInfoOpen] = useState(false);
  const {
    Rapid: { validSensitivity },
  } = getValidActuationTypesForDevice(device);
  const keys = selectedKeys.map((key) => key.physicalKeyModel);
  if (first?.kind !== 'Single') return null;
  const actuation = first.actuation;
  const sensitivity = actuation.rapidSensitivity;
  return (
    <div css={styles.mb16}>
      <div css={[styles.rapidTriggerRow, styles.mb16]}>
        <Checkbox
          key="windowsKey"
          label={t('keyboard:rapidTrigger')}
          css={styles.checkbox}
          disabled={disabled}
          checked={actuation.isRapidTrigger}
          onChange={() => remaps.updateActuationRapid(keys, !actuation.isRapidTrigger)}
        />
        <ClassNames>
          {({ css }) => (
            <Tooltip
              open={infoOpen}
              onRequestClose={() => setInfoOpen(false)}
              tooltip={t('keyboard:rapidTriggerInfo')}
              innerClassName={css(styles.tooltipInner)}
              containerType="html"
              placement="top-start"
              offset={[0, 6]}
            >
              <div
                css={styles.moreInfo}
                onMouseOver={() => setInfoOpen(true)}
                onMouseLeave={() => setInfoOpen(false)}
              >
                {t('keyboard:moreInfo')}
              </div>
            </Tooltip>
          )}
        </ClassNames>
      </div>
      {actuation.isRapidTrigger && (
        <ClassNames>
          {({ css }) => (
            <SliderWithTickValues
              unit="mm"
              containerClassName={css(styles.sliderContainer)}
              label={t('keyboard:releaseSensitivity')}
              tickValues={[t('common:low'), t('common:high')]}
              labelVariant="ALT"
              min={1}
              max={39}
              step={1}
              value={sensitivity}
              onChange={debounce(
                (index) => remaps.updateActuationRapidSensitivity(keys, index),
                250,
              )}
              formatTooltipValue={(value) =>
                numeral((validSensitivity[value] ?? 0) / 1000).format('0.00')
              }
            />
          )}
        </ClassNames>
      )}
    </div>
  );
});
