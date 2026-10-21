import type * as C from './contracts.cjs';
import { required } from './validation.cjs';
import * as remapsModule from './remaps.cjs';

const mapping: Map<number, number> = remapsModule.physicalToWire,
  byWire = new Map([...mapping].map(([hid, wire]) => [wire, hid]));
function decode(raw: C.SnapSnapshot) {
  return raw.profiles.map((profile) => {
    const bytes = Buffer.from(profile.response, 'hex');
    if (
      bytes.length !== 18 ||
      bytes[0] !== 1 ||
      bytes[1] !== (profile.wireIndex === 4 ? 255 : profile.wireIndex) ||
      bytes[2] !== 3
    )
      throw Error('Invalid snap readback');
    const configs: C.SnapConfig[] = [];
    for (let i = 3; i < 18; i += 5) {
      if (!bytes[i]) continue;
      if (
        bytes[i] !== 1 ||
        bytes[i + 1] !== 0 ||
        bytes[i + 2] !== 0 ||
        !byWire.has(bytes[i + 3]) ||
        !byWire.has(bytes[i + 4])
      )
        throw Error('Unrecognized stored snap configuration');
      configs.push({
        physicalKey1: required(byWire.get(bytes[i + 3])),
        physicalKey2: required(byWire.get(bytes[i + 4])),
        resolutionMethod: 'LastPressed',
        bottomMode: 'EitherOne',
      });
    }
    return { wireIndex: profile.wireIndex, data: bytes.subarray(3).toString('hex'), configs };
  });
}
function encode(configs: C.SnapConfig[]) {
  if (!Array.isArray(configs) || configs.length > 3)
    throw Error('At most three snap pairs are supported');
  const data = Buffer.alloc(15),
    seen = new Set();
  configs.forEach((config, index) => {
    if (config.resolutionMethod !== 'LastPressed' || config.bottomMode !== 'EitherOne')
      throw Error('Unsupported snap method');
    const keys = [config.physicalKey1, config.physicalKey2];
    for (const key of keys) {
      if (!mapping.has(key) || seen.has(key)) throw Error('Invalid or duplicate snap key');
      seen.add(key);
    }
    data.set([1, 0, 0, ...keys.map((key) => required(mapping.get(key)))], index * 5);
  });
  return data.toString('hex');
}
/** Firmware discards key fields in disabled records; they carry no setting. */
function normalize(data: string): string {
  if (!/^[0-9a-f]{30}$/i.test(data)) throw Error('Invalid snap data');
  const bytes = Buffer.from(data, 'hex');
  for (let offset = 0; offset < 15; offset += 5)
    if (bytes[offset] === 0) bytes.fill(0, offset, offset + 5);
  return bytes.toString('hex');
}
export { decode, encode, normalize };
