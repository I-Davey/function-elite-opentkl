import type { GradientStop } from '../theme/color.js';
import { sortGradient } from '../theme/gradients.js';

/** Preserve the recovered one-stop movement and collision offset before the caller commits. */
export function updateGradientPositions(gradient: GradientStop[], values: readonly number[]) {
  sortGradient(gradient);
  const direction =
    gradient.reduce((sum, stop) => sum + stop.position, 0) >
    values.reduce((sum, value) => sum + value, 0)
      ? 'left'
      : 'right';
  const changed = gradient.findIndex((stop) => !values.includes(stop.position));
  if (changed === -1) return;
  let next: number | undefined;
  for (let index = 0; index < gradient.length; index++) {
    if (gradient[index] && gradient[index].position !== values[index]) {
      next = values[index];
      break;
    }
  }
  if (next === undefined) return;
  if (gradient.some((stop) => stop.position === next)) next += direction === 'left' ? -1 : 1;
  if (changed >= 0 && changed < gradient.length) gradient[changed].position = next;
}
