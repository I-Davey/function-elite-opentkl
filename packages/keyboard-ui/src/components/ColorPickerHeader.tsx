/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { useTranslation } from 'react-i18next';
import type { Color } from '../theme/color.js';
import { convertHexToColorObject } from '../logic/colorPicker.js';
import { ColorPickerSwatch } from './ColorPickerSwatch.js';
import { colorPickerHeaderStyles } from './colorPickerStyles.js';

export type ColorPickerTab = 'text' | 'outline';
/** Recent colours remain in stored order; outline/text tabs share the original heading. */
export function ColorPickerHeader({
  enableOutline,
  tab,
  setTab,
  onColorChange,
  recentColors,
}: {
  enableOutline?: boolean;
  tab: ColorPickerTab;
  setTab: (tab: ColorPickerTab) => void;
  onColorChange: (color: Color | undefined) => void;
  recentColors: readonly string[];
}) {
  const { t } = useTranslation(),
    styles = colorPickerHeaderStyles(useTheme());
  return (
    <>
      {enableOutline ? (
        <h3 css={styles.heading}>
          <button
            css={[styles.tab, tab === 'text' && styles.selectedTab]}
            onClick={() => setTab('text')}
          >
            {t('common:text')}
          </button>
          <button
            css={[styles.tab, tab === 'outline' && styles.selectedTab]}
            onClick={() => setTab('outline')}
          >
            {t('common:outline')}
          </button>
        </h3>
      ) : (
        <h3 css={styles.heading}>{t('common:colorPicker-colorSwatches')}</h3>
      )}
      {recentColors.length > 0 && (
        <ol css={[styles.swatchGrid, styles.recentSwatches]}>
          {recentColors.map((hex) => (
            <li key={hex}>
              <ColorPickerSwatch color={convertHexToColorObject(hex)} onClick={onColorChange} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
