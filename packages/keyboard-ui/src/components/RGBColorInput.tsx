/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import type { ChangeEvent } from 'react';
import { rgbFromHex, rgbToHex } from '../theme/color.js';
import { rgbInputStyles } from './colorPickerStyles.js';

/** Channel edits retain integer parsing, 0–255 clamping and leading-zero cleanup. */
export function RGBColorInput({ hex, onChange }: { hex: string; onChange: (hex: string) => void }) {
  const styles = rgbInputStyles(useTheme()),
    color = rgbFromHex(hex);
  const change = (event: ChangeEvent<HTMLInputElement>, channel: 'r' | 'g' | 'b') => {
    const { value } = event.currentTarget;
    let next = parseInt(value || '0');
    if (isNaN(next)) return;
    next = Math.max(0, Math.min(255, next));
    if (value.startsWith('0') && value.length > 1) event.currentTarget.value = value.slice(1);
    const updated = { ...color, [channel]: next };
    onChange(rgbToHex(updated.r, updated.g, updated.b));
  };
  return (
    <div css={styles.rgbContainer}>
      {(['r', 'g', 'b'] as const).map((channel) => (
        <div key={channel} css={styles.rgbInput}>
          <label css={styles.label}>{channel.toUpperCase()}</label>
          <input
            css={styles.textField}
            type="number"
            name={channel}
            id={channel}
            min="0"
            max="255"
            value={color[channel]}
            onChange={(event) => change(event, channel)}
          />
        </div>
      ))}
    </div>
  );
}
