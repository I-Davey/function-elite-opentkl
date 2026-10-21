'use strict';
import type { Electron, IpcEvent } from '../../contracts/desktop-platform.cjs';
import type { KeyboardHost } from '../../contracts/desktop-host.cjs';
import type { MacroEvent, DesktopLifecycleSnapshot } from '../../contracts/desktop.cjs';
import type { ApplicationSnapshot } from '../../contracts/desktop-profiles.cjs';
const {
  contextBridge,
  ipcRenderer,
}: Pick<Electron, 'contextBridge' | 'ipcRenderer'> = require('electron');
/** Main owns response validation. This is the single Electron transport boundary. */
const invoke = <T,>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>;
const host: KeyboardHost = {
  analogueState: () => invoke('keyboard:analogue-state'),
  analogueProfile: (id) => invoke('keyboard:analogue-profile', id),
  analogueSave: (settings, profileId) => invoke('keyboard:analogue-save', profileId ? { settings, profileId } : settings),
  copyAnalogueProfile: (source, target) => invoke('keyboard:copy-analogue-profile', { source, target }),
  removeAnalogueProfile: (id) => invoke('keyboard:remove-analogue-profile', id),
  profileLibrary: () => invoke('keyboard:profile-library'),
  saveProfileLibrary: (value) => invoke('keyboard:save-profile-library', value),
  applications: () => invoke('keyboard:applications'),
  browseApplication: () => invoke('keyboard:browse-application'),
  importProfileDocument: (value) => invoke('keyboard:import-profile-document', value),
  onApplications: (callback) => {
    const listener = (_event: IpcEvent, value: unknown) => {
      if (value && typeof value === 'object' && Array.isArray((value as ApplicationSnapshot).running)) callback(value as ApplicationSnapshot);
    };
    ipcRenderer.on('keyboard:applications-event', listener);
    return () => ipcRenderer.removeListener('keyboard:applications-event', listener);
  },
  analogueEnable: (enabled) => invoke('keyboard:analogue-enable', enabled),
  analogueShortcutCapture: (capturing) => invoke('keyboard:analogue-shortcut-capture', capturing),
  analogueCalibrate: (request) => invoke('keyboard:analogue-calibrate', request),
  analogueImport: () => invoke('keyboard:analogue-import'),
  analogueExport: () => invoke('keyboard:analogue-export'),
  lifecycleStatus: () => invoke('keyboard:lifecycle-status'),
  onLifecycleEvent: (callback) => {
    const listener = (_event: IpcEvent, value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const row = value as Partial<DesktopLifecycleSnapshot>;
      if (
        !['ready', 'closing', 'closed'].includes(row.phase ?? '') ||
        typeof row.pendingTransactions !== 'number' ||
        !row.recovery ||
        !['waiting', 'running', 'complete', 'failed'].includes(row.recovery.status)
      )
        return;
      if (
        (row.recovery.error !== null && typeof row.recovery.error !== 'string') ||
        (row.recovery.reason !== null && typeof row.recovery.reason !== 'string')
      )
        return;
      callback(row as DesktopLifecycleSnapshot);
    };
    ipcRenderer.on('keyboard:lifecycle-event', listener);
    return () => ipcRenderer.removeListener('keyboard:lifecycle-event', listener);
  },
  allProfileConfigs: () => invoke('keyboard:all-profile-configs'),
  recoverBackup: () => invoke('keyboard:recover-backup'),
  applySoftwareProfile: (input) => invoke('keyboard:apply-software-profile', input),
  prepareSoftwareProfile: () => invoke('keyboard:prepare-software-profile'),
  releaseSoftwareProfile: () => invoke('keyboard:release-software-profile'),
  connection: () => invoke('keyboard:connection'),
  restoreProfile: (backup) => invoke('keyboard:restore-profile', backup),
  applyProfile: (value) => invoke('keyboard:apply-profile', value),
  exportProfiles: () => invoke('keyboard:export-profiles'),
  importProfiles: () => invoke('keyboard:import-profiles'),
  snap: () => invoke('keyboard:snap'),
  applySnap: (value) => invoke('keyboard:apply-snap', value),
  restoreSnap: (backup) => invoke('keyboard:restore-snap', backup),
  startMacroRecording: () => invoke('keyboard:record-macro-start'),
  stopMacroRecording: () => invoke('keyboard:record-macro-stop'),
  onMacroEvent: (callback) => {
    const listener = (_event: IpcEvent, value: unknown) => {
      if (value === null) {
        callback(null);
        return;
      }
      if (!value || typeof value !== 'object') return;
      const row = value as Partial<MacroEvent>;
      if (
        typeof row.hidKey !== 'number' ||
        !Number.isInteger(row.hidKey) ||
        (row.state !== 'Pressed' && row.state !== 'Released') ||
        typeof row.timestamp !== 'number' ||
        !Number.isFinite(row.timestamp)
      )
        return;
      callback({ hidKey: row.hidKey, state: row.state, timestamp: row.timestamp });
    };
    ipcRenderer.on('keyboard:macro-event', listener);
    return () => ipcRenderer.removeListener('keyboard:macro-event', listener);
  },
  remaps: (slot) => invoke('keyboard:remaps', slot),
  applyRemap: (value) => invoke('keyboard:apply-remap', value),
  restoreRemap: (backup) => invoke('keyboard:restore-remap', backup),
  applyActuation: (value) => invoke('keyboard:apply-actuation', value),
  restoreActuation: (backup) => invoke('keyboard:restore-actuation', backup),
  applyLighting: (value) => invoke('keyboard:apply-lighting', value),
  restoreLighting: (backup) => invoke('keyboard:restore-lighting', backup),
  applyField: (value) => invoke('keyboard:apply-field', value),
  restoreField: (backup) => invoke('keyboard:restore-field', backup),
  monitorPreview: () => invoke('keyboard:monitor-preview'),
  read: () => invoke('keyboard:read'),
  checkpoint: () => invoke('keyboard:checkpoint'),
  write: (value) => invoke('keyboard:write', value),
  devices: () => invoke('keyboard:devices'),
  firmware: () => invoke('keyboard:firmware'),
  sensors: () => invoke('keyboard:sensors'),
  state: () => invoke('keyboard:state'),
  actuation: () => invoke('keyboard:actuation'),
  report: (value) => ipcRenderer.send('keyboard:report', value),
  diagnostic: (value) => ipcRenderer.send('keyboard:diagnostic', value),
  testReport: (value) => ipcRenderer.send('keyboard:test-report', value),
};
contextBridge.exposeInMainWorld('keyboardHost', Object.freeze(host));
