/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { useState } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../../components/Tooltip.js';
import { SliderWithTickValues } from '../../components/SliderWithTickValues.js';
import { keyboardSizeStyles } from './effectControlStyles.js';
import type { ControlPlacement } from './types.js';

/** Fixed size ranges retain the disabled slider, fallback display and explanatory hover tooltip. */
export const KeyboardSize = observer(function KeyboardSize({
  minSize = 1,
  maxSize,
  size,
  onChangeTailSize,
  containerClass,
  labelClass,
}: ControlPlacement & {
  minSize?: number;
  maxSize: number;
  size: number;
  onChangeTailSize: (size: number) => void;
}) {
  const { t } = useTranslation(['common', 'keyboard']),
    styles = keyboardSizeStyles(useTheme()),
    [open, setOpen] = useState(false);
  const disabled = minSize >= maxSize;
  return (
    <div className={containerClass}>
      <h4 className={labelClass}>{t('keyboard:size')}</h4>
      <ClassNames>
        {({ css }) => (
          <Tooltip
            open={disabled && open}
            onRequestClose={() => setOpen(false)}
            tooltip={`${maxSize}`}
            innerClassName={css(styles.tooltipInner)}
            containerType="html"
            placement="top-end"
            offset={[14, 0]}
          >
            <div
              onMouseOver={disabled ? () => setOpen(true) : undefined}
              onMouseLeave={disabled ? () => setOpen(false) : undefined}
            >
              <SliderWithTickValues
                unit=""
                value={disabled ? maxSize : size}
                step={1}
                min={disabled ? 1 : minSize}
                max={maxSize}
                onAfterChange={onChangeTailSize}
                tickValues={[t('common:short'), t('common:long')]}
                label=""
                disabled={disabled}
              />
            </div>
          </Tooltip>
        )}
      </ClassNames>
    </div>
  );
});
