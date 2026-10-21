import type { KeyboardTheme } from '../theme/types.js';
import type { KeyLabel } from '../layouts/keyLabels.js';
import { KEY_FONT_SIZE, KEY_SECONDARY_FONT_SIZE } from '../layouts/keyFontSizes.js';
import { Fragment } from 'react';
import { KeyboardKeyCodes } from '../layouts/keyboardKeys.js';
import { colors } from '../theme/colors.js';
import { KeyCodeLookup } from '../layouts/hidKeys.js';
import { KeyRepresentation } from '../layouts/KeyRepresentation.js';
export interface KeyboardKeyProps {
  code?: number;
  size: { width: number; height: number };
  padding: number;
  tooltipOpen?: boolean;
  keyInfo: KeyLabel;
  theme: KeyboardTheme;
  borderColor?: string;
}
export const NUMPAD_KEYS = new Set<number>([
  KeyboardKeyCodes.K0OrInsert,
  KeyboardKeyCodes.K1OrEnd,
  KeyboardKeyCodes.K2OrDownArrow,
  KeyboardKeyCodes.K3OrPageDn,
  KeyboardKeyCodes.K4OrLeftArrow,
  KeyboardKeyCodes.K5,
  KeyboardKeyCodes.K6OrRightArrow,
  KeyboardKeyCodes.K7OrHome,
  KeyboardKeyCodes.K8OrUpArrow,
  KeyboardKeyCodes.K9OrPageUp,
  KeyboardKeyCodes.NumLockOrClear,
  KeyboardKeyCodes.KeypadAndAnd,
  KeyboardKeyCodes.KeypadSub,
  KeyboardKeyCodes.KeypadMultiply,
  KeyboardKeyCodes.KeypadDivide,
  KeyboardKeyCodes.KeypadEnter,
  KeyboardKeyCodes.KeypadDecimal,
]);

