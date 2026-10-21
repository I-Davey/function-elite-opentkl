import type * as React from 'react';
import type { KeyboardHost } from '../../contracts/desktop-host.cjs';
import type { KeyboardRowsProps, KeyWrapperProps, KeyPreviewProps } from '../../keyboard-ui/src/components/KeyboardRows.js';
import type { KeyGeometry, KeyboardLayout } from '../../keyboard-ui/src/layouts/types.js';
import type { KeyboardTheme } from '../../keyboard-ui/src/theme/types.js';
export type SensorSnapshot = Awaited<ReturnType<KeyboardHost['sensors']>>;
export type SensorKey = SensorSnapshot['keys'][number] & { filteredAdc?: number };
export type MonitorSnapshot = Omit<SensorSnapshot, 'keys'> & { keys: SensorKey[] };
export interface CurvePoint {
  /** Original firmware-table index, where the source capture records it. */
  slot?: number;
  coefficient: number;
  micrometres: number;
}
export interface DepthCurve {
  points: CurvePoint[];
}
export interface KeyCalibration {
  sensorId: number;
  scale: number;
  factoryBaseline: number;
  mean: number;
  standardDeviation: number;
  /** Older saved studies predate these two additional noise diagnostics. */
  rawStandardDeviation?: number;
  deadband: number;
  noiseBand?: number;
  samples: number;
  estimator: 'median-ema';
  medianSamples: number;
  tauMs: number;
  assessment: string;
  restCrossings?: number;
  noiseMillimetres?: number;
}
export interface NoiseCalibrationResult {
  keys: Record<number, KeyCalibration>;
  skipped: {
    physicalKeyId: number;
    label: string;
    reason: string;
    drift: number;
    observedNoise: number;
  }[];
  createdAt: string;
  durationMs: number;
  source: string;
  hardwareWritten: false;
  devicePath?: string;
  firmware?: string;
}
export interface HistorySummary {
  samples: number;
  durationMs: number;
  updatesPerSecond: number;
  intervalMinMs: number | null;
  intervalMaxMs: number | null;
}
export interface RestStudy {
  calibration: NoiseCalibrationResult;
  frames: number;
  rateHz: number;
  perKey: {
    physicalKeyId: number;
    key: string;
    targetAdcAssumption: number;
    chosen: { medianSamples: number; tauMs: number; heldOutFalseActivations: number };
  }[];
}
export interface MonitorDiagnostics {
  depthSnapshot?: MonitorSnapshot | null;
  depthStatistics?: HistorySummary | null;
  depthConnection?: {
    status: 'paused' | 'live' | 'error';
    sampledAt?: string;
    roundTripMs?: number;
    error?: string;
  };
  sensorNoiseCalibration?: NoiseCalibrationResult | null;
}
export type KeyItem = KeyGeometry;
export type KeyWrapper = KeyWrapperProps;
export type RowsProps = KeyboardRowsProps;
export type KeyProps = KeyPreviewProps;
export interface KeyboardViewPort {
  Rows: React.ComponentType<RowsProps>;
  Wrapper: React.ComponentType<KeyWrapper & { children?: React.ReactNode }>;
  Key: React.ComponentType<KeyProps>;
  layout: KeyboardLayout;
  theme: KeyboardTheme;
  keyboardInfo: { layout: string; region: string };
}
export interface SensorMonitorContext {
  host: Pick<KeyboardHost, 'sensors'>;
  curve: DepthCurve;
  keyboardView: KeyboardViewPort;
  diagnostics: MonitorDiagnostics;
  restStudy?: RestStudy | null;
  report(): void;
  setStatusLabel(text: string): void;
}
export type DeviceStateSnapshot = Awaited<ReturnType<KeyboardHost['state']>>;
export interface DeviceStateContext {
  host: Pick<KeyboardHost, 'state'>;
  initialState?: DeviceStateSnapshot | null;
  updateState(state: DeviceStateSnapshot): void;
  importDeviceState(state: DeviceStateSnapshot, slot: number): Promise<void>;
  report(): void;
}
