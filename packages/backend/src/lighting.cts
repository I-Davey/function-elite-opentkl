import type * as C from './contracts.cjs';
import { required, readJson } from './validation.cjs';

import fs from 'node:fs';
import path from 'node:path';
const layout = readJson<C.Layout>(
  fs.readFileSync(path.join(__dirname, '../resources/keyboard/key-layout.json'), 'utf8'),
);
const physicalByWire = new Map<number, number>(
  layout.rows
    .flat()
    .filter((k) => Number.isInteger(k.sensorId) && Number.isInteger(k.code))
    .map((k) => [required(k.sensorId), required(k.code)]),
);
const DIRECTIONS = ['Left', 'Right', 'Up', 'Down', 'Radial', 'RadialReverse'],
  GRADIENT_TYPES = ['Horizontal', 'Vertical', 'Radial'];
const TRIGGERS = ['Pressed', 'Released', 'Hold', 'HoldReleased', 'LongHold', 'LongHoldReleased'];
const enumAt = (values: string[], index: number, name: string) => {
  if (!values[index]) throw Error('Unknown lighting ' + name + ' ' + index);
  return values[index];
};
const rgb = (bytes: number[]) => ({ r: bytes[0], g: bytes[1], b: bytes[2] });
const hex = (bytes: number[]) => '#' + Buffer.from(bytes).toString('hex');
/** Parse a complete layer using the dispatcher's record sizes. Unknown data rejects. */
function records(hexData: string, kind: C.Layer) {
  if (
    typeof hexData !== 'string' ||
    hexData.length % 2 ||
    !/^[0-9a-f]*$/i.test(hexData) ||
    hexData.length > 8176
  )
    throw Error('Invalid lighting byte string');
  const data = Buffer.from(hexData, 'hex'),
    result = [];
  let offset = 0;
  while (offset < data.length) {
    if (result.length >= 10 || (kind === 'Reactive' && result.length >= 2))
      throw Error('Lighting zone count exceeds capability');
    const start = offset;
    const take = (n: number) => {
      if (offset + n > data.length) throw Error('Truncated lighting record');
      const b = Array.from(data.subarray(offset, offset + n));
      offset += n;
      return b;
    };
    const byte = () => take(1)[0],
      tag = byte(),
      mask = take(18),
      wireKeys = [];
    for (let i = 0; i < 144; i++) if (mask[i >> 3] & (1 << (i & 7))) wireKeys.push(i);
    const gradients = () => {
      const count = byte();
      if (count < 1 || count > 10) throw Error('Invalid gradient count');
      return Array.from({ length: count }, () => take(4));
    };
    let attributes: C.WireAttributes;
    switch (tag) {
      case 1:
        attributes = { color: take(3) };
        break;
      case 2:
      case 11:
        attributes = { orientation: byte(), gradient: gradients() };
        break;
      case 3:
      case 4: {
        const speed = byte(),
          mode = byte();
        attributes = { speed, mode };
        if (tag === 3 && (mode === 3 || mode === 4)) attributes.gradient = gradients();
        else if (tag === 4 && mode === 3) {
          const count = byte();
          if (count < 1 || count > 10) throw Error('Invalid pulse color count');
          attributes.colors = Array.from({ length: count }, () => take(3));
        } else if (mode !== 0 && mode !== 1) throw Error('Unsupported shift/pulse color mode');
        break;
      }
      case 5: {
        attributes = { direction: byte(), speed: byte(), value: byte(), mode: byte() };
        if (attributes.mode === 3 || attributes.mode === 4) attributes.gradient = gradients();
        else if (attributes.mode === 2) attributes.color = take(3);
        else if (attributes.mode !== 0) throw Error('Unsupported wave color mode');
        break;
      }
      case 10: {
        attributes = { direction: byte(), speed: byte(), mode: byte() };
        if (attributes.mode === 3 || attributes.mode === 4) attributes.gradient = gradients();
        else if (attributes.mode !== 0 && attributes.mode !== 1)
          throw Error('Unsupported marquee color mode');
        break;
      }
      case 8: {
        attributes = { speed: byte(), trigger: byte(), mode: byte() };
        if (attributes.mode === 2) attributes.color = take(3);
        else if (attributes.mode !== 0 && attributes.mode !== 1)
          throw Error('Unsupported fade color mode');
        break;
      }
      case 7:
      case 9: {
        attributes = { speed: byte(), trigger: byte(), value: byte(), mode: byte() };
        if (attributes.mode === 3 || attributes.mode === 4) attributes.gradient = gradients();
        else if (attributes.mode === 2) attributes.color = take(3);
        else if (attributes.mode !== 0 && attributes.mode !== 1)
          throw Error('Unsupported reactive color mode');
        break;
      }
      default:
        throw Error('Unknown lighting effect tag ' + tag);
    }
    if (kind === 'Reactive' ? ![7, 8, 9].includes(tag) : [7, 8, 9].includes(tag))
      throw Error('Lighting effect belongs to another layer');
    if (attributes.speed !== undefined && attributes.speed > 100)
      throw Error('Invalid lighting speed');
    if (
      attributes.gradient &&
      (attributes.mode === 4 || tag === 11) &&
      attributes.gradient.some((p, i) => i > 0 && p[3] < required(attributes.gradient)[i - 1][3])
    )
      throw Error('Gradient positions are not ordered');
    result.push({
      tag,
      mask,
      wireKeys,
      attributes,
      rawHex: data.subarray(start, offset).toString('hex'),
    });
  }
  return result;
}
/** Re-encode the parsed wire fields, independently of the retained raw bytes. */
function encodeRecord(record: C.WireLightingRecord) {
  const { tag, mask, attributes: a } = record,
    out = [tag, ...mask];
  const gradient = () => out.push(required(a.gradient).length, ...required(a.gradient).flat());
  switch (tag) {
    case 1:
      out.push(...required(a.color));
      break;
    case 2:
    case 11:
      out.push(required(a.orientation));
      gradient();
      break;
    case 3:
    case 4:
      out.push(required(a.speed), required(a.mode));
      if (a.gradient) gradient();
      if (a.colors) out.push(a.colors.length, ...a.colors.flat());
      break;
    case 5:
      out.push(required(a.direction), required(a.speed), required(a.value), required(a.mode));
      if (a.gradient) gradient();
      if (a.color) out.push(...required(a.color));
      break;
    case 10:
      out.push(required(a.direction), required(a.speed), required(a.mode));
      if (a.gradient) gradient();
      break;
    case 8:
      out.push(required(a.speed), required(a.trigger), required(a.mode));
      if (a.color) out.push(...required(a.color));
      break;
    case 7:
    case 9:
      out.push(required(a.speed), required(a.trigger), required(a.value), required(a.mode));
      if (a.gradient) gradient();
      if (a.color) out.push(...required(a.color));
      break;
    default:
      throw Error('Unknown effect tag');
  }
  return Buffer.from(out).toString('hex');
}
function gradient(stops: number[][], mode: number, id: string) {
  let position = 0;
  const total = stops.reduce((s, p) => s + p[3], 0) + stops.length - 1;
  return stops.map((stop, i) => {
    const value = mode === 3 ? (total ? (position / total) * 100 : 0) : (stop[3] / 255) * 100;
    position += stop[3] + 1;
    return { id: id + '-' + i, color: hex(stop.slice(0, 3)), position: value };
  });
}
function settings(record: C.WireLightingRecord, id: string): C.Effect {
  const { tag, attributes: a } = record,
    speed = { speedPercent: (a.speed ?? Number.NaN) / 100 };
  const color = (withSize = false, flat = false) => {
    if (required(a.mode) === 0 || required(a.mode) === 1)
      return {
        kind: required(a.mode) === 0 ? 'Rainbow' : 'Random',
        ...(withSize ? { value: required(a.value) } : {}),
      };
    if (a.gradient)
      return {
        kind: 'Gradient',
        gradient: gradient(required(a.gradient), required(a.mode), id),
        ...(withSize ? { size: { value: required(a.value) } } : {}),
      };
    return {
      kind: 'Color',
      ...(flat ? rgb(required(a.color)) : { color: rgb(required(a.color)) }),
      ...(withSize ? { size: { value: required(a.value) } } : {}),
    };
  };
  switch (tag) {
    case 1:
      return { layer: 'Base', kind: 'Color', color: rgb(required(a.color)) };
    case 2:
      return {
        layer: 'Base',
        kind: 'SolidGradient',
        direction: enumAt(DIRECTIONS, required(a.orientation), 'direction'),
        gradient: gradient(required(a.gradient), 3, id),
      };
    case 11:
      return {
        layer: 'Base',
        kind: 'SolidGradient2',
        gradientType: enumAt(GRADIENT_TYPES, required(a.orientation), 'gradient type'),
        gradient: gradient(required(a.gradient), 4, id),
      };
    case 3:
      return { layer: 'Base', kind: 'ShiftColor', ...speed, color: color() };
    case 4:
      return {
        layer: 'Base',
        kind: 'PulseColor',
        ...speed,
        color: a.colors ? { kind: 'Colors', colors: a.colors.map(rgb) } : color(),
      };
    case 5:
      return {
        layer: 'Base',
        kind: 'Wave',
        ...speed,
        direction: enumAt(DIRECTIONS, required(a.direction), 'direction'),
        color: color(required(a.mode) !== 4 && required(a.mode) !== 3),
      };
    case 10:
      return {
        layer: 'Base',
        kind: 'CoveringMarquee',
        ...speed,
        direction: enumAt(DIRECTIONS, required(a.direction), 'direction'),
        color: color(),
      };
    case 8:
      return {
        layer: 'Reactive',
        kind: 'Fade',
        ...speed,
        keyEvent: enumAt(TRIGGERS, required(a.trigger), 'trigger'),
        color: color(false, true),
      };
    case 7:
      return {
        layer: 'Reactive',
        kind: 'Ripple',
        ...speed,
        keyEvent: enumAt(TRIGGERS, required(a.trigger), 'trigger'),
        color: color(true),
      };
    case 9:
      return {
        layer: 'Reactive',
        kind: 'Line',
        ...speed,
        keyEvent: enumAt(TRIGGERS, required(a.trigger), 'trigger'),
        color: color(false, true),
      };
  }
  throw Error('Unknown lighting effect tag ' + tag);
}
function decode(raw: C.LightingSnapshot) {
  if (
    raw.status !== 'ok' ||
    raw.firmware !== '2.2.14' ||
    raw.readOnly !== true ||
    raw.settingsWritePerformed !== false
  )
    throw Error('Unverified lighting capture');
  if (
    !Number.isInteger(raw.activeProfileIndex) ||
    raw.activeProfileIndex < 0 ||
    raw.activeProfileIndex > 4 ||
    !Array.isArray(raw.profiles) ||
    raw.profiles.length !== 5
  )
    throw Error('Incomplete lighting capture');
  const seen = new Set(),
    profiles = raw.profiles
      .map((p) => {
        if (
          !Number.isInteger(p.wireIndex) ||
          p.wireIndex < 0 ||
          p.wireIndex > 4 ||
          seen.has(p.wireIndex)
        )
          throw Error('Invalid/duplicate lighting profile');
        seen.add(p.wireIndex);
        if (!Array.isArray(p.layers) || p.layers.length !== 3)
          throw Error('Incomplete lighting layers');
        const layers = p.layers.map((l, i) => {
          if (
            l.kind !== ['Base', 'Ring', 'Reactive'][i] ||
            l.command !== [0x31, 0x34, 0x38][i] ||
            ![1, 2].includes(l.status) ||
            (l.status === 2 && l.data !== '')
          )
            throw Error('Invalid lighting layer contract');
          const decoded = records(l.data, l.kind);
          const zones = decoded.map((record, index) => {
            if (encodeRecord(record) !== record.rawHex)
              throw Error('Lighting record did not round-trip');
            const id = 'device-' + p.wireIndex + '-' + l.kind.toLowerCase() + '-' + index;
            const selected =
              l.kind === 'Ring'
                ? record.wireKeys.filter((k) => k < 45)
                : record.wireKeys
                    .filter((k) => physicalByWire.has(k))
                    .map((k) => required(physicalByWire.get(k)));
            return {
              id,
              ...(l.kind === 'Ring' ? { leds: selected } : { keys: selected }),
              effectSettings: settings(record, id),
            };
          });
          return {
            kind: l.kind,
            zones,
            records: decoded,
            unavailableWireKeys: [
              ...new Set(
                decoded
                  .flatMap((r) => r.wireKeys)
                  .filter((k) => (l.kind === 'Ring' ? k >= 45 : !physicalByWire.has(k))),
              ),
            ],
          };
        });
        return {
          wireIndex: p.wireIndex,
          baseZones: layers[0].zones,
          perimeterZones: layers[1].zones,
          reactiveZones: layers[2].zones,
          layers,
        };
      })
      .sort((a, b) => a.wireIndex - b.wireIndex);
  return {
    firmware: raw.firmware,
    activeProfileIndex: raw.activeProfileIndex,
    profiles,
    readOnly: true,
    settingsWritePerformed: false,
    source: 'direct-hid',
    sampledAt: new Date().toISOString(),
    nativeReadMs: raw.elapsedMs,
  };
}
export { records };
export { encodeRecord };
export { decode };

