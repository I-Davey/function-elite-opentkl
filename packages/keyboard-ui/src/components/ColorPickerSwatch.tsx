/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import type { ReactNode } from 'react';
import type { Color } from '../theme/color.js';
import { colorPickerSwatchStyles } from './colorPickerStyles.js';

export interface ColorPickerSwatchProps {
  color?: Color;
  className?: string;
  children?: ReactNode;
  onClick: (color: Color | undefined) => void;
}
/** Undefined is the outline's transparent swatch; keep the checkerboard and callback value. */
export function ColorPickerSwatch({ color, className, children, onClick }: ColorPickerSwatchProps) {
  const styles = colorPickerSwatchStyles(useTheme(), color);
  return (
    <button
      className={className}
      css={[styles.swatch, color === undefined && styles.transparentSwatch]}
      onClick={() => onClick(color)}
    >
      {children}
    </button>
  );
}
