import { rgb, rgba, type Color } from './color.js';
const baseColors = {
  black: rgb(0, 0, 0),
  white: rgb(255, 255, 255),
  green: rgb(33, 211, 115),
  secondaryGreen: rgb(171, 227, 200),
  yellow: rgb(248, 212, 28),
  secondaryYellow: rgb(235, 228, 173),
  yellowGreen: rgb(196, 227, 53),
  hotPink: rgb(255, 30, 147),
  teal: rgb(47, 226, 239),
  tealGreen: rgb(5, 161, 147),
  orange: rgb(250, 165, 11),
  red: rgb(208, 2, 27),
  secondaryRed: rgb(223, 165, 173),
  darkGrey: rgb(64, 64, 64),
  grey: rgb(232, 235, 237),
  lightGrey: rgb(159, 169, 178),
  blue: rgb(0, 118, 255),
  purple: rgb(81, 0, 122),
  lightPurple: rgb(191, 76, 191),
  darkPurple: rgb(40, 0, 60),
  darkOrchid: rgb(100, 10, 146),
  orchid: rgb(191, 76, 191),
  magenta: rgb(229, 37, 207),
  transparent: rgba(0, 0, 0, 0),
  purpleGray: rgb(94, 92, 110),
  secondaryPurpleGray: rgb(126, 124, 139),
  betaPurple: rgb(116, 30, 201),
  betaHover: rgba(0, 0, 0, 0.1),
  betaActive: rgba(0, 0, 0, 0.3),
  betaSeparator: rgb(102, 21, 183),
  betaHandle: rgb(142, 55, 252),
  opaqueWhite: rgba(255, 255, 255, 0.2),
  redAlert: rgb(255, 2, 45),
  scrollBarGrey: rgb(216, 216, 216),
  scrollBarBorderGrey: rgb(151, 151, 151),
};
const lightGreys = {
  grey50: rgb(245, 245, 248),
  grey100: rgb(235, 235, 240),
  grey200: rgb(219, 219, 226),
  grey300: rgb(206, 206, 214),
  grey400: rgb(179, 179, 188),
  grey500: rgb(145, 145, 155),
  grey600: rgb(115, 114, 121),
  grey700: rgb(90, 90, 96),
  grey800: rgb(49, 50, 52),
  grey900: rgb(28, 29, 30),
};
const darkGreys = {
  background: rgb(19, 19, 22),
  darkest: rgb(21, 20, 25),
  darkerPurple: rgb(27, 27, 33),
  darker: rgb(52, 48, 62),
  dark: rgb(75, 67, 87),
  medium: rgb(143, 135, 157),
  neutral: rgb(183, 177, 194),
  cool: baseColors.lightGrey,
  light: rgb(229, 224, 239),
  grey50: rgb(221, 220, 231),
  grey100: rgb(193, 193, 208),
  grey200: rgb(159, 159, 176),
  grey500: rgb(73, 72, 81),
  grey600: rgb(48, 44, 57),
  grey700: rgb(34, 33, 39),
  grey800: rgb(27, 27, 33),
  grey900: rgb(18, 18, 20),
};
const purpleShades = { 200: rgb(190, 159, 255), 400: rgb(116, 22, 230), 500: rgb(95, 11, 202) };
const legacyColors = {
  textLight: baseColors.lightGrey,
  text: rgb(95, 112, 127),
  textDark: rgb(68, 66, 89),
  window: baseColors.purple,
  border: rgb(94, 92, 110),
  borderLight: rgb(219, 219, 219),
  header: rgb(94, 92, 110),
  content: rgb(166, 173, 181),
  link: rgb(191, 76, 191),
  overlay: rgba(0, 0, 0, 0.75),
  active: rgb(213, 54, 213),
  darkBackground: rgb(13, 26, 37),
  primary: baseColors.purple,
  success: baseColors.green,
  error: baseColors.red,
  disabled: rgb(219, 219, 219),
  disabledLightGrey: rgb(195, 194, 200),
  darkmodeDisabledDarkGrey: rgb(34, 36, 42),
  selectionBackground: rgba(171, 120, 255, 0.11),
  selectionBorder: rgba(171, 120, 255, 0.81),
};
const colorScales = {
  stoplights: [baseColors.purpleGray],
  secondaryStoplights: [baseColors.secondaryPurpleGray],
  greyLight: [legacyColors.textDark],
  secondaryGreyLight: [legacyColors.text],
  greyDark: [darkGreys.medium],
  secondaryGreyDark: [darkGreys.dark],
  black: [baseColors.black],
  purple: [baseColors.purple],
  secondaryPurple: [baseColors.darkPurple],
  orchid: [baseColors.orchid],
  secondaryOrchid: [baseColors.darkPurple],
};
const chartThemes = {
  defaultLight: [colorScales.stoplights, colorScales.secondaryStoplights, baseColors.grey],
  primaryLight: [colorScales.greyLight, colorScales.secondaryGreyLight, baseColors.grey],
  neutralLight: [colorScales.greyLight, colorScales.secondaryGreyLight, baseColors.grey],
  defaultDark: [colorScales.greyDark, colorScales.secondaryGreyDark, darkGreys.darkest],
  primaryDark: [colorScales.greyDark, colorScales.secondaryGreyDark, darkGreys.darkest],
  neutralDark: [colorScales.greyDark, colorScales.secondaryGreyDark, darkGreys.darkest],
};
const stateColorScales = {
  green: [baseColors.green, baseColors.grey],
  yellow: [baseColors.yellow, baseColors.grey],
  red: [baseColors.red, baseColors.grey],
  greenGraded: [baseColors.green, rgb(171, 227, 200), baseColors.grey],
  yellowGraded: [baseColors.yellow, rgb(235, 228, 173), baseColors.grey],
  redGraded: [baseColors.red, rgb(223, 165, 173), baseColors.grey],
  grey: [darkGreys.medium, darkGreys.medium, darkGreys.darkest],
};
const effectColors = [
  rgb(255, 0, 0),
  rgb(255, 80, 0),
  rgb(255, 150, 0),
  rgb(255, 229, 0),
  rgb(200, 255, 0),
  rgb(40, 255, 0),
  rgb(62, 159, 45),
  rgb(0, 255, 180),
  rgb(0, 0, 255),
  rgb(169, 0, 255),
  rgb(255, 100, 255),
  rgb(255, 0, 80),
  baseColors.white,
  baseColors.black,
  rgb(106, 103, 103),
];
const presetColors = [
  baseColors.white,
  baseColors.black,
  rgb(106, 103, 103),
  rgb(255, 0, 0),
  rgb(255, 80, 0),
  rgb(255, 150, 0),
  rgb(255, 229, 0),
  rgb(200, 255, 0),
  rgb(40, 255, 0),
  rgb(62, 159, 45),
  rgb(0, 255, 180),
  rgb(0, 0, 255),
  rgb(169, 0, 255),
  rgb(255, 0, 80),
];
const rainbowColors = [
  baseColors.red,
  baseColors.orange,
  baseColors.yellow,
  baseColors.yellowGreen,
  baseColors.green,
  baseColors.teal,
  baseColors.blue,
  baseColors.purple,
  baseColors.orchid,
  baseColors.hotPink,
];
const statusColors = {
  green: rgb(3, 153, 77),
  orange: rgb(255, 149, 26),
  red: rgb(245, 57, 31),
};
const mutedColor = rgb(64, 64, 64);
const strokeColors = {
  light: { stroke: rgb(145, 145, 155) },
  dark: { stroke: rgb(179, 179, 188) },
};
const colors = { ...baseColors, ...legacyColors };
function fillRightWithLast<Value>(values: Value[], count: number): Value[] {
  const last = values[values.length - 1];
  if (last === undefined) throw new Error('Array must have at least one element');
  const result = values.concat(Array(Math.max(0, count - values.length)).fill(last));
  if (!(result.length >= count))
    throw new Error('Resulting array must have at least ' + count + ' elements');
  return result;
}
export function calculateScalesFromValue({
  value = 0,
  thresholds = [0.85, 0.95],
  colors = colorScales.greyLight,
}: {
  value?: number;
  thresholds?: readonly number[];
  colors?: Color[];
}) {
  const stops = fillRightWithLast(colors, 3);
  return typeof thresholds[1] === 'number' && value >= thresholds[1]
    ? stops[2]
    : typeof thresholds[0] === 'number' && value >= thresholds[0]
      ? stops[1]
      : stops[0];
}
export {
  lightGreys,
  darkGreys,
  purpleShades,
  colorScales,
  chartThemes,
  stateColorScales,
  effectColors,
  presetColors,
  rainbowColors,
  statusColors,
  mutedColor,
  strokeColors,
  colors,
};
