import type { History } from 'history';
import type { KeyboardHost } from '../../contracts/desktop-host.cjs';
import type * as C from '../../backend/src/contracts.cjs';
import type {
  ApplicationStateCoordinator,
  StateTicket,
} from '../../application-state/src/index.js';
import type {
  DeviceControls,
  DeviceEditIntent,
  DeviceEditOutcome,
} from '../../renderer-state/src/device-controls.js';
import type {
  MonitorDiagnostics,
  DeviceStateSnapshot,
} from '../../sensor-monitor/src/types.js';
import type { Device, KeyboardModel, RemapModel } from './model-types.js';
import type { KeyboardUiStores } from '../../keyboard-ui/src/models/KeyboardUiStores.js';

export interface HardwareSync {
  source: 'Rust';
  hardwareProfiles: number;
  actuationKeys: number;
  activeWireSlot: number;
  completeProfile: false;
  completeActiveProfile: true;
  inactiveActuationSource: string;
  allProfilesRead: boolean;
  deviceSettingsLinked: boolean;
  remapRecords: number;
}
export interface RendererDiagnostics extends MonitorDiagnostics {
  lastError: string | null;
  discovery?: Awaited<ReturnType<KeyboardHost['devices']>>;
  deviceState?: DeviceStateSnapshot | null;
  nativeActuation?: Awaited<ReturnType<KeyboardHost['actuation']>>;
  nativeRemaps?: Awaited<ReturnType<KeyboardHost['remaps']>>;
  hardwareSync?: HardwareSync;
  importedDeviceValues?: {
    source: string;
    wireIndex: number;
    sampledAt: string;
    backup: string | null;
    fields: string[];
  };
  lastDeviceEdit?: C.EditResult;
}
export interface ProfileSync {
  isHardwareProfileLoaded(slot: number): boolean;
  syncHardwareProfiles(ownerTicket?: StateTicket): Promise<HardwareSync>;
  syncLiveValues(
    value: import('../../renderer-state/src/device-controls.js').LiveControls,
    ownerTicket?: StateTicket,
  ): void;
  invalidateHardwareCache(slot?: number): void;
  dispose(): void;
}
export interface RendererApi extends ProfileSync {
  history: History;
  stores: KeyboardUiStores;
  keyboard: KeyboardModel;
  remap: RemapModel;
  device: Device;
  ui: RendererContext['ui'];
  render(): void;
  discover(): Promise<Awaited<ReturnType<KeyboardHost['devices']>>>;
  importDeviceState(
    value: DeviceStateSnapshot,
    wireIndex?: number,
  ): Promise<string | null>;
  flushSave(): Promise<unknown>;
  save(): void;
  resetError(): void;
  report(): void;
  connectDeviceControls(): DeviceControls;
}
/** Explicit composition root. Imported modules share this instance; it is never a global registry. */
export interface RendererContext {
  host: KeyboardHost;
  keyboard: KeyboardModel;
  remap: RemapModel;
  device: Device;
  ui: { depth: boolean; tools: boolean; deviceState: boolean; analogue: boolean; status: string; saving:boolean };
  diagnostics: RendererDiagnostics;
  state: ApplicationStateCoordinator<DeviceEditIntent, DeviceEditOutcome>;
  deviceControls: DeviceControls | null;
  api: RendererApi;
  profiles: import('./profiles.js').Profiles;
  setStatusLabel(message: string): void;
}
/** Composition publishes the actual instance; normal launches expose no mutable globals. */
export let activeContext: RendererContext | null = null;
export function publishContext(context: RendererContext): void {
  activeContext = context;
}

declare global {
  interface Window {
    keyboardHost: KeyboardHost;
  }
}
