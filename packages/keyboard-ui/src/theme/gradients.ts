import * as colorUtils from './color.js';
import type { GradientStop } from './color.js';
import type { Rgb } from '../../../backend/src/contracts.cjs';
import * as uuid from 'uuid';
import { rainbowColors } from './colors.js';
import { convertHexToLedRgb } from './ledColor.js';
export interface LedColorStop {
  ledRgb: Rgb;
  value: number;
}

const areGradientsEqual = (
  firstGradient: readonly GradientStop[],
  secondGradient: readonly GradientStop[],
) => {
  if (firstGradient.length !== secondGradient.length) return false;
  const sortedFirst = sortGradient([...firstGradient]),
    sortedSecond = sortGradient([...secondGradient]);
  for (let i = 0; i < sortedFirst.length; i++) {
    const firstItem = sortedFirst[i],
      secondItem = sortedSecond[i];
    if (!firstItem || !secondItem) return false;
    if (firstItem.position !== secondItem.position || firstItem.color !== secondItem.color)
      return false;
  }
  return true;
};
const sortGradient = (gradient: GradientStop[]) => gradient.sort((a, b) => a.position - b.position);
const convertGradientToCSS = (gradient: GradientStop[], degrees = 45) => {
  if ((sortGradient(gradient), gradient.length < 1))
    throw new Error('Gradient must have at least one color');
  if (gradient.length >= 1 && 1 === gradient.length)
    return (0, colorUtils.formatHex)(gradient[0].color);
  let cssString = `linear-gradient(${degrees}deg`;
  return (
    gradient.forEach((colorStop) => {
      cssString += `, ${(0, colorUtils.formatHex)(colorStop.color)} ${colorStop.position}%`;
    }),
    (cssString += ')'),
    cssString
  );
};
const cloneGradient = (gradient: readonly GradientStop[]) =>
  gradient
    .map((a) => ({
      ...a,
    }))
    .sort((a, b) => a.position - b.position);
const distributeGradientEvenly = (gradient: GradientStop[], smooth: boolean) => {
  if (gradient.length >= 2) {
    const increment = Math.floor(100 / (smooth ? gradient.length : gradient.length - 1));
    let start = 0;
    for (const item of gradient) ((item.position = start), (start += increment));
  }
};
const smoothGradientRepeat = (gradient: GradientStop[], isCoreToSW = false) => {
  if (gradient.length >= 2) {
    if (isCoreToSW) {
      const lastStop = gradient[gradient.length - 1];
      if (!lastStop) return gradient;
      const firstPos = 100 - lastStop.position,
        adjPos = gradient[1].position - gradient[0].position,
        [firstElem, ...rest] = gradient;
      return [
        {
          ...firstElem,
          position: firstPos,
        },
        ...rest.slice(0, rest.length - 1).map((elem) => ({
          ...elem,
          position: elem.position + adjPos,
        })),
      ];
    }
    {
      const adjPos = 0.5 * (gradient[1].position - gradient[0].position) + gradient[0].position,
        lastColorStop = {
          ...gradient[0],
          id: (0, uuid.v4)(),
          position: 100 - gradient[0].position,
        };
      return [
        ...gradient.map((elem) => ({
          ...elem,
          position: Math.max(0, elem.position - adjPos),
        })),
        lastColorStop,
      ];
    }
  }
  return gradient;
};
const smoothGradientRepeatReverse = (gradient: GradientStop[], isCoreToSW = false) =>
  gradient.length >= 2
    ? isCoreToSW
      ? gradient.slice(0, 0.5 * gradient.length + 1).map((elem) => ({
          ...elem,
          position: 2 * elem.position,
        }))
      : [
          ...gradient.map((g) => ({
            ...g,
            position: 0.5 * g.position,
          })),
          ...gradient
            .map((g) => ({
              ...g,
              position: 100 - 0.5 * g.position,
              id: (0, uuid.v4)(),
            }))
            .reverse(),
        ]
    : gradient;
const gradientToLedRgb = (gradient: readonly GradientStop[]) =>
  gradient.map((colorStop) => ({
    ledRgb: convertHexToLedRgb(colorStop.color, 1),
    value: colorStop.position,
  }));
