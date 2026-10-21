import type { CoreColorStop } from '../theme/color.js';

/** Wire gradients contain RGB and 0..1 positions; the editor uses hex and 0..100. */
export type CoreGradientSnapshot<Value> = Value extends readonly unknown[] ? Value
  : Value extends object ? 'gradient' extends keyof Value
    ? Omit<{ [Key in keyof Value]: CoreGradientSnapshot<Value[Key]> }, 'gradient'> & { gradient: CoreColorStop[] }
    : { [Key in keyof Value]: CoreGradientSnapshot<Value[Key]> }
  : Value;
export type WithoutLayer<Value> = Value extends object ? Omit<Value, 'layer'> : never;
