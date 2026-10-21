import { v4 } from 'uuid';
import { getKeyCoordinate } from '../layouts/keyboardInfo.js';
import type { KeyboardLayoutDevice } from '../layouts/types.js';
import {
  colorsToKeysGradient,
  gradientToKeysGradient,
  rainbowGradient,
} from '../theme/gradients.js';
import type { GradientStop } from '../theme/color.js';
import type {
  KeyboardBaseZoneInstance,
  KeyboardReactiveZoneInstance,
  KeyboardPerimeterZoneInstance,
} from './KeyboardZone.js';

/** Preview colours use the same coordinates, direction and two-neighbour sampling as CAM. */
export function colorsByKey(
  zones: readonly (KeyboardBaseZoneInstance | KeyboardReactiveZoneInstance)[],
  device: KeyboardLayoutDevice,
) {
  const keyColors: Record<number, string[]> = {};
  for (const zone of zones) {
    const effect = zone.effectSettings,
      colorType = effect.colorType;
    const direction =
      effect.kind !== 'Off' && effect.kind !== 'Mixed' ? effect.direction : undefined;
    switch (colorType.kind) {
      case 'Color':
        zone.keys.forEach((code) => {
          keyColors[code] = [colorType.color];
        });
        break;
      case 'Colors': {
        const { distance, min } = zone.getMaxDistanceBetweenKeys(device);
        const gradient = colorsToKeysGradient(colorType.colors, distance);
        zone.keys.forEach((code) => {
          const coordinate = getKeyCoordinate(code, device);
          if (coordinate) {
            const position = coordinate.x - min;
            keyColors[code] = gradient.slice(
              Math.max(0, position - 1),
              Math.min(gradient.length, position + 1),
            );
          }
        });
        break;
      }
      case 'Gradient':
      case 'Rainbow': {
        const orientation = direction === 'Up' || direction === 'Down' ? 'y' : 'x';
        const { distance, min } = zone.getMaxDistanceBetweenKeys(device);
        const stops =
          colorType.kind === 'Gradient' && 'gradient' in colorType
            ? colorType.gradient
            : rainbowGradient;
        const gradient = gradientToKeysGradient(stops, distance, direction);
        zone.keys.forEach((code) => {
          const coordinate = getKeyCoordinate(code, device);
          if (coordinate) {
            const position = coordinate[orientation] - min;
            keyColors[code] = gradient.slice(
              Math.max(0, position - 1),
              Math.min(gradient.length, position + 1),
            );
          }
        });
        break;
      }
    }
  }
  return keyColors;
}

/** Flatten perimeter colours into editor stops; retain the existing stop positions and UUIDs. */
export function perimeterGradient(zones: readonly KeyboardPerimeterZoneInstance[]): GradientStop[] {
  const gradient: GradientStop[] = [];
  for (const zone of zones) {
    const colorType = zone.effectSettings.colorType;
    switch (colorType.kind) {
      case 'Color':
        gradient.push({ id: v4(), position: 0, color: colorType.color });
        break;
      case 'Colors':
        colorType.colors.forEach((color, index) => {
          if (color)
            gradient.push({
              id: v4(),
              position: (index / (colorType.colors.length - 1)) * 100,
              color,
            });
        });
        break;
      case 'Gradient':
        gradient.push(...colorType.gradient);
        break;
      case 'Rainbow':
        gradient.push(...rainbowGradient);
        break;
    }
  }
  return gradient;
}