/** SVG keycap shared by keyboard previews and remapping targets. */
export function KeyboardKey(props: KeyboardKeyProps) {
  const {
      code,
      size: { width, height },
      padding,
      tooltipOpen,
      keyInfo: { fontSize, label, label2, fnLabel, fnLabel2, fnLabel3 },
      theme,
      borderColor,
    } = props,
    adjustedWidth = width - 4,
    adjustedHeight = height - 4;
  return code && NUMPAD_KEYS.has(code) ? (
    <svg viewBox={`0 0 ${width} ${height}`} height={height} width={width}>
      <g transform="translate(2, 2)" height={height - 2} width={width - 2} fill="none">
        <rect x="0" y="0" stroke="none" height={height - 4} width={width - 4} rx={3} />
        <g>
          <rect
            height={height - 4}
            width={width - 4}
            x="0"
            y="0"
            fill={label ? `${theme.keyboard.keyCapWall}` : 'none'}
            rx={3}
          />
        </g>
        <g transform={`translate(${padding}, 2)`}>
          <rect
            width={Math.max(width - 3 * padding, 0)}
            height={height - 3 * padding - 2}
            x="0"
            y={padding / 2}
            stroke={tooltipOpen ? `${colors.white}` : 'none'}
            strokeWidth="2px"
            fill={label ? `${theme.keyboard.keyCapSurface}` : 'none'}
            rx={3}
          />
        </g>
        {!fnLabel2 && (
          <Fragment>
            <text
              x="45%"
              y="50%"
              textAnchor="middle"
              alignmentBaseline="middle"
              fontSize={fontSize || KEY_FONT_SIZE}
            >
              <tspan
                x={label === KeyCodeLookup[KeyboardKeyCodes.Spacebar] ? '50%' : '45%'}
                y={label2 ? '40%' : fnLabel ? '62%' : '60%'}
              >
                {label}
              </tspan>
              <tspan x="45%" y="60%">
                {label2}
              </tspan>
            </text>
            <text x={width - 12} y={14} textAnchor="end" fontSize={KEY_SECONDARY_FONT_SIZE}>
              {fnLabel}
            </text>
          </Fragment>
        )}
        {fnLabel2 && (
          <Fragment>
            <text
              x="20%"
              y="50%"
              textAnchor="middle"
              alignmentBaseline="middle"
              fontSize={fontSize || KEY_FONT_SIZE}
            >
              <tspan x="30%" y="50%">
                {label}
              </tspan>
            </text>
            <text x={width - 14} y={14} textAnchor="end" fontSize={KEY_SECONDARY_FONT_SIZE}>
              {fnLabel}
            </text>
            <text
              x={width - 14}
              y={height - 18}
              textAnchor="end"
              fontSize={KEY_SECONDARY_FONT_SIZE}
            >
              {fnLabel2}
            </text>
          </Fragment>
        )}
      </g>
    </svg>
  ) : (
    <svg viewBox={`0 0 ${width} ${height}`} height={height} width={width}>
      <g transform="translate(2, 2)" fill="none">
        <rect x="0" y="0" height={adjustedHeight} width={adjustedWidth} rx={3} />
        <rect
          height={adjustedHeight}
          width={adjustedWidth}
          x="0"
          y="0"
          stroke={
            code ? (null != borderColor ? borderColor : `${theme.keyboard.keyCapWall}`) : 'none'
          }
          fill={label ? `${theme.keyboard.keyCapWall}` : 'none'}
          rx={3}
        />
        <g transform={`translate(${padding}, 2)`}>
          <rect
            width={Math.max(width - 3 * padding, 0)}
            height={height - 3 * padding - 2}
            x="0"
            y={padding / 2}
            stroke={tooltipOpen ? `${colors.white}` : 'none'}
            strokeWidth="2px"
            fill={label ? `${theme.keyboard.keyCapSurface}` : 'none'}
            rx={3}
          />
        </g>
        {code === KeyboardKeyCodes.Copilot ? (
          <svg viewBox="0 0 50 50" width={adjustedWidth} height={adjustedHeight}>
            <g transform="translate(15, 15) scale(0.4)">
              <path d="M25.7954 9.22143C24.8356 9.22143 24.1261 9.34438 23.7088 9.5493C24.6686 6.76243 25.4198 2.21327 29.6765 2.21327C33.9332 2.21327 33.5159 7.04931 35.3104 9.22143H25.7954ZM29.5931 13.1558C28.3411 17.5411 27.0891 21.9263 25.6702 26.2705C25.2529 27.541 24.0427 28.4017 22.6655 28.4017H17.8245C18.1584 27.9099 18.4088 27.3771 18.5757 26.8033C19.8277 22.4181 21.0797 18.0329 22.4986 13.6886C22.9159 12.4181 24.1261 11.5575 25.5033 11.5575H30.3443C30.0104 12.0493 29.76 12.5821 29.5931 13.1558ZM18.3671 37.7869C14.2773 37.7869 14.5277 32.9508 12.7332 30.7787H22.2482C23.208 30.7787 23.9175 30.6558 24.3348 30.4509C23.3749 33.2377 22.6238 37.7869 18.3671 37.7869ZM45.9939 11.2706C44.8254 9.91815 43.0726 9.26242 40.7774 9.26242H39.4837C38.2734 9.18045 37.1466 8.36078 36.771 7.21325L35.4773 3.6067C34.7262 1.43458 32.6395 0.000159454 30.3025 0.000159454H13.4426C7.2245 -0.040824 4.51189 7.828 3.05125 12.5821C1.67409 17.0083 -1.41411 24.5083 2.17487 28.7296C3.84417 30.6558 6.30638 30.7377 8.68513 30.7377C9.89537 30.8197 11.0221 31.6394 11.3977 32.7869L12.6914 36.3935C13.4426 38.5656 15.5292 40 17.8663 40H34.7679C41.0278 40 43.6986 32.1312 45.1593 27.3771C46.2443 23.8525 47.5797 19.5083 47.4963 16.0247C47.4963 14.2624 47.079 12.5411 45.9522 11.2296" />
            </g>
          </svg>
        ) : (
          <Fragment>
            <text
              x="45%"
              y="50%"
              textAnchor="middle"
              alignmentBaseline="middle"
              fontSize={fontSize || (fnLabel ? KEY_SECONDARY_FONT_SIZE : KEY_FONT_SIZE)}
            >
              <tspan
                x={label === KeyRepresentation.SPACE ? '50%' : fnLabel ? '25%' : '45%'}
                y={label2 ? '40%' : fnLabel ? '30%' : '50%'}
              >
                {label}
              </tspan>
              <tspan x="45%" y="60%">
                {label2}
              </tspan>
            </text>
            <text textAnchor="middle" fontSize={KEY_SECONDARY_FONT_SIZE}>
              <tspan x="65%" y="30%">
                {fnLabel}
              </tspan>
            </text>
            {fnLabel2 && (
              <text textAnchor="middle" fontSize={KEY_SECONDARY_FONT_SIZE}>
                <tspan x="65%" y="65%">
                  {fnLabel2}
                </tspan>
              </text>
            )}
            {fnLabel3 && (
              <text textAnchor="middle" fontSize={KEY_SECONDARY_FONT_SIZE}>
                <tspan x="25%" y="65%">
                  {fnLabel3}
                </tspan>
              </text>
            )}
          </Fragment>
        )}
      </g>
    </svg>
  );
}
