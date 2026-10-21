/** CAM patch schema v2, shared by the editor, import path and controller engine. */
export const axes = { lx: 'Left stick · horizontal', ly: 'Left stick · vertical', rx: 'Right stick · horizontal', ry: 'Right stick · vertical', lt: 'Left trigger', rt: 'Right trigger' };
export const buttons = { a: 0x1000, b: 0x2000, x: 0x4000, y: 0x8000, lb: 0x100, rb: 0x200, ls: 0x40, rs: 0x80, start: 0x10, back: 0x20, dpadUp: 1, dpadDown: 2, dpadLeft: 4, dpadRight: 8 };
export const channels = { ...axes, a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'Left bumper · LB', rb: 'Right bumper · RB', ls: 'Left stick click · LS', rs: 'Right stick click · RS', start: 'Menu / Start', back: 'View / Back', dpadUp: 'D-pad · Up', dpadDown: 'D-pad · Down', dpadLeft: 'D-pad · Left', dpadRight: 'D-pad · Right' };
export type Axis = keyof typeof axes;
export type Channel = keyof typeof channels;
export type Point = { x: number; y: number };
export interface TravelCalibration { released: number; pressed: number; noise: number; factoryBaseline: number; factoryScale: number; factoryPressed: number; at: string }
export interface OverrideSettings { enabled: boolean; mode: 'toggle'; shortcut: number[]; scope: 'all'; keys: number[] }
export interface FeedbackSettings { enabled: boolean; activeColor: string; suppressedColor: string; overrideColor: string; brightness: number; fadeMs: number }
export interface CalibrationState { key: number; phase: 'released' | 'pressed' | 'review'; samples: number; error: string; result?: TravelCalibration }
export type CalibrationRequest = { action: 'start' | 'capture' | 'apply' | 'cancel'; key: number };
export interface Binding {
  enabled: boolean; overwriteDefault: boolean; channel: Channel; direction: 1 | -1;
  startMm: number; endMm: number; curve: 'linear' | 'exponential' | 'logarithmic' | 'custom';
  strength: number; points: Point[]; outputMin: number; outputMax: number; smoothMs: number;
  pressThreshold: number; releaseThreshold: number;
  calibration?: TravelCalibration;
}
export interface AnalogueProfile { schemaVersion: 2; normalizeSticks: boolean; bindings: Record<string, Binding>; override: OverrideSettings; feedback: FeedbackSettings }
export interface AnalogueFrame {
  axes: Record<Axis, number>; buttons: Partial<Record<keyof typeof buttons, boolean>>;
  keyLevels: Record<string, number>; rawMm: Record<string, number>; buttonMask: number;
}
export interface AnalogueState extends AnalogueFrame {
  running: boolean; connected: boolean; error: string; rateHz: number; sampleAgeMs: number | null;
  profileId: string; settings: AnalogueProfile; recoveryPending: boolean; preview: boolean;
  overriddenKeys: number[]; overrideRequested: boolean; transitioning: boolean; calibration: CalibrationState | null; feedbackError: string;
}
export const isButton = (channel: Channel): channel is keyof typeof buttons => Object.hasOwn(buttons, channel);
export const isStick = (channel: Channel) => ['lx', 'ly', 'rx', 'ry'].includes(channel);
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const numeric = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid analogue settings');
  return value as Record<string, unknown>;
}
export function binding(value: unknown = {}): Binding {
  const row = record(value);
  const startMm = numeric(row.startMm, .1, 0, 3.9), outputMin = numeric(row.outputMin, 0, 0, 1);
  const pressThreshold = numeric(row.pressThreshold, .5, .01, 1);
  const points: Point[] = (Array.isArray(row.points) ? row.points.slice(0, 32) : [{ x: .5, y: .5 }])
    .map((point) => { const p = record(point); return { x: numeric(p.x, 0, 0, 1), y: numeric(p.y, 0, 0, 1) }; })
    .filter((p) => p.x > 0 && p.x < 1).sort((a, b) => a.x - b.x);
  let calibration: TravelCalibration | undefined;
  if (row.calibration !== undefined) {
    const c = record(row.calibration);
    for (const field of ['released', 'pressed', 'noise', 'factoryBaseline', 'factoryScale', 'factoryPressed'])
      if (typeof c[field] !== 'number' || !Number.isFinite(c[field]) || Number(c[field]) < 0 || Number(c[field]) > 65535) throw Error('Invalid travel calibration');
    if (Number(c.pressed) <= Number(c.released) || Number(c.factoryScale) <= 0 || typeof c.at !== 'string' || !Number.isFinite(Date.parse(c.at))) throw Error('Invalid travel calibration range');
    calibration = c as unknown as TravelCalibration;
  }
  return {
    enabled: row.enabled === true, overwriteDefault: row.overwriteDefault === true,
    channel: typeof row.channel === 'string' && Object.hasOwn(channels, row.channel) ? row.channel as Channel : 'ly',
    direction: row.direction === -1 ? -1 : 1, startMm, endMm: numeric(row.endMm, 4, startMm + .05, 4),
    curve: ['linear', 'exponential', 'logarithmic', 'custom'].includes(String(row.curve)) ? row.curve as Binding['curve'] : 'linear',
    strength: numeric(row.strength, 2, .1, 10),
    points: [{ x: 0, y: 0 }, ...points.filter((p, i) => !i || p.x - points[i - 1].x >= .002), { x: 1, y: 1 }],
    outputMin, outputMax: numeric(row.outputMax, 1, outputMin, 1), smoothMs: numeric(row.smoothMs, 0, 0, 500),
    pressThreshold, releaseThreshold: numeric(row.releaseThreshold, Math.min(.45, pressThreshold - .001), 0, pressThreshold - .001),
    ...(calibration ? { calibration } : {}),
  };
}
export function parseProfile(value: unknown): AnalogueProfile {
  const row = record(value);
  if (row.schemaVersion !== 2) throw Error('Choose a CAM analogue schema v2 settings file');
  const entries = Object.entries(record(row.bindings));
  if (entries.length > 88) throw Error('Too many analogue bindings');
  const bindings: Record<string, Binding> = {};
  for (const [code, item] of entries) {
    if (!/^\d{1,10}$/.test(code)) throw Error('Invalid physical key ID');
    bindings[code] = binding(item);
  }
  const override = row.override === undefined ? {} : record(row.override), feedback = row.feedback === undefined ? {} : record(row.feedback);
  const keys = (value: unknown, fallback: number[], maximum: number) => {
    if (value === undefined) return fallback;
    if (!Array.isArray(value) || value.length > maximum || value.some(k => !Number.isInteger(k) || k < 0 || k > 0xffffffff)) throw Error('Invalid override keys');
    return [...new Set(value as number[])];
  };
  const color = (value: unknown, fallback: string) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw Error('Invalid feedback colour');
    return value;
  };
  const shortcut = keys(override.shortcut, [226, 225, 30], 4);
  if (override.enabled === true && !shortcut.length) throw Error('Choose an override shortcut');
  return { schemaVersion: 2, normalizeSticks: row.normalizeSticks !== false, bindings,
    override: { enabled: override.enabled === true, mode: 'toggle', shortcut, scope: 'all', keys: [] },
    feedback: { enabled: feedback.enabled === true, activeColor: color(feedback.activeColor, '#a87dff'),
      suppressedColor: color(feedback.suppressedColor, '#57cdb6'), overrideColor: color(feedback.overrideColor, '#ffbb55'),
      brightness: numeric(feedback.brightness, .7, 0, 1), fadeMs: numeric(feedback.fadeMs, 80, 0, 500) } };
}
export const emptyProfile = (): AnalogueProfile => parseProfile({ schemaVersion: 2, normalizeSticks: true, bindings: {} });
export const movement = (existing: Record<string, Binding> = {}): Record<string, Binding> => Object.fromEntries(
  [[26, 'ly', 1], [22, 'ly', -1], [4, 'lx', -1], [7, 'lx', 1]].map(([code, channel, direction]) =>
    [String(code), binding({ ...existing[String(code)], enabled: true, channel, direction })]));
