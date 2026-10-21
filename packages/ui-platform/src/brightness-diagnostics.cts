/** A scoped observation of the active brightness control for integration checks. */
export interface KeyBrightnessControl {
  apply(level: number): void;
  selected: boolean;
  keys: number[];
  layer: string;
}
let current: KeyBrightnessControl | null = null;
export function recordKeyBrightnessControl(control: KeyBrightnessControl): void {
  current = { ...control, keys: [...control.keys] };
}
export function getKeyBrightnessControl(): KeyBrightnessControl | null {
  return current ? { ...current, keys: [...current.keys] } : null;
}
