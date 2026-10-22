import type { KeyboardHost } from './desktop-host.cjs';
import type { IpcEvent, IpcRegistrar } from './desktop-platform.cjs';

export const channels = {
  'keyboard:update-status': 'updateStatus',
  'keyboard:check-updates': 'checkForUpdates',
  'keyboard:download-update': 'downloadUpdate',
  'keyboard:install-update': 'installUpdate',
  'keyboard:copy-analogue-profile': 'copyAnalogueProfile',
  'keyboard:remove-analogue-profile': 'removeAnalogueProfile',
  'keyboard:profile-library': 'profileLibrary',
  'keyboard:save-profile-library': 'saveProfileLibrary',
  'keyboard:applications': 'applications',
  'keyboard:browse-application': 'browseApplication',
  'keyboard:import-profile-document': 'importProfileDocument',
  'keyboard:analogue-state': 'analogueState',
  'keyboard:analogue-profile': 'analogueProfile',
  'keyboard:analogue-save': 'analogueSave',
  'keyboard:analogue-enable': 'analogueEnable',
  'keyboard:analogue-shortcut-capture': 'analogueShortcutCapture',
  'keyboard:analogue-calibrate': 'analogueCalibrate',
  'keyboard:analogue-import': 'analogueImport',
  'keyboard:analogue-export': 'analogueExport',
  'keyboard:lifecycle-status': 'lifecycleStatus',
  'keyboard:all-profile-configs': 'allProfileConfigs',
  'keyboard:recover-backup': 'recoverBackup',
  'keyboard:apply-software-profile': 'applySoftwareProfile',
  'keyboard:prepare-software-profile': 'prepareSoftwareProfile',
  'keyboard:release-software-profile': 'releaseSoftwareProfile',
  'keyboard:connection': 'connection',
  'keyboard:restore-profile': 'restoreProfile',
  'keyboard:apply-profile': 'applyProfile',
  'keyboard:export-profiles': 'exportProfiles',
  'keyboard:import-profiles': 'importProfiles',
  'keyboard:snap': 'snap',
  'keyboard:apply-snap': 'applySnap',
  'keyboard:restore-snap': 'restoreSnap',
  'keyboard:record-macro-start': 'startMacroRecording',
  'keyboard:record-macro-stop': 'stopMacroRecording',
  'keyboard:remaps': 'remaps',
  'keyboard:apply-remap': 'applyRemap',
  'keyboard:restore-remap': 'restoreRemap',
  'keyboard:apply-actuation': 'applyActuation',
  'keyboard:restore-actuation': 'restoreActuation',
  'keyboard:apply-lighting': 'applyLighting',
  'keyboard:restore-lighting': 'restoreLighting',
  'keyboard:apply-field': 'applyField',
  'keyboard:restore-field': 'restoreField',
  'keyboard:monitor-preview': 'monitorPreview',
  'keyboard:read': 'read',
  'keyboard:checkpoint': 'checkpoint',
  'keyboard:write': 'write',
  'keyboard:devices': 'devices',
  'keyboard:firmware': 'firmware',
  'keyboard:sensors': 'sensors',
  'keyboard:state': 'state',
  'keyboard:actuation': 'actuation',
} as const satisfies Record<string, keyof KeyboardHost>;
export type Channel = keyof typeof channels;
type Result<K extends Channel> = Awaited<ReturnType<KeyboardHost[(typeof channels)[K]]>>;
/** Check each handler result against the public host contract; input remains unknown until parsed. */
export function registrar(ipc: IpcRegistrar) {
  return <K extends Channel>(
    channel: K,
    handler: (event: IpcEvent, input: unknown) => Result<K> | Promise<Result<K>>,
  ): void => {
    ipc.handle(channel, handler);
  };
}
