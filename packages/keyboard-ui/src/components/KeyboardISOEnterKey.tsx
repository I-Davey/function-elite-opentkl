import type { KeyboardTheme } from '../theme/types.js';
import type { KeyLabel } from '../layouts/keyLabels.js';
import { KEY_FONT_SIZE } from '../layouts/keyFontSizes.js';
import type { KeyGeometry } from '../layouts/types.js';
export interface KeyboardISOEnterKeyProps {
  keyInfo: KeyLabel;
  size: { width: number; height: number };
  theme: KeyboardTheme;
  scalar: number;
  keyItem: KeyGeometry & { h2: number; w2: number };
  borderColor?: string;
}
/** ISO Enter retains the two-part keycap outline and original label position. */
export function KeyboardISOEnterKey({
  keyInfo: { fontSize, label },
  size: { width, height },
  theme,
  scalar,
  keyItem,
  borderColor,
}: KeyboardISOEnterKeyProps) {
  const h = (keyItem.height || 1) * scalar,
    w = (keyItem.width || 1) * scalar,
    h2 = keyItem.h2 * h,
    w2 = keyItem.w2 * w,
    getPath = (border: number) =>
      [
        `M ${border} ${border + 2}`,
        `L ${border} ${h2 - border - 2}`,
        `A 4.5,4.5 0 0 0 ${border + 2},${h2 - border}`,
        `L ${w2 + border - 2} ${h2 - border}`,
        `A 4.5,4.5 0 0 1 ${w2 + border},${h2 - border + 2}`,
        `L ${w2 + border} ${h - border - 2}`,
        `A 4.5,4.5 0 0 0 ${w2 + border + 2},${h - border}`,
        `L ${w - border - 2} ${h - border}`,
        `A 4.5,4.5 0 0 0 ${w - border},${h - border - 2}`,
        `L ${w - border} ${border + 2}`,
        `A 4.5,4.5 0 0 0 ${w - border - 2},${border}`,
        `L ${border + 2} ${border}`,
        `A 4.5,4.5 0 0 0 ${border},${border + 2}`,
        'z',
      ].join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} height={height} width={width}>
      <g>
        <path
          d={getPath(2)}
          stroke={null != borderColor ? borderColor : `${theme.keyboard.keyCapWall}`}
          fill={`${theme.keyboard.keyCapWall}`}
        />
        <g transform="translate(0, -2)">
          <path d={getPath(8)} stroke="none" fill={`${theme.keyboard.keyCapSurface}`} />
        </g>
        <text
          x="55%"
          y="50%"
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize={fontSize || KEY_FONT_SIZE}
        >
          {label}
        </text>
      </g>
    </svg>
  );
}
