/** Wire contracts shared by settings, profiles, codecs and the native device boundary. */
export type Layer = 'Base' | 'Ring' | 'Reactive';
export type ActuationKind = 'Single' | 'Rapid' | 'Dual';
export type Field =
  | 'brightnessKeys'
  | 'brightnessRing'
  | 'pollingRate'
  | 'gameMode'
  | 'fnLock'
  | 'idleMinutes'
  | 'activeProfile';
export interface FieldEdit {
  field: Field;
  wireIndex: number;
  value: number;
}
export interface FieldRequest extends FieldEdit {
  expectedActive: number;
  expectedValue: number;
}
export interface ReadMetadata {
  status: string;
  firmware: string;
  readOnly: boolean;
  settingsWritePerformed: boolean;
  elapsedMs?: number;
  devicePath?: string;
}
export interface ProfileMetadata {
  wireIndex: number;
  field0: number;
  field3: number;
  field4: number;
  field5: number;
  field7: number;
}
export interface DeviceState extends ReadMetadata {
  activeProfileIndex: number;
  brightnessChannels: number[];
  profiles: ProfileMetadata[];
}
export interface Connection extends ReadMetadata {
  activeProfileIndex: number;
  brightnessChannels: number[];
  gameModeEnabled: boolean;
  fnLockEnabled: boolean;
}
export interface ActuationEdit {
  physicalKey: number;
  kind: ActuationKind;
  levelIndex: number;
  secondLevelIndex: number;
  rapidSensitivityIndex: number;
}
export interface PhysicalLevel {
  valueMicroMeters: number;
  kind?: string;
  [extra: string]: unknown;
}
export interface ActuationConfig {
  kind: ActuationKind;
  level?: PhysicalLevel;
  level1?: PhysicalLevel;
  level2?: PhysicalLevel;
  sensitivity?: PhysicalLevel;
  remap?: Record<string, Remap>;
  remapLevel1?: Record<string, Remap>;
  remapLevel2?: Record<string, Remap>;
}
export interface ActuationWord {
  physicalKey: number;
  sensorId: number;
  label: string;
  rawWord: number;
  levelIndex: number;
  secondLevelIndex: number;
  rapidSensitivityIndex: number;
  config: ActuationConfig;
}
export interface ActuationSnapshot extends ReadMetadata {
  activeProfileIndex: number;
  actuations: ActuationWord[];
}
export interface ActuationInput {
  wireIndex: number;
  keys: ActuationEdit[];
}
export interface ActuationRequest {
  wireIndex: number;
  expectedActive: number;
  keys: { physicalKey: number; expectedWord: number; word: number }[];
}
export interface SoftwareActuationRequest {
  expectedActive: number;
  keys: { physicalKey: number; word: number }[];
}
export interface RemapRead {
  wireIndex: number;
  physicalKeys: number[];
}
export interface RemapRecord {
  physicalKey: number;
  level: number;
  fnLayer: boolean;
  data: string;
}
export interface RemapSnapshot {
  wireIndex: number;
  activeProfileIndex: number;
  records: RemapRecord[];
  source?: string;
}
export interface RemapRawInput extends RemapRecord {
  wireIndex: number;
}
export interface RemapRequest extends RemapRawInput {
  expectedActive: number;
  expectedData: string;
}
  export interface RuntimeRemaps { activeProfileIndex: number; devicePath?: string; data: string }
  export interface RuntimeRemapRequest {
    expectedActive: number;
    expectedData: string;
    data: string;
    restore: boolean;
    keys: SoftwareActuationRequest['keys'] | null;
    snap: string | null;
  }
export type Repeat =
  { kind: 'WhilePressed' } | { kind: 'Infinite' } | { kind: 'Count'; nonZeroCount: number };
export type Remap =
  | { kind: 'SimpleRemap'; targetKeyId: number }
  | { kind: 'Modifier'; modifier: 'Shift' | 'Control' | 'Alt' }
  | {
      kind: 'Macro';
      action: {
        repeatCount: Repeat;
        targetKeys: { targetKeyId: number; state: 'Pressed' | 'Released'; delaySeconds: number }[];
      };
    };
