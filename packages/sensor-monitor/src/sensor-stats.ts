import type {
  SensorKey,
  MonitorSnapshot,
  DepthCurve,
  CurvePoint,
  NoiseCalibrationResult,
  KeyCalibration,
} from './types.js';
function required<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw Error('Incomplete sensor history');
  return value;
}
interface Frame {
  time: number;
  keys: Map<number, SensorKey>;
  roundTripMs: number;
  nativeReadMs: number | undefined;
}
interface FilterState {
  signature: string;
  values: number[];
  filtered: number;
  time: number;
}
export class SensorHistory {
  windowMs: number;
  maximumFrames: number;
  frames: Frame[];
  constructor(windowMs = 30000, maximumFrames = 600) {
    if (
      !Number.isFinite(windowMs) ||
      windowMs <= 0 ||
      !Number.isInteger(maximumFrames) ||
      maximumFrames < 2
    )
      throw Error('Invalid history limits');
    this.windowMs = windowMs;
    this.maximumFrames = maximumFrames;
    this.frames = [];
  }
  clear() {
    this.frames = [];
  }
  append(snapshot: MonitorSnapshot, time: number) {
    if (!Number.isFinite(time) || (this.frames.length && time <= required(this.frames.at(-1)).time))
      throw Error('Sensor timestamps must increase');
    const keys = new Map<number, SensorKey>();
    for (const key of snapshot.keys) {
      if (
        !Number.isInteger(key.physicalKeyId) ||
        !Number.isFinite(key.adc) ||
        keys.has(key.physicalKeyId)
      )
        throw Error('Invalid raw sensor history');
      keys.set(key.physicalKeyId, { ...key });
    }
    if (keys.size !== 88) throw Error('Incomplete raw sensor history');
    this.frames.push({
      time,
      keys,
      roundTripMs: snapshot.roundTripMs,
      nativeReadMs: snapshot.nativeReadMs,
    });
    while (
      this.frames.length > this.maximumFrames ||
      (this.frames.length > 1 && this.frames[0].time < time - this.windowMs)
    )
      this.frames.shift();
  }
  summary() {
    const n = this.frames.length,
      duration = n > 1 ? required(this.frames.at(-1)).time - this.frames[0].time : 0;
    const intervals = this.frames.slice(1).map((frame, i) => frame.time - this.frames[i].time);
    return {
      samples: n,
      durationMs: duration,
      updatesPerSecond: duration > 0 ? ((n - 1) * 1000) / duration : 0,
      intervalMinMs: intervals.length ? Math.min(...intervals) : null,
      intervalMaxMs: intervals.length ? Math.max(...intervals) : null,
    };
  }
  series(physicalKeyId: number) {
    return this.frames
      .map((frame) => ({
        time: frame.time,
        adc: frame.keys.get(physicalKeyId)?.adc,
        filteredAdc: frame.keys.get(physicalKeyId)?.filteredAdc,
      }))
      .filter((p): p is { time: number; adc: number; filteredAdc: number | undefined } =>
        Number.isFinite(p.adc),
      );
  }
  key(physicalKeyId: number) {
    const values = this.series(physicalKeyId);
    let mean = 0,
      m2 = 0,
      min = Infinity,
      max = -Infinity,
      n = 0;
    for (const { adc } of values) {
      n++;
      const delta = adc - mean;
      mean += delta / n;
      m2 += delta * (adc - mean);
      min = Math.min(min, adc);
      max = Math.max(max, adc);
    }
    return n
      ? {
          samples: n,
          min,
          max,
          mean,
          standardDeviation: Math.sqrt(Math.max(0, m2 / n)),
          peakToPeak: max - min,
        }
      : null;
  }
}
function interpolate(
  value: number,
  points: CurvePoint[],
  input: 'coefficient' | 'micrometres',
  output: 'coefficient' | 'micrometres',
) {
  if (value <= 0) return 0;
  if (value >= required(points.at(-1))[input]) return required(points.at(-1))[output];
  let index = 1;
  while (points[index][input] < value) index++;
  const a = points[index - 1],
    b = points[index];
  return a[output] + ((b[output] - a[output]) * (value - a[input])) / (b[input] - a[input]);
}
export function coefficientAtMillimetres(mm: number, curve: DepthCurve) {
  return interpolate(
    mm * 1000,
    [{ coefficient: 0, micrometres: 0 }, ...curve.points],
    'micrometres',
    'coefficient',
  );
}
/** Signed travel keeps below-baseline noise visible on the logarithmic graph. */
export function millimetresAtCoefficient(coefficient: number, curve: DepthCurve) {
  return Math.sign(coefficient) * interpolate(Math.abs(coefficient),
    [{ coefficient: 0, micrometres: 0 }, ...curve.points], 'coefficient', 'micrometres') / 1000;
}
export function conditioned(
  key: SensorKey,
  calibration: NoiseCalibrationResult | null,
  curve: DepthCurve,
) {
  const c = calibration?.keys?.[key.physicalKeyId];
  // A changed firmware calibration invalidates the captured host correction.
  const valid =
    c && c.sensorId === key.sensorId && c.scale === key.scale && c.factoryBaseline === key.baseline;
  const baseline = valid ? c.mean : key.baseline,
    deadband = 0;
  // Calibration adjusts zero only. Never delay real presses/releases with a noise-study filter.
  const observation = key.adc;
  const coefficient = Math.max(0, (observation - baseline - deadband) / key.scale);
  const millimetres = millimetresAtCoefficient(coefficient, curve);
  return {
    baseline,
    deadband,
    coefficient,
    adc: baseline + coefficient * key.scale,
    millimetres,
    normalized: millimetres / 4,
    calibrated: !!valid,
  };
}
export class NoiseCalibration {
  startedAt: number;
  durationMs: number;
  targets: number[] | null;
  history: SensorHistory;
  curve?: DepthCurve;
  devicePath?: string;
  firmware?: string;
  constructor(startTime: number, options: { durationMs?: number; targets?: number[]; curve?: DepthCurve } = {}) {
    this.startedAt = startTime;
    this.durationMs = options.durationMs || 15000;
    this.targets = options.targets || null;
    this.curve = options.curve;
    this.history = new SensorHistory(this.durationMs + 1000, 2000);
  }
  append(snapshot: MonitorSnapshot, time: number) {
    if (this.history.frames.length && (snapshot.devicePath !== this.devicePath || snapshot.firmware !== this.firmware)) throw Error('Keyboard changed during calibration. Retry.');
    this.devicePath = snapshot.devicePath; this.firmware = snapshot.firmware;
    this.history.append(snapshot, time);
    return time - this.startedAt >= this.durationMs && this.history.frames.length >= 60;
  }
  finish(): NoiseCalibrationResult {
    if (this.history.frames.length < 60 || this.history.summary().durationMs < 2500)
      throw Error('More released-key samples are needed');
    const keys: Record<number, KeyCalibration> = {},
      skipped = [],
      latest = required(this.history.frames.at(-1));
    const quantile = (values: number[], f: number) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.round((sorted.length - 1) * f)];
    };
    for (const [id, key] of latest.keys) {
      if (this.targets && !this.targets.includes(id)) continue;
      const stats = required(this.history.key(id)),
        values = this.history.series(id).map((p) => p.adc),
        third = Math.max(3, Math.floor(values.length / 3));
      const fit = values.slice(0, values.length - third), validation = values.slice(-third);
      const center = quantile(fit, 0.5),
        sigma =
          1.4826 *
          quantile(
            fit.map((v) => Math.abs(v - center)),
            0.5,
          );
      const differences = values.slice(1).map((v, i) => Math.abs(v - values[i]));
      const localNoise = quantile(differences, 0.5) / 0.954;
      const drift = Math.abs(
        quantile(values.slice(0, third), 0.5) - quantile(values.slice(-third), 0.5),
      );
      // Factory baseline can be stale: an offset is what we are calibrating.
      // Detect sustained motion against observed noise, not factory position.
      // A moving key must not discard the other 87 released-key captures.
      const metadataChanged = this.history.frames.some(frame => {
        const sample = frame.keys.get(id);
        return !sample || sample.scale !== key.scale || sample.baseline !== key.baseline || sample.sensorId !== key.sensorId;
      });
      const held = key.pressed > key.baseline && center > key.baseline + (key.pressed - key.baseline) * .5;
      const moved = drift > Math.max(16, key.scale * .15, 8 * localNoise)
        || quantile(values, .95) - quantile(values, .05) > Math.max(32, key.scale * .15, 12 * localNoise);
      if (metadataChanged || held || moved) {
        skipped.push({
          physicalKeyId: id,
          label: key.label || String(id),
          reason: metadataChanged ? 'sensor calibration changed' : held ? 'key held down' : 'movement during capture',
          drift,
          observedNoise: localNoise,
        });
        continue;
      }
      const threshold = this.curve ? key.scale * coefficientAtMillimetres(.1, this.curve) : undefined;
      let restCrossings = 0, wasAbove = false;
      for (const value of validation) {
        const above = threshold !== undefined && value - center >= threshold;
        if (above && !wasAbove) restCrossings++;
        wasAbove = above;
      }
      const noiseBand = Math.max(1, 3 * sigma, quantile(fit, .95) - center);
      keys[id] = {
        sensorId: key.sensorId,
        scale: key.scale,
        factoryBaseline: key.baseline,
        mean: center,
        standardDeviation: sigma,
        rawStandardDeviation: stats.standardDeviation,
        deadband: 0,
        noiseBand,
        samples: stats.samples,
        estimator: 'median-ema',
        medianSamples: 1,
        tauMs: 0,
        assessment: threshold === undefined ? 'noise-measured' : restCrossings ? '0.1-mm-rest-crossings-observed' : 'no-rest-crossings-in-this-capture',
        ...(threshold !== undefined ? { restCrossings, noiseMillimetres: millimetresAtCoefficient(noiseBand / key.scale, this.curve!) } : {}),
      };
    }
    if (!Object.keys(keys).length)
      throw Error('No stable keys captured. Keep keys released and retry.');
    return {
      keys,
      skipped,
      createdAt: new Date().toISOString(),
      durationMs: this.history.summary().durationMs,
      source: 'host released-key noise calibration',
      hardwareWritten: false,
      devicePath: this.devicePath,
      firmware: this.firmware,
    };
  }
}
export class SignalFilter {
  states: Map<number, FilterState>;
  constructor() {
    this.states = new Map();
  }
  apply(
    snapshot: MonitorSnapshot,
    calibration: NoiseCalibrationResult | null,
    time: number,
  ): MonitorSnapshot {
    return {
      ...snapshot,
      keys: snapshot.keys.map((key) => {
        const c = calibration?.keys?.[key.physicalKeyId];
        if (
          !c ||
          c.estimator !== 'median-ema' ||
          c.sensorId !== key.sensorId ||
          c.scale !== key.scale ||
          c.factoryBaseline !== key.baseline
        )
          return { ...key, filteredAdc: undefined };
        const signature = JSON.stringify([
          required(calibration).createdAt,
          c.mean,
          c.medianSamples,
          c.tauMs,
        ]);
        let state = this.states.get(key.physicalKeyId);
        if (!state || state.signature !== signature || time - state.time > 1000) {
          state = { signature, values: [], filtered: c.mean, time };
          this.states.set(key.physicalKeyId, state);
        }
        state.values.push(key.adc);
        if (state.values.length > c.medianSamples) state.values.shift();
        const sorted = [...state.values].sort((a, b) => a - b),
          sample = sorted[Math.floor(sorted.length / 2)];
        const alpha = c.tauMs ? 1 - Math.exp(-Math.max(0, time - state.time) / c.tauMs) : 1;
        state.filtered += alpha * (sample - state.filtered);
        state.time = time;
        return { ...key, filteredAdc: state.filtered };
      }),
    };
  }
}
