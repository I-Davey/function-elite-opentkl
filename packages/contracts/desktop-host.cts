import type * as C from '../backend/src/contracts.cjs';
import type {
  StoredProfiles,
  MacroEvent,
  JsonObject,
  DesktopLifecycleSnapshot,
} from './desktop.cjs';

/** Public desktop API: every invocation has a named request and response. */
export interface KeyboardHost {
  analogueState(): Promise<import('./desktop-analogue.cjs').AnalogueState>;
  analogueProfile(id: string): Promise<import('./desktop-analogue.cjs').AnalogueState>;
  analogueSave(settings: import('./desktop-analogue.cjs').AnalogueProfile, profileId?: string): Promise<import('./desktop-analogue.cjs').AnalogueState>;
  copyAnalogueProfile(source: string, target: string): Promise<void>;
  removeAnalogueProfile(id: string): Promise<void>;
  profileLibrary(): Promise<import('./desktop-profiles.cjs').ProfileLibrary>;
  saveProfileLibrary(value: import('./desktop-profiles.cjs').ProfileLibrary): Promise<import('./desktop-profiles.cjs').ProfileLibrary>;
  applications(): Promise<import('./desktop-profiles.cjs').ApplicationSnapshot>;
  browseApplication(): Promise<import('./desktop-profiles.cjs').AppAssociation | null>;
  onApplications(callback: (value: import('./desktop-profiles.cjs').ApplicationSnapshot) => void): () => void;
  importProfileDocument(value: StoredProfiles): Promise<boolean>;
  analogueEnable(enabled: boolean): Promise<import('./desktop-analogue.cjs').AnalogueState>;
  analogueShortcutCapture(capturing: boolean): Promise<void>;
  analogueCalibrate(request: import('./desktop-analogue.cjs').CalibrationRequest): Promise<import('./desktop-analogue.cjs').AnalogueState>;
  analogueImport(): Promise<import('./desktop-analogue.cjs').AnalogueState | null>;
  analogueExport(): Promise<string | null>;
  lifecycleStatus(): Promise<DesktopLifecycleSnapshot>;
  onLifecycleEvent(callback: (event: DesktopLifecycleSnapshot) => void): () => void;
  allProfileConfigs(): Promise<
    Awaited<ReturnType<typeof import('../backend/src/profile-reader.cjs').read>>
  >;
  recoverBackup(): Promise<C.MutationResult | null>;
  applySoftwareProfile(input: C.ProfileInput): Promise<C.EditResult>;
  prepareSoftwareProfile(): Promise<void>;
  releaseSoftwareProfile(): Promise<C.MutationResult>;
  connection(): Promise<C.Connection>;
  restoreProfile(backup: string): Promise<C.EditResult>;
  applyProfile(input: C.ProfileInput): Promise<C.EditResult>;
  exportProfiles(): Promise<string | null>;
  importProfiles(): Promise<StoredProfiles | null>;
  snap(): Promise<ReturnType<typeof import('../backend/src/snap.cjs').decode>>;
  applySnap(input: C.SnapInput): Promise<C.EditResult>;
  restoreSnap(backup: string): Promise<C.EditResult>;
  startMacroRecording(): Promise<boolean>;
  stopMacroRecording(): Promise<boolean>;
  onMacroEvent(callback: (event: MacroEvent | null) => void): () => void;
  remaps(
    slot: number,
  ): Promise<
    C.RemapSnapshot & {
      configs: ReturnType<typeof import('../backend/src/remaps.cjs').coreConfigs>;
    }
  >;
  applyRemap(input: C.RemapInput): Promise<C.EditResult>;
  restoreRemap(backup: string): Promise<C.EditResult>;
  applyActuation(input: C.ActuationInput): Promise<C.EditResult>;
  restoreActuation(backup: string): Promise<C.EditResult>;
  applyLighting(input: C.LightingInput): Promise<C.EditResult>;
  restoreLighting(backup: string): Promise<C.EditResult>;
  applyField(input: C.FieldEdit): Promise<C.EditResult>;
  restoreField(backup: string): Promise<C.EditResult>;
  monitorPreview(): Promise<string>;
  read(): Promise<StoredProfiles>;
  checkpoint(): Promise<string | null>;
  write(value: StoredProfiles): Promise<boolean>;
  devices(): Promise<Awaited<ReturnType<typeof import('../backend/src/devices.cjs').enumerate>>>;
  firmware(): Promise<{ firmware: string; readOnly: boolean; settingsWritePerformed: boolean }>;
  sensors(): Promise<
    ReturnType<typeof import('../backend/src/depth.cjs').decode> & { roundTripMs: number }
  >;
  state(): Promise<
    ReturnType<typeof import('../backend/src/state.cjs').decode> & {
      lighting: ReturnType<typeof import('../backend/src/lighting.cjs').decode>;
      roundTripMs: number;
      backup: string;
    }
  >;
  actuation(): Promise<C.ActuationSnapshot & { source: 'direct-hid'; backup: string }>;
  report(value: JsonObject): void;
  diagnostic(value: JsonObject): void;
  testReport(value: JsonObject): void;
}
