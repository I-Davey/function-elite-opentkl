import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { SecondarySelect } from '../../components/Select.js';
import { KeyboardMouseGradientType } from '../../models/keyboardEnums.js';
import type { Choice, ControlPlacement } from './types.js';

type GradientType = (typeof KeyboardMouseGradientType)[keyof typeof KeyboardMouseGradientType];
/** Perimeter callers supply their restricted options; other surfaces retain all gradient directions. */
export const KeyboardGradientType = observer(function KeyboardGradientType({
  gradientType,
  onChange,
  containerClass,
  labelClass,
  options: custom,
}: ControlPlacement & {
  gradientType: GradientType;
  onChange?: (type: GradientType) => void;
  options?: Choice<GradientType>[];
}) {
  const { t } = useTranslation(['keyboard']);
  const options = custom?.length
    ? custom
    : Object.values(KeyboardMouseGradientType).map((value) => ({
        value,
        label: t(`keyboard:direction-${value}`),
      }));
  return (
    <div className={containerClass}>
      <h4 className={labelClass}>{t('keyboard:direction')}</h4>
      <SecondarySelect
        value={options.find((option) => option.value === gradientType)}
        options={options}
        onChange={(option) => {
          if (option) onChange?.(option.value);
        }}
      />
    </div>
  );
});
