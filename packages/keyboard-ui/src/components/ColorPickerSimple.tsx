/** @jsxImportSource @emotion/react */
import type { Color } from '../theme/color.js';
import { ColorPickerSwatch } from './ColorPickerSwatch.js';
import { colorPickerSimpleStyles } from './colorPickerStyles.js';

/** Preserve palette order and the optional transparent outline entry. */
export function ColorPickerSimple({
  onColorChange,
  defaultColors,
  addTransparentSwatch,
}: {
  onColorChange: (color: Color | undefined) => void;
  defaultColors: readonly Color[];
  addTransparentSwatch?: boolean;
}) {
  const styles = colorPickerSimpleStyles();
  return (
    <ol css={[styles.swatchGrid, styles.swatchGridOutline]}>
      {addTransparentSwatch && (
        <li key="swatch-transparent">
          <ColorPickerSwatch onClick={onColorChange} />
        </li>
      )}
      {defaultColors.map((color) => (
        <li key={`swatch-${color.toString()}`}>
          <ColorPickerSwatch color={color} onClick={onColorChange} />
        </li>
      ))}
    </ol>
  );
}
