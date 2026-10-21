/* Bounded raw history and statistics shared by the monitor and Node checks. */
(function (root) {
  'use strict';
  class SensorHistory {
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
    append(snapshot, time) {
      if (!Number.isFinite(time) || (this.frames.length && time <= this.frames.at(-1).time))
        throw Error('Sensor timestamps must increase');
      const keys = new Map();
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
        duration = n > 1 ? this.frames.at(-1).time - this.frames[0].time : 0;
      const intervals = this.frames.slice(1).map((frame, i) => frame.time - this.frames[i].time);
      return {
        samples: n,
        durationMs: duration,
        updatesPerSecond: duration > 0 ? ((n - 1) * 1000) / duration : 0,
        intervalMinMs: intervals.length ? Math.min(...intervals) : null,
        intervalMaxMs: intervals.length ? Math.max(...intervals) : null,
      };
    }
    series(physicalKeyId) {
      return this.frames
        .map((frame) => ({
          time: frame.time,
          adc: frame.keys.get(physicalKeyId)?.adc,
          filteredAdc: frame.keys.get(physicalKeyId)?.filteredAdc,
        }))
        .filter((p) => Number.isFinite(p.adc));
    }
    key(physicalKeyId) {
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
  function interpolate(value, points, input, output) {
    if (value <= 0) return 0;
    if (value >= points.at(-1)[input]) return points.at(-1)[output];
    let index = 1;
    while (points[index][input] < value) index++;
    const a = points[index - 1],
      b = points[index];
    return a[output] + ((b[output] - a[output]) * (value - a[input])) / (b[input] - a[input]);
  }
  function coefficientAtMillimetres(mm, curve) {
    return interpolate(
      mm * 1000,
      [{ coefficient: 0, micrometres: 0 }, ...curve.points],
      'micrometres',
      'coefficient',
    );
  }
  function conditioned(key, calibration, curve) {
    const c = calibration?.keys?.[key.physicalKeyId];
    // A changed firmware calibration invalidates the captured host correction.
    const valid =
      c &&
      c.sensorId === key.sensorId &&
      c.scale === key.scale &&
      c.factoryBaseline === key.baseline;
    const baseline = valid ? c.mean : key.baseline,
      deadband = valid ? c.deadband : 0;
    const observation =
      valid && c.estimator === 'median-ema' && Number.isFinite(key.filteredAdc)
        ? key.filteredAdc
        : key.adc;
    const coefficient = Math.max(0, (observation - baseline - deadband) / key.scale);
    const millimetres =
      interpolate(
        coefficient,
        [{ coefficient: 0, micrometres: 0 }, ...curve.points],
        'coefficient',
        'micrometres',
      ) / 1000;
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
  class NoiseCalibration {
    constructor(startTime, options = {}) {
      this.startedAt = startTime;
      this.durationMs = options.durationMs || 15000;
      this.targets = options.targets || null;
      this.history = new SensorHistory(this.durationMs + 1000, 2000);
    }
    append(snapshot, time) {
      this.history.append(snapshot, time);
      return time - this.startedAt >= this.durationMs && this.history.frames.length >= 12;
    }
    finish() {
      if (this.history.frames.length < 12 || this.history.summary().durationMs < 2500)
        throw Error('More released-key samples are needed');
      const keys = {},
        skipped = [],
        latest = this.history.frames.at(-1);
      const quantile = (values, f) => {
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.round((sorted.length - 1) * f)];
      };
      for (const [id, key] of latest.keys) {
        if (this.targets && !this.targets.includes(id)) continue;
        const stats = this.history.key(id),
          values = this.history.series(id).map((p) => p.adc),
          third = Math.max(3, Math.floor(values.length / 3));
        const center = quantile(values, 0.5),
          sigma =
            1.4826 *
            quantile(
              values.map((v) => Math.abs(v - center)),
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
        if (drift > Math.max(16, key.scale * 0.15, 8 * localNoise)) {
          skipped.push({
            physicalKeyId: id,
            label: key.label || String(id),
            reason: 'sustained movement',
            drift,
            observedNoise: localNoise,
          });
          continue;
        }
        keys[id] = {
          sensorId: key.sensorId,
          scale: key.scale,
          factoryBaseline: key.baseline,
          mean: center,
          standardDeviation: sigma,
          rawStandardDeviation: stats.standardDeviation,
          deadband: 0,
          noiseBand: Math.max(1, 3 * sigma, quantile(values, 0.95) - center),
          samples: stats.samples,
          estimator: 'median-ema',
          medianSamples: 3,
          tauMs: 100,
          assessment: 'not-validated-for-0.1-mm',
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
      };
    }
  }
  class SignalFilter {
    constructor() {
      this.states = new Map();
    }
    apply(snapshot, calibration, time) {
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
            calibration.createdAt,
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
  const api = Object.freeze({
    SensorHistory,
    NoiseCalibration,
    SignalFilter,
    conditioned,
    coefficientAtMillimetres,
  });
  root.KeyboardSensorStats = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis === 'object' ? globalThis : this);
