import type * as C from './contracts.cjs';
import { required } from './validation.cjs';

// Invert the documented stock 2.2.14 Hall-sensor threshold curve. Travel is an
// estimate; below 0.6 mm it is extrapolated and has not been physically calibrated.
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './validation.cjs';
const curve = readJson<{ points: { coefficient: number; micrometres: number }[] }>(
  fs.readFileSync(path.join(__dirname, '../resources/keyboard/depth-curve.json'), 'utf8'),
);
const layout = readJson<C.Layout>(
  fs.readFileSync(path.join(__dirname, '../resources/keyboard/key-layout.json'), 'utf8'),
);
const points = [{ coefficient: 0, micrometres: 0 }, ...curve.points];
export const fullCoefficient = required(points.at(-1)).coefficient;
export function estimate(coefficient: number): number {
  if (coefficient <= 0) return 0;
  if (coefficient >= fullCoefficient) return 4;
  let upper = 1;
  while (points[upper].coefficient < coefficient) upper++;
  const a = points[upper - 1], b = points[upper];
  return (a.micrometres + (b.micrometres - a.micrometres) * (coefficient - a.coefficient) / (b.coefficient - a.coefficient)) / 1000;
}
export const decode = (snapshot: C.SensorSnapshot) => {
  if (
    snapshot.firmware !== '2.2.14' ||
    snapshot.readOnly !== true ||
    snapshot.settingsWritePerformed !== false
  )
    throw Error('Unsupported live-depth snapshot');
  const seen = new Set();
  const keys = snapshot.keys.map((raw) => {
    if (
      !Number.isInteger(raw.sensorId) ||
      !Number.isFinite(raw.adc) ||
      !Number.isFinite(raw.baseline) ||
      !Number.isFinite(raw.scale) ||
      raw.scale <= 0
    )
      throw Error('Invalid sensor record');
    const physical = layout.sensors[String(raw.sensorId)];
    if (!physical) throw Error('Unmapped sensor ' + raw.sensorId);
    if (seen.has(physical.physicalKeyId)) throw Error('Duplicate physical-key mapping');
    seen.add(physical.physicalKeyId);
    const coefficient = (raw.adc - raw.baseline) / raw.scale;
    const millimetres = estimate(coefficient);
    return {
      ...raw,
      physicalKeyId: physical.physicalKeyId,
      label: physical.label,
      coefficient,
      millimetresEstimate: millimetres,
      depthNormalized: millimetres / 4,
    };
  });
  if (keys.length !== 88) throw Error('Expected 88 mapped physical keys, received ' + keys.length);
  return {
    status: 'live',
    firmware: snapshot.firmware,
    devicePath: snapshot.devicePath,
    keys,
    supportedCount: keys.length,
    readOnly: true,
    settingsWritePerformed: false,
    nativeReadMs: snapshot.elapsedMs,
    metadataAgeMs: snapshot.metadataAgeMs || 0,
    readMode: snapshot.readMode || 'full-calibration',
    sampledAt: new Date().toISOString(),
  };
};
