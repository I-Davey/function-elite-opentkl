import type * as C from './contracts.cjs';
import { asError, required, readJson } from './validation.cjs';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
/** Source-built Rust keyboard backend. The renderer receives named operations,
 * never raw reports, native handles or the retained CAM addon. */
function verifiedExecutable() {
  const project = path.resolve(__dirname, '..'),
    component = path.join(project, 'native/keyboard-core');
  const build = readJson<{
      nativeLanguage: string;
      output: string;
      outputSha256: string;
      sourceInputs: { file: string; sha256: string }[];
    }>(fs.readFileSync(path.join(component, 'build-report.json'), 'utf8')),
    executable = path.join(project, build.output);
  if (
    build.nativeLanguage !== 'Rust' ||
    crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex') !==
      build.outputSha256
  )
    throw Error('Rust keyboard backend hash changed; rebuild required');
  for (const input of build.sourceInputs)
    if (
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(component, input.file)))
        .digest('hex') !== input.sha256
    )
      throw Error('Rust keyboard sources changed; rebuild required');
  return executable;
}
import type { Operation } from './native-replies.cjs';
const { DeviceHost } =
  require('./driver-host.cjs') as typeof import('../../device-client/src/driver-host.cjs');
const host = new DeviceHost(verifiedExecutable);
process.once('exit', () => host.stop());
import { nativeReply, type Replies } from './native-replies.cjs';
const run = async <O extends Operation>(mode: O, payload?: unknown): Promise<Replies[O]> => {
  const value = nativeReply(mode, await host.request(mode, payload));
  if (mode.startsWith('--apply-') && mode !== '--apply-runtime-lighting') calibration = null;
  return value;
};
const worker = { request: run };
export const diagnostics = (): {
  launches: number;
  queued: number;
  inFlight: Operation | null;
  samples: { operation: string; queueMs: number; operationMs: number }[];
} => host.diagnostics();
export const enumerate = () => run('--enumerate');
export const firmware = () => run('--version');
// Cache calibration metadata briefly, never live ADC. Every fast read still
// opens the device and verifies firmware. Disconnect/read errors discard cache.
let calibration: C.SensorSnapshot | null = null,
  calibrationAt = 0;
export const sensors = async (): Promise<C.SensorSnapshot> => {
  try {
    if (!calibration || Date.now() - calibrationAt >= 5000) {
      calibration = await worker.request('--sensors');
      calibrationAt = Date.now();
      return { ...calibration, metadataAgeMs: 0, readMode: 'full-calibration' };
    }
    const current = await worker.request('--current');
    if (current.devicePath !== calibration.devicePath) {
      calibration = null;
      return sensors();
    }
    const needed = new Set(calibration.keys.map((key) => key.sensorId));
    const byId = new Map<number, number>();
    for (const key of current.keys) {
      if (!needed.has(key.sensorId)) continue;
      if (byId.has(key.sensorId)) throw Error('Duplicate current sensor');
      byId.set(key.sensorId, key.adc);
    }
    const keys = calibration.keys.map((key) => {
      const adc = required(byId.get(key.sensorId));
      if (!Number.isInteger(adc) || adc < 0 || adc > 65535) throw Error('Missing current ADC');
      return { ...key, adc };
    });
    return {
      ...current,
      keys,
      supportedCount: keys.length,
      metadataAgeMs: Date.now() - calibrationAt,
      readMode: 'fresh-adc-cached-calibration',
    };
  } catch (caught) {
    const error = asError(caught);
    calibration = null;
    throw error;
  }
};
export const state = () => run('--state');
export const lighting = () => run('--lighting');
export const actuation = () => run('--actuation');
export const applyField = (request: C.FieldRequest) => run('--apply-field', request);
export const applyActuation = (request: C.ActuationRequest) => run('--apply-actuation', request);
export const applyLighting = (request: C.LightingRequest) => run('--apply-lighting', request);
export const applyRuntimeLighting = (request: C.LightingRequest) => run('--apply-runtime-lighting', request);
export const remaps = (request: C.RemapRead) => run('--remaps', request);
export const stop = () => {
  calibration = null;
  host.stop();
};

export const applyRemap = (request: C.RemapRequest) => run('--apply-remap', request);

export const executable = verifiedExecutable;

export const snap = () => run('--snap');

export const applySnap = (request: C.SnapRequest) => run('--apply-snap', request);

export const connection = () => run('--connection');

export const applySoftwareActuation = (request: C.SoftwareActuationRequest) =>
  run('--apply-software-actuation', request);
