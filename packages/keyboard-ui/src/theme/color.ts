import convert from 'color-convert';
import { v4 } from 'uuid';
import type { Rgb } from '../../../backend/src/contracts.cjs';

export interface Hsla { h: number; s: number; l: number; a: number }
export interface GradientStop { id?: string; position: number; color: string }
export interface CoreColorStop { position: number; color: Rgb }

/** Theme colour operations retain CAM's normalized HSL values and rounding. */
export class Color {
  h: number;
  s: number;
  l: number;
  a: number;

  constructor({ h, s, l, a }: Hsla = { h: 0, s: 0, l: 1, a: 1 }) {
    this.h = h; this.s = s; this.l = l; this.a = a;
  }
  alpha(alpha: number) { return new Color({ h: this.h, s: this.s, l: this.l, a: alpha }); }
  lighten(amount: number) {
    return new Color({ h: this.h, s: this.s, l: this.l + (this.l || 1) * amount, a: this.a });
  }
  darken(amount: number) {
    return new Color({ h: this.h, s: this.s, l: this.l - this.l * amount, a: this.a });
  }
  fromHex(hex: string) {
    const [h, s, l] = convert.hex.hsl.raw(hex);
    this.h = h / 360; this.s = s / 100; this.l = l / 100; this.a = 1;
    return this;
  }
  toRgb(): Rgb {
    let r: number, g: number, b: number;
    if (this.s === 0) r = g = b = this.l;
    else {
      const upper = this.l < 0.5 ? this.l * (1 + this.s) : this.l + this.s - this.l * this.s;
      const lower = 2 * this.l - upper;
      r = hueToRgb(lower, upper, this.h + 1 / 3);
      g = hueToRgb(lower, upper, this.h);
      b = hueToRgb(lower, upper, this.h - 1 / 3);
    }
    return { r: Math.round(255 * r), g: Math.round(255 * g), b: Math.round(255 * b) };
  }
  toString() { return `hsla(${360 * this.h}, ${100 * this.s}%, ${100 * this.l}%, ${+this.a.toFixed(3)})`; }
  toHex() { return convert.hsl.hex.raw([360 * this.h, 100 * this.s, 100 * this.l]); }
  toJSON() { return this.toString(); }
}

export function rgba(r: number, g: number, b: number, a: number) {
  return new Color({ ...rgbToHsl(r, g, b), a });
}
export function rgb(r: number, g: number, b: number) { return rgba(r, g, b, 1); }

function hueToRgb(lower: number, upper: number, hue: number) {
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;
  return hue < 1 / 6 ? lower + 6 * (upper - lower) * hue
    : hue < 0.5 ? upper : hue < 2 / 3 ? lower + (upper - lower) * (2 / 3 - hue) * 6 : lower;
}

export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const maximum = Math.max(r, g, b), minimum = Math.min(r, g, b);
  const lightness = (maximum + minimum) / 2;
  let hue = lightness, saturation = lightness;
  if (maximum === minimum) hue = saturation = 0;
  else {
    const difference = maximum - minimum;
    saturation = lightness > 0.5 ? difference / (2 - maximum - minimum) : difference / (maximum + minimum);
    switch (maximum) {
      case r: hue = (g - b) / difference + (g < b ? 6 : 0); break;
      case g: hue = (b - r) / difference + 2; break;
      case b: hue = (r - g) / difference + 4; break;
      default: hue = (g - b) / difference + (g < b ? 6 : 0);
    }
    hue /= 6;
  }
  return { h: hue, s: saturation, l: lightness };
}

export const formatHex = (hex: string) => (hex[0] !== '#' ? '#' : '') + hex;
export const removeHexPound = (hex: string) => hex[0] !== '#' ? hex : hex.substring(1);

export function rgbFromHex(hex: string): Rgb {
  let value = hex.startsWith('#') ? hex.substring(1) : hex;
  if (value.length === 3) value = value.replace(/(.)/g, '$1$1');
  if (!/^#?[0-9A-F]{6}$/i.test(value)) throw new Error('input string must be a valid hexadecimal color');
  return { r: parseInt(value.substring(0, 2), 16), g: parseInt(value.substring(2, 4), 16), b: parseInt(value.substring(4, 6), 16) };
}
function componentToHex(value: number) {
  const hex = value.toString(16);
  return hex.length === 1 ? '0' + hex : hex;
}
export function rgbToHex(r: number, g: number, b: number) {
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

export function getColorFromGradient(stops: readonly GradientStop[], position: number) {
  let before: GradientStop | undefined, after: GradientStop | undefined;
  for (const stop of stops) {
    if (stop && stop.position <= position) before = stop;
    if (stop && stop.position >= position) { after = stop; break; }
  }
  if (!before) return stops[0]?.color ?? '#000000';
  if (!after) return stops[stops.length - 1]?.color ?? '#000000';
  const ratio = (position - before.position) / (after.position - before.position);
  const start = rgbFromHex(before.color), end = rgbFromHex(after.color);
  return rgbToHex(Math.round(start.r + (end.r - start.r) * ratio),
    Math.round(start.g + (end.g - start.g) * ratio), Math.round(start.b + (end.b - start.b) * ratio));
}

export function toCoreColorStop(stop: GradientStop): CoreColorStop {
  return { position: stop.position / 100, color: rgbFromHex(stop.color) };
}
export const toCoreColorStops = (stops: readonly GradientStop[]) => stops.map(toCoreColorStop);
export const fromCoreGradient = (stops: readonly CoreColorStop[]): GradientStop[] => stops.map((stop) => ({
  id: v4(), position: 100 * stop.position, color: rgbToHex(stop.color.r, stop.color.g, stop.color.b),
}));
export function linearGradientFromHex(colors: readonly string[]): GradientStop[] {
  const step = 1 / (colors.length - 1);
  return colors.map((color, index) => ({ id: '', position: step * index, color }));
}
export const krakenZGradient = (first: string, last: string): CoreColorStop[] => [
  { position: 0.3, color: rgbFromHex(first) }, { position: 0.85, color: rgbFromHex(last) },
];