/** Encode original CAM zone models into the verified normal lighting format. */
function encodeZones(zones: C.Zone[], kind: C.Layer) {
  if (!['Base', 'Ring', 'Reactive'].includes(kind) || !Array.isArray(zones))
    throw Error('Invalid lighting zones');
  // CAM omits Off zones from its native effect maps; removing the assignment turns those LEDs off.
  zones = zones.filter((zone) => zone.effectSettings?.kind !== 'Off');
  if (zones.length > (kind === 'Reactive' ? 2 : 10)) throw Error('Invalid lighting zones');
  const byPhysical = new Map([...physicalByWire].map(([wire, physical]) => [physical, wire]));
  const byte = (v: number | undefined, name: string) => {
    if (v === undefined || !Number.isFinite(v) || v < 0 || v > 255) throw Error('Invalid ' + name);
    return Math.round(v);
  };
  const color = (value: string | C.ColorMode | C.Rgb | undefined) => {
    if (typeof value === 'string') {
      if (!/^#?[0-9a-f]{6}$/i.test(value)) throw Error('Invalid RGB color');
      return [...Buffer.from(value.replace(/^#/, ''), 'hex')];
    }
    return (['r', 'g', 'b'] as const).map((c) => byte(value?.[c], 'RGB channel'));
  };
  const gradient = (stops: C.Stop[] | undefined, mode: number) => {
    if (!Array.isArray(stops) || !stops.length || stops.length > 10)
      throw Error('Invalid gradient stops');
    const positions = stops.map((s) => {
      if (!Number.isFinite(s.position) || s.position < 0 || s.position > 100)
        throw Error('Invalid gradient position');
      return s.position;
    });
    if (positions.some((p, i) => i && p < positions[i - 1]))
      throw Error('Gradient stops not ordered');
    let sizes = positions.map((p) => (p / 100) * 255);
    if (mode === 3) {
      const gaps = positions.map((p, i) => (positions[i + 1] ?? 100) - p),
        scale = 254 / Math.max(1, ...gaps);
      sizes = gaps.map((g) => Math.max(0, Math.round(g * scale) - 1));
    }
    return stops.map((s, i) => [...color(s.color), byte(sizes[i], 'gradient position')]);
  };
  const direction = (list: string[], value: string | undefined) => {
    const index = list.indexOf(value ?? '');
    if (index < 0) throw Error('Invalid lighting direction');
    return index;
  };
  const encoded = zones
    .map((zone) => {
      const mask = Array(18).fill(0),
        selected = kind === 'Ring' ? zone.leds : zone.keys;
      if (!Array.isArray(selected)) throw Error('Missing lighting selection');
      for (const key of selected) {
        const wire = kind === 'Ring' ? key : byPhysical.get(key);
        if (
          wire === undefined ||
          !Number.isInteger(wire) ||
          wire < 0 ||
          wire >= (kind === 'Ring' ? 45 : 144)
        )
          throw Error('Unmapped lighting key ' + key);
        mask[wire >> 3] |= 1 << (wire & 7);
      }
      const s = zone.effectSettings,
        c = s?.color;
      if (!s) throw Error('Missing effect settings');
      const speed = () => {
        if (
          s.speedPercent === undefined ||
          !Number.isFinite(s.speedPercent) ||
          s.speedPercent < 0 ||
          s.speedPercent > 1
        )
          throw Error('Invalid effect speed');
        return Math.round(s.speedPercent * 100);
      };
      const mode = () =>
        c?.kind === 'Rainbow'
          ? 0
          : c?.kind === 'Random'
            ? 1
            : c?.kind === 'Color'
              ? 2
              : c?.kind === 'Gradient'
                ? 4
                : 3;
      const size = () => byte(c?.size?.value ?? c?.value ?? 0, 'effect size');
      const attributes = (withSize = false) => {
        const a: C.WireAttributes = { mode: mode() };
        if (withSize) a.value = size();
        if (a.mode === 4) a.gradient = gradient(required(c).gradient, 4);
        else if (a.mode === 2) a.color = color(required(c).color || c);
        else if (a.mode === 3) {
          if (c?.kind !== 'Colors') throw Error('Unknown lighting color mode');
          a.colors = required(c.colors).map(color);
        }
        return a;
      };
      let tag: number, a: C.WireAttributes;
      switch (s.kind) {
        case 'Color':
          tag = 1;
          a = { color: color(c) };
          break;
        case 'SolidGradient':
          tag = 2;
          a = {
            orientation: direction(DIRECTIONS, s.direction),
            gradient: gradient(s.gradient, 3),
          };
          break;
        case 'SolidGradient2':
          tag = 11;
          a = {
            orientation: direction(GRADIENT_TYPES, s.gradientType),
            gradient: gradient(s.gradient, 4),
          };
          break;
        case 'ShiftColor':
          tag = 3;
          a = { speed: speed(), ...attributes() };
          if (a.mode === 2) {
            a.mode = 4;
            a.gradient = [
              [...required(a.color), 0],
              [...required(a.color), 255],
            ];
            delete a.color;
          }
          break;
        case 'PulseColor':
          tag = 4;
          a = { speed: speed(), ...attributes() };
          if (a.mode === 2) {
            a.mode = 3;
            a.colors = [required(a.color)];
            delete a.color;
          }
          break;
        case 'Wave':
          tag = 5;
          a = {
            direction: direction(DIRECTIONS, s.direction),
            speed: speed(),
            ...attributes(true),
          };
          break;
        case 'CoveringMarquee':
          tag = 10;
          a = { direction: direction(DIRECTIONS, s.direction), speed: speed(), ...attributes() };
          break;
        case 'Fade':
          tag = 8;
          a = { speed: speed(), trigger: direction(TRIGGERS, s.keyEvent), ...attributes() };
          break;
        case 'Ripple':
        case 'Line':
          tag = s.kind === 'Ripple' ? 7 : 9;
          a = { speed: speed(), trigger: direction(TRIGGERS, s.keyEvent), ...attributes(true) };
          break;
        default:
          throw Error('Unsupported lighting effect ' + s.kind);
      }
      return encodeRecord({ tag, mask, attributes: a });
    })
    .join('');
  records(encoded, kind);
  return encoded;
}
export { encodeZones };

/** Firmware may strip mask bits that do not address physical LEDs in slot 4. */
export const equivalent = (left: string, right: string, kind: C.Layer) => {
  const normalized = (data: string) =>
    records(data, kind).map((record) => ({
      tag: record.tag,
      attributes: record.attributes,
      wireKeys: record.wireKeys.filter((key) =>
        kind === 'Ring' ? key < 45 : physicalByWire.has(key),
      ),
    }));
  return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
};