const coreRepeatToSWPreRepeat = (distanceGradient: readonly LedColorStop[]) => {
  const iGradientArr = distanceGradientToGradient(distanceGradient),
    isCoreToSW = true;
  let cannotBeReverseRepeat = !iGradientArr.length || !!(iGradientArr.length % 2);
  if (cannotBeReverseRepeat) return smoothGradientRepeat(iGradientArr, isCoreToSW);
  for (let i = 0; i < 0.5 * iGradientArr.length; i++) {
    const begElem = iGradientArr[i],
      endingElem = iGradientArr[iGradientArr.length - 1 - i];
    if (
      begElem &&
      endingElem &&
      ((cannotBeReverseRepeat =
        begElem.color !== endingElem.color && begElem.position !== 100 - endingElem.position),
      cannotBeReverseRepeat)
    )
      return smoothGradientRepeat(iGradientArr, isCoreToSW);
  }
  return smoothGradientRepeatReverse(iGradientArr, isCoreToSW);
};
const gradientToDistanceGradient = (
  gradient: readonly GradientStop[],
  maxDiscreteColors: number,
  maxDistancePerStop = 10,
  maxStops = 10,
) => {
  const rgbGradient = gradientToLedRgb(gradient);
  if (rgbGradient.length > maxDiscreteColors)
    return rgbGradient
      .map((colorStop) => ({
        ledRgb: colorStop.ledRgb,
        value: 0,
      }))
      .slice(0, maxDiscreteColors);
  rgbGradient[0] &&
    0 !== rgbGradient[0].value &&
    rgbGradient.length + 1 <= Math.min(maxDiscreteColors, maxStops) &&
    rgbGradient.unshift({
      ledRgb: rgbGradient[0].ledRgb,
      value: 0,
    });
  const lastColorStop = rgbGradient[rgbGradient.length - 1];
  lastColorStop &&
    100 !== lastColorStop.value &&
    rgbGradient.length + 1 <= Math.min(maxDiscreteColors, maxStops) &&
    rgbGradient.push({
      ledRgb: lastColorStop.ledRgb,
      value: 100,
    });
  const remainingPossibleSteps = maxDiscreteColors - rgbGradient.length;
  let distanceGradient: LedColorStop[] = [];
  for (let i = 0; i < rgbGradient.length; i++) {
    var _rgbGradient;
    const colorStop = rgbGradient[i],
      nextColorStop =
        null !== (_rgbGradient = rgbGradient[i + 1]) && void 0 !== _rgbGradient
          ? _rgbGradient
          : null;
    if (colorStop) {
      const difference = nextColorStop ? nextColorStop.value - colorStop.value : 0;
      distanceGradient.push({
        ledRgb: colorStop.ledRgb,
        value: Math.floor((difference / 100) * remainingPossibleSteps),
      });
    } else console.error(`Skipping invalid colorStop at index ${i}`);
  }
  const biggestDistance = Math.max(...distanceGradient.map((colorStop) => colorStop.value));
  if (biggestDistance > maxDistancePerStop) {
    const downscalePercentage = maxDistancePerStop / biggestDistance;
    distanceGradient = distanceGradient.map((colorStop) => ({
      ledRgb: colorStop.ledRgb,
      value: Math.round(colorStop.value * downscalePercentage),
    }));
  }
  return distanceGradient;
};
const distanceGradientToGradient = (distanceGradient: readonly LedColorStop[]) => {
  const resultGradient: GradientStop[] = [],
    totalDistance =
      distanceGradient.reduce((result, colorStop) => result + colorStop.value, 0) +
      distanceGradient.length -
      1;
  let position = 0;
  for (let i = 0; i < distanceGradient.length; i++) {
    const colorStop = distanceGradient[i];
    if (!colorStop) continue;
    const hex = (0, colorUtils.rgb)(
        colorStop.ledRgb.r,
        colorStop.ledRgb.g,
        colorStop.ledRgb.b,
      ).toHex(),
      percentage = Math.floor((position / totalDistance) * 100);
    (resultGradient.push({
      color: hex,
      id: (0, uuid.v4)(),
      position: percentage,
    }),
      (position += colorStop.value + 1));
  }
  return resultGradient;
};
const gradientToKeyboardCoveringMarquee = (
  gradient: readonly GradientStop[],
  isSmooth: boolean,
) => {
  const newGradient = gradientToLedRgb(gradient);
  isSmooth &&
    newGradient[0] &&
    newGradient.push({
      ...newGradient[0],
    });
  const distance = isSmooth ? Math.floor((22 - newGradient.length) / newGradient.length) : 0;
  for (let i = 0; i < newGradient.length; i++) {
    const colorStop = newGradient[i];
    colorStop && (colorStop.value = distance);
  }
  const lastColorStop = newGradient[newGradient.length - 1];
  return (isSmooth && lastColorStop && (lastColorStop.value = 0), newGradient);
};
const calculateRGBKeyStops = (
  colorStop0: LedColorStop,
  colorStop1: LedColorStop,
  index: number,
  numOfKeyStops: number,
) => {
  const d = index / numOfKeyStops;
  return {
    r: Math.ceil((colorStop1.ledRgb.r - colorStop0.ledRgb.r) * d) + colorStop0.ledRgb.r,
    g: Math.ceil((colorStop1.ledRgb.g - colorStop0.ledRgb.g) * d) + colorStop0.ledRgb.g,
    b: Math.ceil((colorStop1.ledRgb.b - colorStop0.ledRgb.b) * d) + colorStop0.ledRgb.b,
  };
};
const colorsToKeysGradient = (colors: readonly string[], maxNumOfKeys: number) => {
  const keysGradient: string[] = [];
  if (1 === maxNumOfKeys) {
    var _colors$, _colors;
    return [
      null !== (_colors$ = colors[0]) && void 0 !== _colors$ ? _colors$ : '#000000',
      null !== (_colors = colors[colors.length - 1]) && void 0 !== _colors ? _colors : '#000000',
    ];
  }
  const numColors = colors.length;
  if (0 === numColors) return [];
  const step = (numColors - 1) / (maxNumOfKeys - 1);
  for (let i = 0; i < maxNumOfKeys; i++) {
    var _colors$lowerIndex, _colors$upperIndex;
    const index = i * step,
      lowerIndex = Math.floor(index),
      upperIndex = Math.ceil(index),
      lowerColorHex =
        null !== (_colors$lowerIndex = colors[lowerIndex]) && void 0 !== _colors$lowerIndex
          ? _colors$lowerIndex
          : '#000000',
      upperColorHex =
        null !== (_colors$upperIndex = colors[upperIndex]) && void 0 !== _colors$upperIndex
          ? _colors$upperIndex
          : '#000000';
    if (lowerIndex === upperIndex) keysGradient.push(lowerColorHex);
    else {
      const ratio = index - lowerIndex,
        lowerColor = (0, colorUtils.rgbFromHex)(lowerColorHex),
        upperColor = (0, colorUtils.rgbFromHex)(upperColorHex),
        r = lowerColor.r + (upperColor.r - lowerColor.r) * ratio,
        g = lowerColor.g + (upperColor.g - lowerColor.g) * ratio,
        b = lowerColor.b + (upperColor.b - lowerColor.b) * ratio;
      keysGradient.push((0, colorUtils.formatHex)((0, colorUtils.rgb)(r, g, b).toHex()));
    }
  }
  return keysGradient;
};
const gradientToKeysGradient = (
  gradient: readonly GradientStop[],
  maxNumOfKeys: number,
  direction: string | undefined,
) => {
  const rgbGradient = gradientToLedRgb(gradient);
  let keysGradient: string[] = [];
  const reverse = 'Left' === direction || 'Up' === direction || 'RadialReverse' === direction,
    isRadial = 'Radial' === direction || 'RadialReverse' === direction,
    numOfGradients = rgbGradient.length - 1;
  if (1 === maxNumOfKeys) {
    const first = rgbGradient[0],
      last = rgbGradient[rgbGradient.length - 1];
    if (first && last) {
      const { r: r1, g: g1, b: b1 } = first.ledRgb,
        { r: r2, g: g2, b: b2 } = last.ledRgb;
      return [
        (0, colorUtils.formatHex)((0, colorUtils.rgb)(r1, g1, b1).toHex()),
        (0, colorUtils.formatHex)((0, colorUtils.rgb)(r2, g2, b2).toHex()),
      ];
    }
  }
  for (let x = 0; x < numOfGradients; x++) {
    const colorStop0 = rgbGradient[x],
      colorStop1 = rgbGradient[x + 1];
    if (colorStop0 && colorStop1)
      if (isRadial) {
        let numOfKeyStops = Math.ceil(
          ((colorStop1.value - colorStop0.value) / 100) * Math.ceil(maxNumOfKeys / numOfGradients),
        );
        1 === numOfGradients && (numOfKeyStops /= 2);
        for (let i__s1266v0 = 0; i__s1266v0 <= numOfKeyStops; i__s1266v0++) {
          const {
            r: r__s1267v0,
            g: g,
            b: b,
          } = calculateRGBKeyStops(colorStop0, colorStop1, i__s1266v0, numOfKeyStops);
          keysGradient.push(
            (0, colorUtils.formatHex)((0, colorUtils.rgb)(r__s1267v0, g, b).toHex()),
          );
        }
      } else {
        const numOfKeyStops =
          Math.ceil(((colorStop1.value - colorStop0.value) / 100) * maxNumOfKeys - 0.5) || 1;
        for (let i__s1269v0 = 0; i__s1269v0 <= numOfKeyStops; i__s1269v0++) {
          const {
            r: r__s1270v0,
            g: g,
            b: b,
          } = calculateRGBKeyStops(colorStop0, colorStop1, i__s1269v0, numOfKeyStops);
          keysGradient.push(
            (0, colorUtils.formatHex)((0, colorUtils.rgb)(r__s1270v0, g, b).toHex()),
          );
        }
      }
  }
  for (
    isRadial
      ? reverse
        ? (keysGradient = keysGradient.concat(keysGradient.slice().reverse()))
        : keysGradient.unshift(...keysGradient.slice().reverse())
      : reverse && keysGradient.reverse();
    keysGradient.length <= maxNumOfKeys;
  ) {
    const lastColor = keysGradient[keysGradient.length - 1];
    // Empty output cannot be padded; continuing here would stall the renderer.
    if (!lastColor) break;
    keysGradient.push(lastColor);
  }
  return keysGradient;
};
const defaultMulticolor: GradientStop[] = [
  {
    color: '7800fc',
    position: 0,
    id: (0, uuid.v4)(),
  },
  {
    color: 'ff5000',
    position: 25,
    id: (0, uuid.v4)(),
  },
  {
    color: 'ff0da7',
    position: 50,
    id: (0, uuid.v4)(),
  },
  {
    color: 'ffd200',
    position: 75,
    id: (0, uuid.v4)(),
  },
  {
    color: '39fb00',
    position: 100,
    id: (0, uuid.v4)(),
  },
];
const defaultLEDRainbowGradient: GradientStop[] = [
  {
    color: rainbowColors[0].toHex(),
    position: 15,
    id: (0, uuid.v4)(),
  },
  {
    color: rainbowColors[1].toHex(),
    position: 25,
    id: (0, uuid.v4)(),
  },
  {
    color: rainbowColors[2].toHex(),
    position: 35,
    id: (0, uuid.v4)(),
  },
  {
    color: rainbowColors[3].toHex(),
    position: 45,
    id: (0, uuid.v4)(),
  },
  {
    color: rainbowColors[4].toHex(),
    position: 55,
    id: (0, uuid.v4)(),
  },
  {
    color: rainbowColors[5].toHex(),
    position: 65,
    id: (0, uuid.v4)(),
  },
  {
    color: rainbowColors[6].toHex(),
    position: 75,
    id: (0, uuid.v4)(),
  },
  {
    color: rainbowColors[7].toHex(),
    position: 85,
    id: (0, uuid.v4)(),
  },
];
const rainbowGradient: GradientStop[] = rainbowColors.map((color, _i) => ({
  id: color.toHex(),
  color: color.toHex(),
  position: Math.round((_i / (rainbowColors.length - 1)) * 100),
}));
const defaultTripleInfographicGradient: GradientStop[] = [
  {
    color: '00b4ff',
    position: 0,
    id: (0, uuid.v4)(),
  },
  {
    color: 'f100ff',
    position: 100,
    id: (0, uuid.v4)(),
  },
];
const defaultGradients: GradientStop[][] = [
  [
    {
      color: '9000ff',
      position: 0,
      id: (0, uuid.v4)(),
    },
    {
      color: 'ff9f00',
      position: 100,
      id: (0, uuid.v4)(),
    },
  ],
  [
    {
      color: '00ff00',
      position: 0,
      id: (0, uuid.v4)(),
    },
    {
      color: 'ffff00',
      position: 50,
      id: (0, uuid.v4)(),
    },
    {
      color: 'ff0000',
      position: 100,
      id: (0, uuid.v4)(),
    },
  ],
  [
    {
      color: 'f100ff',
      position: 0,
      id: (0, uuid.v4)(),
    },
    {
      color: 'ffae98',
      position: 100,
      id: (0, uuid.v4)(),
    },
  ],
  [
    {
      color: 'f12711',
      position: 0,
      id: (0, uuid.v4)(),
    },
    {
      color: 'fff800',
      position: 100,
      id: (0, uuid.v4)(),
    },
  ],
  [
    {
      color: '00b4ff',
      position: 0,
      id: (0, uuid.v4)(),
    },
    {
      color: '00ff1e',
      position: 100,
      id: (0, uuid.v4)(),
    },
  ],
  [
    {
      color: 'e3ff00',
      position: 0,
      id: (0, uuid.v4)(),
    },
    {
      color: '00ff00',
      position: 100,
      id: (0, uuid.v4)(),
    },
  ],
  [
    {
      color: '2400ff',
      position: 0,
      id: (0, uuid.v4)(),
    },
    {
      color: 'bb00ff',
      position: 25,
      id: (0, uuid.v4)(),
    },
    {
      color: 'ff0076',
      position: 50,
      id: (0, uuid.v4)(),
    },
    {
      color: 'bb00ff',
      position: 75,
      id: (0, uuid.v4)(),
    },
    {
      color: '2400ff',
      position: 100,
      id: (0, uuid.v4)(),
    },
  ],
  [
    {
      color: 'a500ff',
      position: 0,
      id: (0, uuid.v4)(),
    },
    {
      color: '0e00ff',
      position: 50,
      id: (0, uuid.v4)(),
    },
    {
      color: '00ff46',
      position: 100,
      id: (0, uuid.v4)(),
    },
  ],
  [
    {
      color: '00d4ff',
      position: 0,
      id: (0, uuid.v4)(),
    },
    {
      color: '00ff06',
      position: 50,
      id: (0, uuid.v4)(),
    },
    {
      color: 'ffac00',
      position: 100,
      id: (0, uuid.v4)(),
    },
  ],
  [...defaultTripleInfographicGradient],
  [
    {
      color: '19ff00',
      position: 0,
      id: (0, uuid.v4)(),
    },
    {
      color: 'ff0064',
      position: 100,
      id: (0, uuid.v4)(),
    },
  ],
  [
    {
      color: '00ffd3',
      position: 0,
      id: (0, uuid.v4)(),
    },
    {
      color: '0d00ff',
      position: 100,
      id: (0, uuid.v4)(),
    },
  ],
  [
    {
      color: 'ff0000',
      position: 0,
      id: (0, uuid.v4)(),
    },
    {
      color: '0000ff',
      position: 100,
      id: (0, uuid.v4)(),
    },
  ],
  [
    {
      color: '00ff3c',
      position: 0,
      id: (0, uuid.v4)(),
    },
    {
      color: '00ffff',
      position: 33,
      id: (0, uuid.v4)(),
    },
    {
      color: '0000ff',
      position: 66,
      id: (0, uuid.v4)(),
    },
    {
      color: '7800ff',
      position: 100,
      id: (0, uuid.v4)(),
    },
  ],
  defaultLEDRainbowGradient,
];
export {
  areGradientsEqual,
  sortGradient,
  convertGradientToCSS,
  cloneGradient,
  distributeGradientEvenly,
  smoothGradientRepeat,
  smoothGradientRepeatReverse,
  gradientToLedRgb,
  coreRepeatToSWPreRepeat,
  gradientToDistanceGradient,
  distanceGradientToGradient,
  gradientToKeyboardCoveringMarquee,
  calculateRGBKeyStops,
  colorsToKeysGradient,
  gradientToKeysGradient,
  defaultMulticolor,
  defaultLEDRainbowGradient,
  rainbowGradient,
  defaultTripleInfographicGradient,
  defaultGradients,
};
