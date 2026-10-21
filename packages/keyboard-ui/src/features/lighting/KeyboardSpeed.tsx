import { useTranslation } from 'react-i18next';
import { SliderWithTickValues } from '../../components/SliderWithTickValues.js';
import type { ControlPlacement } from './types.js';

/** Convert the fractional model speed to 5–100 percent; commit two-decimal fractions after dragging. */
export function KeyboardSpeed({
  speedPercent,
  onChangeSpeed,
  containerClass,
  labelClass,
}: ControlPlacement & {
  speedPercent: number;
  onChangeSpeed: (speed: number) => void;
}) {
  const { t } = useTranslation(['common', 'keyboard']);
  return (
    <div className={containerClass}>
      <h4 className={labelClass}>{t('keyboard:speed')}</h4>
      <SliderWithTickValues
        unit="%"
        value={parseInt((100 * speedPercent).toFixed(0))}
        step={1}
        min={5}
        max={100}
        onAfterChange={(value) => onChangeSpeed(parseFloat((value / 100).toFixed(2)))}
        tickValues={[t('common:slow'), t('common:fast')]}
        label=""
      />
    </div>
  );
}
