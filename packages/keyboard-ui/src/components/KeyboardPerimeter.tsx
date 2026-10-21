/** @jsxImportSource @emotion/react */
import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import { cloneGradient } from '../theme/gradients.js';
import { formatHex, type GradientStop } from '../theme/color.js';

/** Preserve the recovered two-contour ring and gradient seam positions. */
function perimeterPath(width: number, height: number) {
  const radius = 16,
    inner = 6,
    offset = 10;
  return `M ${radius} 0 H ${width - radius}
    A ${radius} ${radius} 0 0 1 ${width} ${radius}
    V ${height - radius} A ${radius} ${radius} 0 0 1 ${width - radius} ${height}
    H ${radius} A ${radius} ${radius} 0 0 1 0 ${height - radius}
    V ${radius} A ${radius} ${radius} 0 0 1 ${radius} 0 Z
    M ${inner + offset} ${offset} H ${width - inner - offset}
    A ${inner} ${inner} 0 0 1 ${width - offset} ${inner + offset}
    V ${height - inner - offset}
    A ${inner} ${inner} 0 0 1 ${width - inner - offset} ${height - offset}
    H ${inner + offset}
    A ${inner} ${inner} 0 0 1 ${offset} ${height - inner - offset}
    V ${inner + offset} A ${inner} ${inner} 0 0 1 ${inner + offset} ${offset} Z`;
}
function perimeterBackground(gradient: readonly GradientStop[]) {
  const stops = cloneGradient(gradient);
  if (!stops.length) return 'linear-gradient(0deg, #000000, #000000)';
  const first = formatHex(stops[0].color);
  if (stops.length === 1) return `linear-gradient(0deg, ${first}, ${first})`;
  const last = formatHex(stops[stops.length - 1].color);
  return `conic-gradient(from -70deg, ${stops
    .map(({ color, position }) => `${formatHex(color)} ${0.98 * position}%`)
    .join(', ')}, ${last} 99%, ${first} 100%)`;
}
/** Lighting perimeter measures the mounted keyboard once, as in the recovered view. */
export const KeyboardPerimeter = observer(function KeyboardPerimeter({
  gradient,
}: {
  gradient: readonly GradientStop[];
}) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) {
      const { offsetWidth: width, offsetHeight: height } = containerRef.current;
      setDimensions({ width, height });
    }
  }, []);
  const { width, height } = dimensions;
  return (
    <div
      ref={containerRef}
      css={{ label: 'KeyboardPerimeter-container', position: 'absolute', inset: -18 }}
      data-code="perimeter"
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <clipPath id="clip1" clipRule="evenodd">
            <path d={perimeterPath(width, height)} />
          </clipPath>
        </defs>
        <foreignObject clipPath="url(#clip1)" x="0" y="0" width={width} height={height}>
          <div style={{ width, height, background: perimeterBackground(gradient) }} />
        </foreignObject>
      </svg>
    </div>
  );
});
