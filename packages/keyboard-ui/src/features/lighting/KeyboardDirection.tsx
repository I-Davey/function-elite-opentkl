import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import type { GroupBase } from 'react-select';
import { SecondarySelect } from '../../components/Select.js';
import { getSecondaryStyles } from '../../components/selectStyles.js';
import { KeyboardMouseLightingDirection } from '../../models/keyboardEnums.js';
import type { KeyboardTheme } from '../../theme/types.js';
import type { Choice, ControlPlacement } from './types.js';

type Direction =
  (typeof KeyboardMouseLightingDirection)[keyof typeof KeyboardMouseLightingDirection];
/** Empty custom option arrays retain the original full-direction fallback. */
export const KeyboardDirection = observer(function KeyboardDirection({
  direction,
  onChange,
  containerClass,
  labelClass,
  theme,
  options: custom,
}: ControlPlacement & {
  direction: Direction;
  onChange?: (direction: Direction) => void;
  theme: KeyboardTheme;
  options?: Choice<Direction>[];
}) {
  const { t } = useTranslation(['keyboard']);
  const options = custom?.length
    ? custom
    : Object.values(KeyboardMouseLightingDirection).map((value) => ({
        value,
        label: t(`keyboard:direction-${value}`),
      }));
  return (
    <div className={containerClass}>
      <h4 className={labelClass}>{t('keyboard:direction')}</h4>
      <SecondarySelect<Choice<Direction>>
        value={options.find((option) => option.value === direction)}
        options={options}
        onChange={(option) => {
          if (option) onChange?.(option.value);
        }}
        styles={getSecondaryStyles<Choice<Direction>, false, GroupBase<Choice<Direction>>>(theme)}
      />
    </div>
  );
});
