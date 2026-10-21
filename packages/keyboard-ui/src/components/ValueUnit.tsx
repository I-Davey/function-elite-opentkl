/** @jsxImportSource @emotion/react */
import { memo, type CSSProperties, type ReactNode } from 'react';
import { steppedFontSize } from '../theme/fontScale.js';

export interface ValueUnitProps {
  className?: string;
  fontSize?: number;
  style?: CSSProperties;
  unit?: ReactNode;
  unitClassName?: string;
  unitStep?: number;
  value?: ReactNode;
}

/** Memoized value/unit display. Unit steps follow the retained discrete font scale. */
export const ValueUnit = memo(function ValueUnit({
  className,
  fontSize = 15,
  style,
  unit,
  unitClassName,
  unitStep,
  value,
}: ValueUnitProps) {
  return (
    <span className={className} style={{ fontSize, ...style }}>
      {value}
      {unit && (
        <span
          className={unitClassName}
          css={{ marginLeft: 1 }}
          style={{ fontSize: steppedFontSize(fontSize, unitStep || -1) }}
        >
          {unit}
        </span>
      )}
    </span>
  );
});