export interface RemapInput {
  wireIndex: number;
  physicalKey: number;
  level: number;
  fnLayer: boolean;
  remap: Remap;
}
export interface SnapConfig {
  physicalKey1: number;
  physicalKey2: number;
  resolutionMethod: 'LastPressed';
  bottomMode: 'EitherOne';
}
export interface SnapSnapshot extends ReadMetadata {
  activeProfileIndex: number;
  profiles: { wireIndex: number; response: string }[];
}
export interface SnapRawInput {
  wireIndex: number;
  data: string;
}
export interface SnapInput {
  wireIndex: number;
  configs: SnapConfig[];
}
export interface SnapRequest extends SnapRawInput {
  expectedActive: number;
  expectedData: string;
}
export interface LightingRawInput {
  wireIndex: number;
  layer: Layer;
  data: string;
}
export interface LightingInput {
  wireIndex: number;
  layer: Layer;
  zones: Zone[];
}
export interface LightingRequest extends LightingRawInput {
  expectedActive: number;
  expectedData: string;
}
export interface LightingSnapshot extends ReadMetadata {
  activeProfileIndex: number;
  profiles: {
    wireIndex: number;
    layers: { kind: Layer; command: number; status: number; data: string }[];
  }[];
}
export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export interface Stop {
  id?: string;
  color: string | Rgb;
  position: number;
}
export interface ColorMode {
  kind?: string;
  color?: string | Rgb;
  gradient?: Stop[];
  colors?: (Rgb | string)[];
  size?: { value: number };
  value?: number;
  r?: number;
  g?: number;
  b?: number;
}
export interface Effect {
  layer?: string;
  kind: string;
  color?: ColorMode;
  speedPercent?: number;
  direction?: string;
  gradientType?: string;
  keyEvent?: string;
  gradient?: Stop[];
}
export interface Zone {
  id?: string;
  keys?: number[];
  leds?: number[];
  effectSettings: Effect;
}
export interface WireAttributes {
  color?: number[];
  gradient?: number[][];
  colors?: number[][];
  orientation?: number;
  speed?: number;
  mode?: number;
  direction?: number;
  value?: number;
  trigger?: number;
}
export interface WireLightingRecord {
  tag: number;
  mask: number[];
  wireKeys?: number[];
  attributes: WireAttributes;
  rawHex?: string;
}
export interface MutationResult<T = unknown> {
  outcome: string;
  error?: string;
  after?: T;
  verification?: string;
  normalizedUnusedMaskBits?: boolean;
  readbackNote?: string;
  [extra: string]: unknown;
}
export interface EditResult extends MutationResult {
  backup: string;
  receipt?: string;
  snapConfigs?: SnapConfig[];
  snapJournal?: string;
  batches?: EditResult[];
}
export interface ActuationResult extends EditResult {
  batches: EditResult[];
}
export interface KeyModel {
  physicalKey: number;
  active: {
    kind: 'Single' | 'Dual';
    actuation: {
      isRapidTrigger?: boolean;
      level?: number;
      level1?: number;
      level2?: number;
      rapidSensitivity?: number;
    };
    remapTo: Remap | Remap[];
    fnPressed?: { remapTo: Remap | Remap[] };
  };
}
export interface ProfileSettings {
  keyBrightness?: number;
  perimeterBrightness?: number;
  pollingRate: string;
  idleTimeout: { disabled: boolean; timeoutSeconds: number };
  gameModeEnabled: boolean;
  fnLockEnabled: boolean;
  baseZones: Zone[];
  perimeterZones: Zone[];
  reactiveZones: Zone[];
}
export interface ProfileInput {
  wireIndex: number;
  settings: ProfileSettings;
  physicalKeys: KeyModel[];
  snapConfigs: SnapConfig[];
}
export interface ProfilePlan {
  wireIndex: number;
  layers: { layer: Layer; data: string }[];
  keys: ActuationEdit[];
  records: RemapRecord[];
  snap: string;
  fields: [Field, number][];
}
export type EditKind = 'field' | 'lighting' | 'actuation' | 'remap' | 'snap';
export interface CompletedEdit {
  kind: EditKind;
  backup: string;
}
export interface ProfileBefore {
  state: DeviceState;
  lighting: LightingSnapshot;
  actuation: ActuationSnapshot;
  remaps: RemapSnapshot;
  snap: SnapSnapshot;
}
export interface SoftwareBefore {
  state: DeviceState;
  lighting: LightingSnapshot;
  remaps: RemapSnapshot;
  snap?: SnapSnapshot;
}
export interface RuntimeReturnTarget {
  wireIndex: number;
  brightnessChannels: number[];
}
export interface SoftwareSession {
  prepared?: boolean;
  lighting?: Record<string,string>;
  schemaVersion: number;
  kind: string;
  returnSlot: number;
  returnTarget?: RuntimeReturnTarget;
  releaseTarget?: RuntimeReturnTarget;
  backup: string;
  before: SoftwareBefore;
  lastInput?: ProfileInput;
  at?: string;
}
export interface SensorKey {
  matrixIndex: number;
  pressed: number;
  threshold: number;
  sensorId: number;
  adc: number;
  baseline: number;
  scale: number;
  [extra: string]: unknown;
}
export interface SensorSnapshot extends ReadMetadata {
  keys: SensorKey[];
  supportedCount?: number;
  metadataAgeMs?: number;
  readMode?: string;
}
export interface CurrentSnapshot extends ReadMetadata {
  keys: { sensorId: number; adc: number }[];
}
export interface DeviceBackend {
    state(wireIndex?: number): Promise<DeviceState>;
  connection(): Promise<Connection>;
  actuation(): Promise<ActuationSnapshot>;
    lighting(wireIndex?: number): Promise<LightingSnapshot>;
    snap(wireIndex?: number): Promise<SnapSnapshot>;
  remaps(request: RemapRead): Promise<RemapSnapshot>;
  applyField(request: FieldRequest): Promise<MutationResult<number>>;
  applyActuation(request: ActuationRequest): Promise<MutationResult<ActuationSnapshot>>;
  applyLighting(request: LightingRequest): Promise<MutationResult<string>>;
  applyRemap(request: RemapRequest): Promise<MutationResult<RemapRecord>>;
  applySnap(request: SnapRequest): Promise<MutationResult<string>>;
  applySoftwareActuation(request: SoftwareActuationRequest): Promise<MutationResult>;
}
export interface Backup<R, B> {
  kind?: string;
  schemaVersion: number;
  request: R;
  before: B;
  snapBefore?: SnapConfig[];
  snapJournal?: string;
}
export interface Layout {
    sensors: Record<string, { physicalKeyId: number; canonicalKey: number; label: string }>;
  rows: { sensorId?: number; code?: number }[][];
}
