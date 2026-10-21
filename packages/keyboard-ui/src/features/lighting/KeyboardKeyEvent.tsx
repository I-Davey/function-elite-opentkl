import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import type { GroupBase } from 'react-select';
import { SecondarySelect } from '../../components/Select.js';
import { getSecondaryStyles } from '../../components/selectStyles.js';
import { KeyboardMouseLightingKeyTrigger } from '../../models/keyboardEnums.js';
import type { KeyboardTheme } from '../../theme/types.js';
import type { Choice, ControlPlacement } from './types.js';

type KeyEvent =
  (typeof KeyboardMouseLightingKeyTrigger)[keyof typeof KeyboardMouseLightingKeyTrigger];
/** The retained editor exposes Pressed/Released while the model keeps its full trigger enum. */
export const KeyboardKeyEvent = observer(function KeyboardKeyEvent({
  keyEvent,
  onChange,
  containerClass,
  labelClass,
  theme,
}: ControlPlacement & {
  keyEvent: KeyEvent;
  onChange?: (event: KeyEvent) => void;
  theme: KeyboardTheme;
}) {
  const { t } = useTranslation(['keyboard']);
  const options: Choice<KeyEvent>[] = [
    KeyboardMouseLightingKeyTrigger.Pressed,
    KeyboardMouseLightingKeyTrigger.Released,
  ].map((value) => ({ value, label: t(`keyboard:keyEvent-${value}`) }));
  return (
    <div className={containerClass}>
      <h4 className={labelClass}>{t('keyboard:keyEvent')}</h4>
      <SecondarySelect
        value={options.find((option) => option.value === keyEvent)}
        options={options}
        onChange={(option) => {
          if (option) onChange?.(option.value);
        }}
        styles={getSecondaryStyles<Choice<KeyEvent>, false, GroupBase<Choice<KeyEvent>>>(theme)}
      />
    </div>
  );
});