export function shape(x: number, b: Binding): number {
  x = clamp(x);
  if (b.curve === 'exponential') return x ** b.strength;
  if (b.curve === 'logarithmic') return Math.log1p(Math.expm1(b.strength) * x) / b.strength;
  if (b.curve === 'custom') {
    let i = 1;
    while (i < b.points.length - 1 && x > b.points[i].x) i++;
    const a = b.points[i - 1], c = b.points[i];
    return a.y + (c.y - a.y) * (x - a.x) / (c.x - a.x);
  }
  return x;
}
export function evaluate(mm: number, b: Binding): number {
  if (!Number.isFinite(mm) || mm <= b.startMm) return 0;
  return clamp(b.outputMin + (b.outputMax - b.outputMin) * shape((mm - b.startMm) / (b.endMm - b.startMm), b));
}
export const neutralFrame = (): AnalogueFrame => ({ axes: { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 }, buttons: {}, keyLevels: {}, rawMm: {}, buttonMask: 0 });
/** Physical travel shortcuts keep working while the game has focus or a key is suppressed. */
export class OverrideShortcut {
  private held = new Set<number>();
  private chord = false;
  private armed = false;
  active = false;
  rearm() { this.held.clear(); this.chord = false; this.armed = false; }
  reset() { this.rearm(); this.active = false; }
  update(rawMm: Record<string, number>, settings: OverrideSettings): boolean {
    if (!settings.enabled) return this.active;
    for (const key of settings.shortcut) {
      if ((rawMm[key] ?? 0) >= .7) this.held.add(key);
      else if ((rawMm[key] ?? 0) <= .3) this.held.delete(key);
    }
    const chord = settings.shortcut.length > 0 && settings.shortcut.every(key => this.held.has(key));
    if (!this.armed) { if (!this.held.size) this.armed = true; return this.active; }
    if (chord && !this.chord) this.active = !this.active;
    this.chord = chord;
    return this.active;
  }
}
export function feedbackColor(b: Binding, overridden: boolean, settings: FeedbackSettings): string {
  const color = overridden ? settings.overrideColor : b.overwriteDefault ? settings.suppressedColor : settings.activeColor;
  const intensity = settings.brightness;
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(color.slice(i, i + 2), 16) * intensity).toString(16).padStart(2, '0')).join('');
}
export function controllerContribution(frame: AnalogueFrame, key: string, b: Binding): number {
  if (!b.enabled || !frame.keyLevels[key]) return 0;
  if (isButton(b.channel)) return frame.buttons[b.channel] ? 1 : 0;
  return Math.min(frame.keyLevels[key], Math.max(0, frame.axes[b.channel] * (isStick(b.channel) ? b.direction : 1)));
}
/** Stateful smoothing and button hysteresis; never reuse diagnostic noise filters for gameplay. */
export class AnalogueEngine {
  private filtered = new Map<string, number>();
  private held = new Map<string, boolean>();
  reset() { this.filtered.clear(); this.held.clear(); }
  update(rawMm: Record<string, number>, settings: AnalogueProfile, elapsedMs: number): AnalogueFrame {
    const result = neutralFrame(), positive = neutralFrame().axes, negative = neutralFrame().axes;
    result.rawMm = rawMm;
    for (const [code, b] of Object.entries(settings.bindings)) {
      if (!b.enabled) continue;
      if (!Number.isFinite(rawMm[code])) throw Error('Mapped key sensor unavailable: ' + code);
      const desired = evaluate(rawMm[code], b), previous = this.filtered.get(code) ?? 0;
      let value = b.smoothMs > 0 ? previous + (desired - previous) * -Math.expm1(-clamp(elapsedMs, 0, 100) / b.smoothMs) : desired;
      if (!desired && value < .001) value = 0;
      this.filtered.set(code, value); result.keyLevels[code] = value;
      if (isButton(b.channel)) {
        const pressed = value > 0 && (this.held.get(code) ? value > b.releaseThreshold : value >= b.pressThreshold);
        this.held.set(code, pressed);
        if (pressed) { result.buttons[b.channel] = true; result.buttonMask |= buttons[b.channel]; }
      } else (b.direction < 0 && isStick(b.channel) ? negative : positive)[b.channel] = Math.max((b.direction < 0 && isStick(b.channel) ? negative : positive)[b.channel], value);
    }
    for (const channel of Object.keys(axes) as Axis[]) result.axes[channel] = positive[channel] - negative[channel];
    if (settings.normalizeSticks) for (const [x, y] of [['lx', 'ly'], ['rx', 'ry']] as const) {
      const length = Math.hypot(result.axes[x], result.axes[y]);
      if (length > 1) { result.axes[x] /= length; result.axes[y] /= length; }
    }
    return result;
  }
}
