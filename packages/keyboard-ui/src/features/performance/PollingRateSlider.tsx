/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { observer } from 'mobx-react';
import { debounce } from 'lodash';
import { PollingRate } from '../../models/keyboardEnums.js';
import { SliderWithTickValues } from '../../components/SliderWithTickValues.js';
import { pollingRateStyles } from './performanceStyles.js';
import type { PerformanceProps } from './types.js';

/** Retain the original enum/filter/reverse ordering and one-based selection indices. */
export const PollingRateSlider = observer(function PollingRateSlider({
  readyKeyboardDevice: device,
  keyboardDeviceProfile: profile,
}: Omit<PerformanceProps, 'keyRemapDeviceProfile'>) {
  const styles = pollingRateStyles(useTheme()),
    settings = profile.activeProfile.settings;
  const { validValues } = device.capabilityData.pollingRate!;
  const rates = Object.values(PollingRate)
    .filter((rate) => validValues.includes(rate))
    .reverse();
  const change = debounce(
    (index: number) => {
      const rate = rates[index - 1];
      if (rate) settings.setPollingRate(rate);
    },
    250,
    { leading: true },
  );
  return (
    <SliderWithTickValues
      unit="Hz"
      formatTooltipValue={(value) => rates[value - 1]?.replace('Hz', '') ?? ''}
      label=""
      step={1}
      min={1}
      max={rates.length}
      value={rates.findIndex((rate) => rate === settings.pollingRate) + 1}
      onChange={change}
      tickValues={rates}
      drawTickValues={rates.map((_, index) => index + 1)}
      belowSliderRenderer={() => (
        <div css={styles.belowSlider}>
          {rates.map((rate, index) => (
            <span
              key={index}
              style={{
                position: 'absolute',
                transform: index === 0 ? 'translateX(0%)' : 'translateX(-50%)',
                left: (index / (rates.length - 1)) * 100 + '%',
              }}
            >
              {rate.replace('Hz', '')}
            </span>
          ))}
        </div>
      )}
    />
  );
});
