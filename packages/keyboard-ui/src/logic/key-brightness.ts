import type { Rgb, Zone } from '../../../backend/src/contracts.cjs';

/** RGB palette scaling changes selected keys without changing firmware master brightness. */
export function inspect(zones: readonly Zone[], selected: readonly number[]): number {
  const keys = new Set(selected);
  const maxima: number[] = [];
  let covered = 0;
  for (const zone of zones) {
    const affected = (zone.keys ?? []).filter((key) => keys.has(key));
    if (!affected.length) continue;
    covered += affected.length;
    const values: number[] = [];
    visitColors(clone(zone.effectSettings), (rgb) => values.push(rgb.r, rgb.g, rgb.b));
    if (!values.length)
      throw Error('Per-key brightness needs a solid color or custom color palette.');
    maxima.push(Math.max(...values));
  }
  if (!covered) throw Error('Select keys with a lighting color first.');
  return Math.max(...maxima) / 255;
}

/** Split affected keys into independent zones, preserving the remaining palettes. */
export function adjust(
  zones: readonly Zone[],
  selected: readonly number[],
  level: number,
  maximum = 10,
): Zone[] {
  if (!Number.isFinite(level) || level < 0 || level > 1) throw Error('Invalid brightness.');
  if (!Number.isInteger(maximum) || maximum < 1) throw Error('Invalid lighting group limit.');
  inspect(zones, selected);
  const keys = new Set(selected);
  const result: Zone[] = [];
  for (const source of zones) {
    const sourceKeys = source.keys ?? [];
    const affected = sourceKeys.filter((key) => keys.has(key));
    if (!affected.length) {
      result.push(clone(source));
      continue;
    }
    const untouched = sourceKeys.filter((key) => !keys.has(key));
    if (untouched.length) result.push({ ...clone(source), keys: untouched });
    const effect = clone(source.effectSettings);
    const values: number[] = [];
    visitColors(effect, (rgb) => values.push(rgb.r, rgb.g, rgb.b));
    const peak = Math.max(...values);
    if (!peak && level > 0) throw Error('Choose a color before brightening a black key.');
    visitColors(effect, (rgb) => {
      for (const channel of ['r', 'g', 'b'] as const)
        rgb[channel] = Math.min(255, Math.round(peak ? (rgb[channel] / peak) * level * 255 : 0));
    });
    result.push({
      ...clone(source),
      id: `${source.id ?? 'zone'}-dim-${affected.join('-')}`,
      keys: affected,
      effectSettings: effect,
    });
  }
  const merged: Zone[] = [];
  for (const zone of result) {
    const same = merged.find(
      (other) => JSON.stringify(other.effectSettings) === JSON.stringify(zone.effectSettings),
    );
    if (same) same.keys = [...(same.keys ?? []), ...(zone.keys ?? [])];
    else merged.push(zone);
  }
  if (merged.length > maximum)
    throw Error('Too many lighting groups. Use the same brightness for more keys.');
  return merged;
}

/** Lighting snapshots are JSON data; this also accepts MobX snapshot wrappers. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Walk both object RGB values and the hex color fields used by gradient stops. */
function visitColors(value: unknown, visit: (rgb: Rgb) => void): void {
  if (!isRecord(value)) return;
  if (isRgb(value)) {
    visit(value);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'color' && typeof child === 'string' && /^#[0-9a-f]{6}$/i.test(child)) {
      const rgb = {
        r: parseInt(child.slice(1, 3), 16),
        g: parseInt(child.slice(3, 5), 16),
        b: parseInt(child.slice(5, 7), 16),
      };
      visit(rgb);
      value[key] =
        '#' +
        [rgb.r, rgb.g, rgb.b].map((channel) => channel.toString(16).padStart(2, '0')).join('');
    } else visitColors(child, visit);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isRgb(value: Record<string, unknown>): value is Record<string, unknown> & Rgb {
  return ['r', 'g', 'b'].every(
    (key) => typeof value[key] === 'number' && Number.isFinite(value[key]),
  );
}

export const keyBrightness = Object.freeze({ inspect, adjust });

