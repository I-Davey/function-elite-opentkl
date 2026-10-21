import type * as C from './contracts.cjs';
import { required } from './validation.cjs';
import * as deviceBackend from './devices.cjs';

import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './validation.cjs';
const layout = readJson<C.Layout>(
  fs.readFileSync(path.join(__dirname, '../resources/keyboard/key-layout.json'), 'utf8'),
);
const table = readJson<{ wireToHid: Record<number, number> }>(
  fs.readFileSync(path.join(__dirname, '../resources/keyboard/firmware-key-map.json'), 'utf8'),
).wireToHid;
// Firmware consumer-report descriptor at 0x350b0: bit order is volume up/down, play, stop, mute, next/previous.
const media = [128, 129, 232, 233, 127, 235, 234];
// Record kind 7 becomes event 0x0b in 0x1ff84. The event dispatcher holds
// the selected modifier and emits the original key (0x15dac), rather than
// replacing that key with a modifier-only press.
const modifiers = { Shift: 64, Control: 80, Alt: 82 };
const physicalToWire = new Map(
  Object.entries(layout.sensors).map(([wire, key]) => [key.physicalKeyId, Number(wire)]),
);
const hidToWire = new Map(Object.entries(table).map(([wire, hid]) => [hid, Number(wire)]));
// The NZXT logo reports HID F14 to the UI but is the firmware's Fn key.
hidToWire.set(105, 47);
function target(wire: number) {
  const hid = table[wire];
  if (hid === undefined) throw Error('Unknown firmware key target ' + wire);
  return hid === 4278190318 ? 105 : hid;
}
function wire(hid: number) {
  const value = hidToWire.get(hid);
  if (value === undefined) throw Error('Keyboard target is not yet mapped: ' + hid);
  return value;
}
function decode(data: string, physicalKey: number): C.Remap {
  const bytes = Buffer.from(data, 'hex');
  if (data === '01010000000000') return { kind: 'Macro', action: { repeatCount: { kind: 'Count', nonZeroCount: 1 }, targetKeys: [] } };
  if (!bytes.length) return { kind: 'SimpleRemap', targetKeyId: physicalKey };
  if (bytes[0] === 6 && bytes.length === 1) return { kind: 'SimpleRemap', targetKeyId: 0 };
  if (bytes[0] === 3 && bytes.length === 2 && bytes[1] < 7)
    return { kind: 'SimpleRemap', targetKeyId: media[bytes[1]] };
  if (bytes[0] === 4 && bytes.length === 2)
    return { kind: 'SimpleRemap', targetKeyId: target(bytes[1]) };
  if (bytes[0] === 7 && bytes.length === 2) {
    const modifier = (Object.keys(modifiers) as (keyof typeof modifiers)[]).find(
      (name) => modifiers[name] === bytes[1],
    );
    if (!modifier) throw Error('Unknown modifier remap');
    return { kind: 'Modifier', modifier };
  }
  if ([1, 2].includes(bytes[0]) && bytes.length >= 10 && (bytes.length - 7) % 3 === 0) {
    if (bytes[2] !== 0) throw Error('Stored macro uses randomized delays');
    const repeatCount: C.Repeat =
      bytes[1] === 0
        ? { kind: 'WhilePressed' }
        : bytes[1] === 255
          ? { kind: 'Infinite' }
          : { kind: 'Count', nonZeroCount: bytes[1] };
    const targetKeys: Extract<C.Remap, { kind: 'Macro' }>['action']['targetKeys'] = [];
    for (let i = 7; i < bytes.length; i += 3)
      targetKeys.push({
        targetKeyId: target(bytes[i] & 127),
        state: bytes[i] & 128 ? 'Pressed' : 'Released',
        delaySeconds: bytes.readUInt16LE(i + 1) / 1000,
      });
    return { kind: 'Macro', action: { repeatCount, targetKeys } };
  }
  throw Error('Stored remap type ' + bytes[0] + ' is not yet decoded');
}
function encode(remap: C.Remap, physicalKey: number) {
  if (!remap || typeof remap !== 'object') throw Error('Missing key remap');
  if (remap.kind === 'Modifier') {
    if (!Object.hasOwn(modifiers, remap.modifier)) throw Error('Invalid modifier');
    return Buffer.from([7, modifiers[remap.modifier]]).toString('hex');
  }
  if (remap.kind === 'SimpleRemap') {
    if (remap.targetKeyId === 0) return '06';
    if (media.includes(remap.targetKeyId))
      return Buffer.from([3, media.indexOf(remap.targetKeyId)]).toString('hex');
    if (remap.targetKeyId === physicalKey) return '';
    return Buffer.from([4, wire(remap.targetKeyId)]).toString('hex');
  }
  if (remap.kind === 'Macro') {
    const action = remap.action,
      repeat = action?.repeatCount;
    const count =
      repeat?.kind === 'WhilePressed'
        ? 0
        : repeat?.kind === 'Infinite'
          ? 255
          : repeat?.kind === 'Count' &&
              Number.isInteger(repeat.nonZeroCount) &&
              repeat.nonZeroCount > 0 &&
              repeat.nonZeroCount < 255
            ? repeat.nonZeroCount
            : undefined;
    if (
      count === undefined ||
      !Array.isArray(action.targetKeys) ||
      !action.targetKeys.length ||
      action.targetKeys.length > 1024
    )
      throw Error('Invalid macro actions/repeat count');
    const bytes = Buffer.alloc(7 + action.targetKeys.length * 3);
    bytes[0] = 1;
    bytes[1] = count;
    action.targetKeys.forEach((key, index) => {
      if (!['Pressed', 'Released'].includes(key.state)) throw Error('Invalid macro key state');
      const ms = Math.round(key.delaySeconds * 1000);
      if (!Number.isFinite(key.delaySeconds) || ms < 20 || ms > 1000)
        throw Error('Macro delays must be 20–1000 ms');
      bytes[7 + index * 3] = wire(key.targetKeyId) | (key.state === 'Pressed' ? 128 : 0);
      bytes.writeUInt16LE(ms, 8 + index * 3);
    });
    return bytes.toString('hex');
  }
  throw Error('Unsupported remap kind');
}
async function readSlot(wireIndex: number, backend: C.DeviceBackend = deviceBackend) {
  if (!Number.isInteger(wireIndex) || wireIndex < 0 || wireIndex > 4)
    throw Error('Invalid hardware slot');
  const keys = [...physicalToWire.keys()],
    records = [];
  let activeProfileIndex;
  for (let i = 0; i < keys.length; i += 4) {
    const value = await backend.remaps({ wireIndex, physicalKeys: keys.slice(i, i + 4) });
    if (activeProfileIndex !== undefined && activeProfileIndex !== value.activeProfileIndex)
      throw Error('Profile changed during remap read');
    activeProfileIndex = value.activeProfileIndex;
    records.push(...value.records);
  }
  return {
    wireIndex,
    activeProfileIndex: required(activeProfileIndex),
    records,
    source: 'direct-hid',
  };
}
/** Reconstruct the original renderer contract from actual records and actuation. */
function coreConfigs(snapshot: C.RemapSnapshot, actuation: C.ActuationSnapshot) {
  if (snapshot.wireIndex !== actuation.activeProfileIndex || snapshot.records.length !== 352)
    throw Error('Incomplete remap snapshot');
  return actuation.actuations.map((key) => {
    const pair = (level: number): { nonePressed: C.Remap; fnPressed: C.Remap } => {
      const target = (fnLayer: boolean) => {
        const record = required(
          snapshot.records.find(
            (r) => r.physicalKey === key.physicalKey && r.level === level && r.fnLayer === fnLayer,
          ),
          'Missing key remap',
        );
        return decode(record.data, key.physicalKey);
      };
      return { nonePressed: target(false), fnPressed: target(true) };
    };
    const active = { ...key.config };
    if (active.kind === 'Dual') {
      active.remapLevel1 = pair(0);
      active.remapLevel2 = pair(1);
    } else active.remap = pair(0);
    return { key: key.physicalKey, active };
  });
}
export { encode, decode, readSlot, coreConfigs, physicalToWire };
