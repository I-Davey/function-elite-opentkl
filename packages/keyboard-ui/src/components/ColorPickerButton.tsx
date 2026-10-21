/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import type { MouseEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import { SecondaryButton } from './Button.js';
import { AngleDownIcon } from './icons/AngleDownIcon.js';
import { formatHex } from '../theme/color.js';
import { colorPickerButtonStyles } from './colorPickerStyles.js';

export interface ColorPickerButtonProps {
  hex: string;
  outlineHex?: string;
  toggle: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  flavor?: 'normal' | 'minimal' | 'minimal-with-downArrow' | 'minimal-no-shim';
  buttonClassName?: string;
  enableOutline?: boolean;
}
/** The existing compact variants retain swatch/outline, label and arrow placement. */
export function ColorPickerButton({
  hex,
  outlineHex,
  toggle,
  disabled,
  flavor,
  buttonClassName,
  enableOutline,
}: ColorPickerButtonProps) {
  const styles = colorPickerButtonStyles(useTheme(), hex, outlineHex),
    { t } = useTranslation();
  const withArrow = flavor === 'minimal-with-downArrow',
    noShim = flavor === 'minimal-no-shim';
  const minimal = flavor === 'minimal' || noShim || withArrow;
  return (
    <SecondaryButton
      aria-label={t('common:colorPicker')}
      onClick={toggle}
      disabled={disabled}
      className={buttonClassName}
      css={[
        styles.button,
        minimal && styles.buttonMinimal,
        withArrow && styles.buttonMinimalWithDownArrow,
        noShim && styles.noShim,
      ]}
    >
      <div
        css={[styles.buttonInner, minimal && styles.buttonInnerMinimal, noShim && styles.noShim]}
      >
        <div css={[styles.swatch, enableOutline && styles.outline]} />
        {!minimal && formatHex(hex.toUpperCase())}
        {(!minimal || withArrow) && <AngleDownIcon css={styles.buttonIcon} />}
      </div>
    </SecondaryButton>
  );
}
