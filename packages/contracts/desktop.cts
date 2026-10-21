/** JSON crossing the isolated renderer boundary has no native handles/functions. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export interface ProfileDocument extends JsonObject {
  schemaVersion: 1;
  keyboard: JsonObject & { activeProfileId: string; softwareProfiles: JsonObject[] };
  remap: JsonObject;
}
export type StoredProfiles = ProfileDocument | Record<string, never>;
export interface MacroEvent {
  hidKey: number;
  state: 'Pressed' | 'Released';
  timestamp: number;
}
export interface DesktopLifecycleSnapshot {
  phase: 'ready' | 'closing' | 'closed';
  pendingTransactions: number;
  recovery: {
    status: 'waiting' | 'running' | 'complete' | 'failed';
    reason: string | null;
    error: string | null;
  };
}
export type FieldName =
  | 'brightnessKeys'
  | 'brightnessRing'
  | 'pollingRate'
  | 'gameMode'
  | 'fnLock'
  | 'idleMinutes'
  | 'activeProfile';
export interface FieldEdit {
  field: FieldName;
  wireIndex: number;
  value: number;
}
export interface ActuationKey {
  physicalKey: number;
  kind: 'Single' | 'Rapid' | 'Dual';
  levelIndex: number;
  secondLevelIndex: number;
  rapidSensitivityIndex: number;
}
export interface ActuationEdit {
  wireIndex: number;
  keys: ActuationKey[];
}
export interface RemapEdit {
  wireIndex: number;
  physicalKey: number;
  level: 0 | 1;
  fnLayer: boolean;
  remap: JsonObject;
}
export interface LightingEdit {
  wireIndex: number;
  layer: 'Base' | 'Ring' | 'Reactive';
  zones: JsonObject[];
}
export interface SnapConfig {
  physicalKey1: number;
  physicalKey2: number;
  resolutionMethod: 'LastPressed';
  bottomMode: 'EitherOne';
}
export interface SnapEdit {
  wireIndex: number;
  configs: SnapConfig[];
}
export type ProfileEdit = import('../backend/src/contracts.cjs').ProfileInput;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export function object(value: unknown, name = 'object'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid ' + name);
  return value as Record<string, unknown>;
}
export function json(value: unknown, depth = 0): Json {
  if (depth > 64) throw Error('JSON nesting limit exceeded');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value))
    return value.map((item: unknown) => (item === undefined ? null : json(item, depth + 1)));
  const row = object(value, 'JSON value');
  const result: JsonObject = {};
  for (const [key, entry] of Object.entries(row)) {
    if (entry === undefined) continue;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype')
      throw Error('Invalid JSON property');
    result[key] = json(entry, depth + 1);
  }
  return result;
}
export function jsonObject(value: unknown): JsonObject {
  const parsed = json(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw Error('Expected JSON object');
  return parsed;
}
export function integer(value: unknown, min: number, max: number, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    throw Error('Invalid ' + name);
  return value;
}
export function backupPath(value: unknown): string {
  if (typeof value !== 'string' || !/^device-edits\/[\w.-]+-before\.json$/.test(value))
    throw Error('Invalid backup reference');
  return value;
}
export function macroEvent(value: unknown): MacroEvent {
  const row = object(value, 'macro event');
  const hidKey = integer(row.hidKey, 0, 65535, 'macro key');
  if (row.state !== 'Pressed' && row.state !== 'Released') throw Error('Invalid macro state');
  if (typeof row.timestamp !== 'number' || !Number.isFinite(row.timestamp) || row.timestamp < 0)
    throw Error('Invalid macro timestamp');
  return { hidKey, state: row.state, timestamp: row.timestamp };
}
