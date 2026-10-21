/** Validate the Rust process boundary before returning named, typed operations. */
import type * as C from './contracts.cjs';

export interface Replies {
  '--enumerate': Record<string, unknown>;
  '--version': Record<string, unknown>;
  '--connection': C.Connection;
  '--state': C.DeviceState;
  '--sensors': C.SensorSnapshot;
  '--current': C.CurrentSnapshot;
  '--actuation': C.ActuationSnapshot;
  '--lighting': C.LightingSnapshot;
  '--remaps': C.RemapSnapshot;
  '--snap': C.SnapSnapshot;
  '--apply-field': C.MutationResult<number>;
  '--apply-actuation': C.MutationResult<C.ActuationSnapshot>;
  '--apply-lighting': C.MutationResult<string>;
  '--apply-runtime-lighting': C.MutationResult;
  '--apply-remap': C.MutationResult<C.RemapRecord>;
  '--apply-snap': C.MutationResult<string>;
  '--apply-software-actuation': C.MutationResult;
}
export type Operation = keyof Replies;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min = 0, max = 65535): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const array = (v: unknown): v is unknown[] => Array.isArray(v);
const hex = (v: unknown): v is string => typeof v === 'string' && /^(?:[0-9a-f]{2})*$/i.test(v);
const slot = (v: unknown) => integer(v, 0, 4);
function metadata(v: Record<string, unknown>) {
  return (
    v.status === 'ok' &&
    v.firmware === '2.2.14' &&
    v.readOnly === true &&
    v.settingsWritePerformed === false
  );
}
function config(v: unknown): boolean {
  if (!object(v)) return false;
  const level = (x: unknown) => object(x) && integer(x.valueMicroMeters, 0, 4000);
  return v.kind === 'Single'
    ? level(v.level)
    : v.kind === 'Dual'
      ? level(v.level1) && level(v.level2)
      : v.kind === 'Rapid'
        ? level(v.level) && level(v.sensitivity)
        : false;
}
function actuation(v: unknown): boolean {
  return (
    object(v) &&
    slot(v.activeProfileIndex) &&
    array(v.actuations) &&
    v.actuations.length === 88 &&
    v.actuations.every(
      (k) =>
        object(k) &&
        integer(k.physicalKey, 0, 0xffffffff) &&
        integer(k.sensorId) &&
        typeof k.label === 'string' &&
        integer(k.rawWord, 0, 0xffffffff) &&
        integer(k.levelIndex, 0, 39) &&
        integer(k.secondLevelIndex, 0, 63) &&
        integer(k.rapidSensitivityIndex, 0, 63) &&
        config(k.config),
    )
  );
}
function remap(v: unknown): boolean {
  return (
    object(v) &&
    integer(v.physicalKey, 0, 0xffffffff) &&
    integer(v.level, 0, 1) &&
    typeof v.fnLayer === 'boolean' &&
    hex(v.data)
  );
}
function state(v: Record<string, unknown>) {
  return (
    slot(v.activeProfileIndex) &&
    array(v.brightnessChannels) &&
    v.brightnessChannels.length === 2 &&
    v.brightnessChannels.every((x) => integer(x, 0, 100)) &&
    array(v.profiles) &&
    v.profiles.length === 5 &&
    v.profiles.every(
      (p) =>
        object(p) &&
        slot(p.wireIndex) &&
        integer(p.field0, 0, 6) &&
        integer(p.field3, 0, 1) &&
        integer(p.field4, 0, 1) &&
        integer(p.field5, 0, 100) &&
        integer(p.field7, 0, 255),
    )
  );
}
function read(mode: Operation, v: Record<string, unknown>): boolean {
  switch (mode) {
    case '--connection':
      return (
        metadata(v) &&
        slot(v.activeProfileIndex) &&
        array(v.brightnessChannels) &&
        v.brightnessChannels.length === 2 &&
        v.brightnessChannels.every((x) => integer(x, 0, 100)) &&
        typeof v.gameModeEnabled === 'boolean' &&
        typeof v.fnLockEnabled === 'boolean'
      );
    case '--state':
      return metadata(v) && state(v);
    case '--actuation':
      return metadata(v) && actuation(v);
    case '--remaps':
      return (
        metadata(v) &&
        slot(v.wireIndex) &&
        slot(v.activeProfileIndex) &&
        array(v.records) &&
        v.records.every(
          (record) =>
            remap(record) &&
            object(record) &&
            integer(record.canonicalKey, 0, 255) &&
            integer(record.status, 1, 2),
        )
      );
    case '--lighting':
      return (
        metadata(v) &&
        slot(v.activeProfileIndex) &&
        array(v.profiles) &&
        v.profiles.length === 5 &&
        v.profiles.every(
          (p) =>
            object(p) &&
            slot(p.wireIndex) &&
            array(p.layers) &&
            p.layers.length === 3 &&
            p.layers.every(
              (l) =>
                object(l) &&
                ['Base', 'Ring', 'Reactive'].includes(String(l.kind)) &&
                integer(l.command) &&
                integer(l.status, 1, 2) &&
                hex(l.data),
            ),
        )
      );
    case '--snap':
      return (
        metadata(v) &&
        slot(v.activeProfileIndex) &&
        array(v.profiles) &&
        v.profiles.length === (v.activeProfileIndex === 4 ? 5 : 4) &&
        v.profiles.every(
          (p) => object(p) && slot(p.wireIndex) && hex(p.response) && p.response.length === 36,
        )
      );
    case '--current':
    case '--sensors':
      return (
        metadata(v) &&
        typeof v.devicePath === 'string' &&
        array(v.keys) &&
        v.keys.length === (mode === '--current' ? 96 : 88) &&
        v.keys.every(
          (k) =>
            object(k) &&
            integer(k.sensorId) &&
            integer(k.adc) &&
            (mode === '--current' ||
              (integer(k.baseline) &&
                integer(k.scale, 1) &&
                integer(k.pressed) &&
                integer(k.threshold))),
        )
      );
    case '--version':
    case '--enumerate':
      return true;
    default:
      return false;
  }
}
export function nativeReply<O extends Operation>(mode: O, value: unknown): Replies[O] {
  if (!object(value)) throw Error('Malformed native keyboard reply');
  let valid: boolean;
  if (mode.startsWith('--apply-')) {
    valid =
      typeof value.outcome === 'string' &&
      ['applied', 'unchanged', 'acknowledged', 'uncertain'].includes(value.outcome) &&
      (value.error === undefined || typeof value.error === 'string');
    if (valid && value.after !== undefined) {
      valid =
        mode === '--apply-field'
          ? integer(value.after, 0, 100)
          : mode === '--apply-actuation'
            ? actuation(value.after)
            : mode === '--apply-remap'
              ? remap(value.after)
              : hex(value.after);
    }
  } else valid = read(mode, value);
  if (!valid) throw Error('Invalid native keyboard reply for ' + mode);
  return value as Replies[O];
}
