import type * as C from '../backend/src/contracts.cjs';
import { object, integer, jsonObject } from './desktop.cjs';

function list(value: unknown, name: string, max = 1000): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw Error('Invalid ' + name);
  return value;
}
function bool(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw Error('Invalid ' + name);
  return value;
}
function number(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Error('Invalid ' + name);
  return value;
}
function text(value: unknown, name: string): string {
  if (typeof value !== 'string') throw Error('Invalid ' + name);
  return value;
}
function member<T extends string>(value: unknown, choices: readonly T[], name: string): T {
  const match = choices.find((choice) => choice === value);
  if (match === undefined) throw Error('Invalid ' + name);
  return match;
}
const slot = (value: unknown): number => integer(value, 0, 4, 'profile slot');
// CAM uses a 32-bit enum value for the dedicated Function key.
const key = (value: unknown): number => integer(value, 0, 0xffffffff, 'physical key');
export function fieldEdit(value: unknown): C.FieldEdit {
  const row = object(value, 'field edit');
  return {
    field: member(
      row.field,
      [
        'brightnessKeys',
        'brightnessRing',
        'pollingRate',
        'gameMode',
        'fnLock',
        'idleMinutes',
        'activeProfile',
      ] as const,
      'field',
    ),
    wireIndex: slot(row.wireIndex),
    value: integer(row.value, 0, 100, 'field value'),
  };
}
export function actuationEdit(value: unknown): C.ActuationInput {
  const row = object(value, 'actuation edit');
  return {
    wireIndex: slot(row.wireIndex),
    keys: list(row.keys, 'actuation keys', 88).map((entry) => {
      const keyRow = object(entry, 'actuation key');
      return {
        physicalKey: key(keyRow.physicalKey),
        kind: member(keyRow.kind, ['Single', 'Rapid', 'Dual'] as const, 'actuation kind'),
        levelIndex: integer(keyRow.levelIndex, 0, 39, 'actuation level'),
        secondLevelIndex: integer(keyRow.secondLevelIndex, 0, 39, 'secondary level'),
        rapidSensitivityIndex: integer(keyRow.rapidSensitivityIndex, 0, 39, 'rapid sensitivity'),
      };
    }),
  };
}
function remap(value: unknown): C.Remap {
  const row = object(value, 'key mapping');
  if (row.kind === 'SimpleRemap') return { kind: row.kind, targetKeyId: key(row.targetKeyId) };
  if (row.kind === 'Modifier')
    return {
      kind: row.kind,
      modifier: member(row.modifier, ['Shift', 'Control', 'Alt'] as const, 'modifier'),
    };
  if (row.kind !== 'Macro') throw Error('Invalid key mapping kind');
  const action = object(row.action, 'macro action'),
    repeat = object(action.repeatCount, 'macro repetition');
  const repeatKind = member(
    repeat.kind,
    ['WhilePressed', 'Infinite', 'Count'] as const,
    'macro repetition',
  );
  const repeatCount: C.Repeat =
    repeatKind === 'Count'
      ? { kind: repeatKind, nonZeroCount: integer(repeat.nonZeroCount, 1, 65535, 'repeat count') }
      : { kind: repeatKind };
  return {
    kind: 'Macro',
    action: {
      repeatCount,
      targetKeys: list(action.targetKeys, 'macro steps', 10000).map((entry) => {
        const step = object(entry, 'macro step');
        return {
          targetKeyId: key(step.targetKeyId),
          state: member(step.state, ['Pressed', 'Released'] as const, 'key state'),
          delaySeconds: number(step.delaySeconds, 'macro delay'),
        };
      }),
    },
  };
}
export function remapEdit(value: unknown): C.RemapInput {
  const row = object(value, 'remap edit');
  return {
    wireIndex: slot(row.wireIndex),
    physicalKey: key(row.physicalKey),
    level: integer(row.level, 0, 1, 'remap level'),
    fnLayer: bool(row.fnLayer, 'Fn layer'),
    remap: remap(row.remap),
  };
}
function snapConfig(value: unknown): C.SnapConfig {
  const row = object(value, 'Snap pair');
  return {
    physicalKey1: key(row.physicalKey1),
    physicalKey2: key(row.physicalKey2),
    resolutionMethod: member(row.resolutionMethod, ['LastPressed'] as const, 'Snap resolution'),
    bottomMode: member(row.bottomMode, ['EitherOne'] as const, 'Snap bottom mode'),
  };
}
export function snapEdit(value: unknown): C.SnapInput {
  const row = object(value, 'Snap edit');
  return {
    wireIndex: slot(row.wireIndex),
    configs: list(row.configs, 'Snap pairs', 3).map(snapConfig),
  };
}
function color(value: unknown): string | C.Rgb {
  if (typeof value === 'string') return value;
  const row = object(value, 'color');
  return { r: number(row.r, 'red'), g: number(row.g, 'green'), b: number(row.b, 'blue') };
}
function stop(value: unknown): C.Stop {
  const row = object(value, 'gradient stop');
  return {
    ...(row.id === undefined ? {} : { id: text(row.id, 'gradient id') }),
    color: color(row.color),
    position: number(row.position, 'gradient position'),
  };
}
function effectColor(value: unknown): C.Rgb | C.ColorMode {
  const row = object(value, 'effect color');
  if (typeof row.r === 'number' && typeof row.g === 'number' && typeof row.b === 'number')
    return {
      ...(row.kind === undefined ? {} : { kind: text(row.kind, 'color kind') }),
      r: number(row.r, 'red'),
      g: number(row.g, 'green'),
      b: number(row.b, 'blue'),
    };
  const parsed: C.ColorMode = {};
  if (row.kind !== undefined) parsed.kind = text(row.kind, 'color kind');
  if (row.color !== undefined) parsed.color = color(row.color);
  if (row.colors !== undefined) parsed.colors = list(row.colors, 'effect colors', 256).map(color);
  if (row.gradient !== undefined)
    parsed.gradient = list(row.gradient, 'color gradient', 256).map(stop);
  if (row.size !== undefined) parsed.size = { value: number(object(row.size).value, 'color size') };
  if (row.value !== undefined) parsed.value = number(row.value, 'color value');
  return parsed;
}
function zone(value: unknown): C.Zone {
  const row = object(value, 'lighting zone'),
    raw = object(row.effectSettings, 'lighting effect');
  const effect: C.Effect = { kind: text(raw.kind, 'effect kind') };
  if (raw.layer !== undefined) effect.layer = text(raw.layer, 'effect layer');
  if (raw.color !== undefined) effect.color = effectColor(raw.color);
  if (raw.gradient !== undefined)
    effect.gradient = list(raw.gradient, 'effect gradient', 256).map(stop);
  if (raw.speedPercent !== undefined)
    effect.speedPercent = number(raw.speedPercent, 'effect speed');
  if (raw.direction !== undefined) effect.direction = text(raw.direction, 'effect direction');
  if (raw.gradientType !== undefined) effect.gradientType = text(raw.gradientType, 'gradient type');
  if (raw.keyEvent !== undefined) effect.keyEvent = text(raw.keyEvent, 'key event');
  return {
    ...(row.id === undefined ? {} : { id: text(row.id, 'zone id') }),
    ...(row.keys === undefined ? {} : { keys: list(row.keys, 'zone keys', 256).map(key) }),
    ...(row.leds === undefined ? {} : { leds: list(row.leds, 'zone LEDs', 256).map(key) }),
    effectSettings: effect,
  };
}
export function lightingEdit(value: unknown): C.LightingInput {
  const row = object(value, 'lighting edit');
  return {
    wireIndex: slot(row.wireIndex),
    layer: member(row.layer, ['Base', 'Ring', 'Reactive'] as const, 'lighting layer'),
    zones: list(row.zones, 'lighting zones', 256).map(zone),
  };
}
function keyModel(value: unknown): C.KeyModel {
  const row = object(value, 'profile key'),
    active = object(row.active, 'active key'),
    actuation = object(active.actuation, 'key actuation');
  const remapTo = (input: unknown): C.Remap | C.Remap[] =>
    Array.isArray(input) ? list(input, 'key outputs', 2).map(remap) : remap(input);
  const parsed: C.KeyModel['active']['actuation'] = {};
  if (actuation.isRapidTrigger !== undefined)
    parsed.isRapidTrigger = bool(actuation.isRapidTrigger, 'rapid trigger');
  for (const name of ['level', 'level1', 'level2', 'rapidSensitivity'] as const)
    if (actuation[name] !== undefined) parsed[name] = integer(actuation[name], 0, 39, name);
  return {
    physicalKey: key(row.physicalKey),
    active: {
      kind: member(active.kind, ['Single', 'Dual'] as const, 'key mode'),
      actuation: parsed,
      remapTo: remapTo(active.remapTo),
      ...(active.fnPressed === undefined
        ? {}
        : { fnPressed: { remapTo: remapTo(object(active.fnPressed).remapTo) } }),
    },
  };
}
export function profileEdit(value: unknown): C.ProfileInput {
  // Bound and normalize JSON before deeply validating the fields used by the planner.
  const row = object(jsonObject(value), 'profile edit'),
    settings = object(row.settings, 'profile settings'),
    idle = object(settings.idleTimeout, 'idle timeout');
  return {
    wireIndex: slot(row.wireIndex),
    settings: {
      pollingRate: text(settings.pollingRate, 'polling rate'),
      ...(settings.keyBrightness===undefined?{}:{keyBrightness:number(settings.keyBrightness,'key brightness')}),
      ...(settings.perimeterBrightness===undefined?{}:{perimeterBrightness:number(settings.perimeterBrightness,'perimeter brightness')}),
      idleTimeout: {
        disabled: bool(idle.disabled, 'idle disabled'),
        timeoutSeconds: number(idle.timeoutSeconds, 'idle seconds'),
      },
      gameModeEnabled: bool(settings.gameModeEnabled, 'game mode'),
      fnLockEnabled: bool(settings.fnLockEnabled, 'Fn lock'),
      baseZones: list(settings.baseZones, 'base zones', 256).map(zone),
      perimeterZones: list(settings.perimeterZones, 'perimeter zones', 256).map(zone),
      reactiveZones: list(settings.reactiveZones, 'reactive zones', 256).map(zone),
    },
    physicalKeys: list(row.physicalKeys, 'profile keys', 90).map(keyModel),
    snapConfigs: list(row.snapConfigs, 'profile Snap', 3).map(snapConfig),
  };
}
