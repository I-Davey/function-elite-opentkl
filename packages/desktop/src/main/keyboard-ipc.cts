import { registrar } from '../../../contracts/desktop-channels.cjs';
import type {
  IpcRegistrar,
  Window,
  Serial,
  RecordEvent,
  Electron,
} from '../../../contracts/desktop-platform.cjs';
import type { MutationResult } from '../../../backend/src/contracts.cjs';
import { object, backupPath, integer } from '../../../contracts/desktop.cjs';
import * as request from '../../../contracts/desktop-requests.cjs';
interface KeyboardIpcOptions {
  ipcMain: IpcRegistrar;
  profile: string;
  win: Window;
  serial: Serial;
  record: RecordEvent;
  analogue: ReturnType<typeof import('./analogue.cjs').createAnalogue>;
  retryRecovery?: () => Promise<void>;
}
import * as devicesModule from '../../../backend/src/devices.cjs';
import * as softwareProfilesModule from '../../../backend/src/software-profiles.cjs';
import * as profileReaderModule from '../../../backend/src/profile-reader.cjs';
import * as profilesModule from '../../../backend/src/profiles.cjs';
import * as snapModule from '../../../backend/src/snap.cjs';
import * as settingsModule from '../../../backend/src/settings.cjs';
import * as remapsModule from '../../../backend/src/remaps.cjs';
import * as depthModule from '../../../backend/src/depth.cjs';
import * as stateModule from '../../../backend/src/state.cjs';
import * as lightingModule from '../../../backend/src/lighting.cjs';
import * as profileStoreModule from './profile-store.cjs';
import { parseLibrary, profileId } from '../../../contracts/desktop-profiles.cjs';
import { applications } from './applications.cjs';
('use strict');
import fs from 'node:fs';
import path from 'node:path';
/** Register configuration/profile IPC; serial owns whole transactions. */
export function registerKeyboardIpc({
  ipcMain,
  profile,
  win,
  serial,
  record,
  analogue,
  retryRecovery,
}: KeyboardIpcOptions): void {
  const handle = registrar(ipcMain);
  const configure: Serial = (operation) => serial(async () => {
    const resume = await analogue.beforeConfiguration();
    const result = await operation();
    await resume();
    return result;
  });
  const store = new profileStoreModule.ProfileStore(profile);
  handle('keyboard:profile-library', () => parseLibrary(store.read().profileLibrary ?? {}));
  handle('keyboard:save-profile-library', (_event, value) => {
    const library = parseLibrary(value); store.writeExtra('profileLibrary', library); return library;
  });
  handle('keyboard:applications', () => applications());
  handle('keyboard:browse-application', async () => {
    const { dialog }: Pick<Electron, 'dialog'> = require('electron');
    const chosen = await dialog.showOpenDialog(win, {title:'Link application',properties:['openFile'],filters:[{name:'Windows application',extensions:['exe']}]});
    if (chosen.canceled || !chosen.filePaths[0]) return null;
    const file = chosen.filePaths[0];
    const app = {path:file,name:path.basename(file),mode:'focused' as const};
    parseLibrary({associations:{selected:[app]}}); return app;
  });
  handle('keyboard:copy-analogue-profile', (_event, value) => serial(async () => {
    const row = object(value); await analogue.copyProfile(profileId(row.source), profileId(row.target));
  }));
  handle('keyboard:remove-analogue-profile', (_event, value) => serial(async () => analogue.removeProfile(profileId(value))));
  handle('keyboard:import-profile-document', (_event, value) => serial(async()=>{
    profileStoreModule.validate(value);
    await analogue.stopInside();
    const result=store.write(value,true);await analogue.reloadProfiles();return result;
  }));
  const file = store.file;
  handle('keyboard:read', () => store.read());
  handle('keyboard:checkpoint', () => store.checkpoint());
  handle('keyboard:devices', async () => {
    const result = await devicesModule.enumerate();
    record('hid-descriptors', {
      interfaces: Array.isArray(result.interfaces) ? result.interfaces.length : 0,
      reportIoPerformed: result.reportIoPerformed,
    });
    return result;
  });
  handle('keyboard:restore-profile', (_event, backup) =>
    configure(() => profilesModule.restore(profile, backupPath(backup))),
  );
  handle('keyboard:apply-software-profile', (_event, input) =>
    configure(() => softwareProfilesModule.apply(profile, request.profileEdit(input))),
  );
  handle('keyboard:prepare-software-profile', () => serial(()=>softwareProfilesModule.prepare(profile)));
  handle('keyboard:release-software-profile', () =>
    configure(() => softwareProfilesModule.release(profile)),
  );
  handle('keyboard:apply-profile', (_event, input) =>
    configure(() => profilesModule.apply(profile, request.profileEdit(input))),
  );
  handle('keyboard:recover-backup', () =>
    configure(async () => {
      const { dialog }: Pick<Electron, 'dialog'> = require('electron');
      const chosen = await dialog.showOpenDialog(win, {
        title: 'Restore a keyboard backup',
        defaultPath: path.join(profile, 'device-edits'),
        properties: ['openFile'],
        filters: [{ name: 'Device backups', extensions: ['json'] }],
      });
      if (chosen.canceled) return null;
      const target = path.resolve(chosen.filePaths[0] ?? ''),
        folder = path.resolve(profile, 'device-edits');
      if (path.dirname(target) !== folder || !target.endsWith('-before.json'))
        throw Error('Choose a before.json backup from this app profile');
      const saved = object(JSON.parse(fs.readFileSync(target, 'utf8')), 'backup'),
        backup = 'device-edits/' + path.basename(target),
        settings = settingsModule;
      const restorers: Record<
        string,
        ((profile: string, backup: string) => Promise<MutationResult>) | undefined
      > = {
        actuation: settings.restoreActuation,
        lighting: settings.restoreLighting,
        remap: settings.restoreRemap,
        snap: settings.restoreSnap,
        profile: profilesModule.restore,
      };
      const restore =
        (typeof saved.kind === 'string' ? restorers[saved.kind] : undefined) ||
        (!saved.kind && saved.request && object(saved.request).field ? settings.restore : null);
      if (saved.kind === 'software-session') {
        if (!fs.existsSync(path.join(profile, 'software-session.json')))
          fs.writeFileSync(path.join(profile, 'software-session.json'), JSON.stringify(saved));
        return softwareProfilesModule.release(profile);
      }
      if (!restore) throw Error('Unrecognized backup');
      return restore(profile, backup);
    }),
  );
  handle('keyboard:export-profiles', async () => {
    const { dialog }: Pick<Electron, 'dialog'> = require('electron');
    const selected = await dialog.showSaveDialog(win, {
      title: 'Export keyboard profiles',
      defaultPath: path.join(profile, 'keyboard-profiles.json'),
      filters: [{ name: 'Keyboard profiles', extensions: ['json'] }],
    });
    if (selected.canceled) return null;
    if (!selected.filePath) throw Error('Export path unavailable');
    fs.writeFileSync(selected.filePath, JSON.stringify(store.read(), null, 2));
    return selected.filePath;
  });
  handle('keyboard:import-profiles', async () => {
    const { dialog }: Pick<Electron, 'dialog'> = require('electron');
    const selected = await dialog.showOpenDialog(win, {
      title: 'Import keyboard profiles',
      properties: ['openFile'],
      filters: [{ name: 'Keyboard profiles', extensions: ['json'] }],
    });
    if (selected.canceled) return null;
    const target = selected.filePaths[0];
    if (!target) throw Error('Import path unavailable');
    return store.importFile(target);
  });
  handle('keyboard:all-profile-configs', () => configure(() => profileReaderModule.read(profile)));
  handle('keyboard:connection', async () => {
    await retryRecovery?.();
    return serial(async () => {
    const connection = await devicesModule.connection();
    await analogue.observeConnection(connection);
    return connection;
    });
  });
  handle('keyboard:snap', () => serial(async () => snapModule.decode(await devicesModule.snap())));
  handle('keyboard:apply-snap', (_event, input) =>
    configure(() => settingsModule.applySnap(profile, request.snapEdit(input))),
  );
  handle('keyboard:restore-snap', (_event, backup) =>
    configure(() => settingsModule.restoreSnap(profile, backupPath(backup))),
  );
  handle('keyboard:remaps', (_event, slot) =>
    configure(async () => {
      const snapshot = await remapsModule.readSlot(integer(slot, 0, 4, 'profile slot'));
      const actuation = await devicesModule.actuation();
      return {
        ...snapshot,
        configs: remapsModule.coreConfigs(snapshot, actuation),
      };
    }),
  );
  handle('keyboard:apply-remap', (_event, input) =>
    configure(() => settingsModule.applyRemap(profile, request.remapEdit(input))),
  );
  handle('keyboard:restore-remap', (_event, backup) =>
    configure(() => settingsModule.restoreRemap(profile, backupPath(backup))),
  );
  handle('keyboard:apply-field', (_event, input) =>
    configure(() => settingsModule.apply(profile, request.fieldEdit(input))),
  );
  handle('keyboard:restore-field', (_event, backup) =>
    configure(() => settingsModule.restore(profile, backupPath(backup))),
  );
  handle('keyboard:apply-actuation', (_event, input) =>
    configure(() => settingsModule.applyActuation(profile, request.actuationEdit(input))),
  );
  handle('keyboard:restore-actuation', (_event, backup) =>
    configure(() => settingsModule.restoreActuation(profile, backupPath(backup))),
  );
  handle('keyboard:apply-lighting', (_event, input) =>
    configure(() => settingsModule.applyLighting(profile, request.lightingEdit(input))),
  );
  handle('keyboard:restore-lighting', (_event, backup) =>
    configure(() => settingsModule.restoreLighting(profile, backupPath(backup))),
  );
  handle('keyboard:firmware', () =>
    serial(async () => {
      const result = await devicesModule.firmware();
      if (
        typeof result.firmware !== 'string' ||
        typeof result.readOnly !== 'boolean' ||
        typeof result.settingsWritePerformed !== 'boolean'
      )
        throw Error('Invalid firmware response');
      record('firmware-read', {
        firmware: result.firmware,
        settingsWritePerformed: result.settingsWritePerformed,
      });
      return {
        firmware: result.firmware,
        readOnly: result.readOnly,
        settingsWritePerformed: result.settingsWritePerformed,
      };
    }),
  );
  handle('keyboard:sensors', () =>
    serial(async () => {
      const live = analogue.latest();
      if (live) return live;
      const started = Date.now(),
        snapshot = await devicesModule.sensors();
      return {
        ...depthModule.decode(snapshot),
        roundTripMs: Date.now() - started,
      };
    }),
  );
  handle('keyboard:actuation', () =>
    serial(async () => {
      const result = await devicesModule.actuation();
      const directory = path.join(profile, 'hardware-state');
      fs.mkdirSync(directory, { recursive: true });
      const backup = 'actuation-' + new Date().toISOString().replaceAll(':', '-') + '.json';
      fs.writeFileSync(path.join(directory, backup), JSON.stringify(result, null, 2), {
        flag: 'wx',
      });
      return { ...result, source: 'direct-hid', backup: 'hardware-state/' + backup };
    }),
  );
  handle('keyboard:state', () =>
    serial(async () => {
      const started = Date.now(),
        backend = devicesModule,
        raw = await backend.state(),
        decoded = stateModule.decode(raw);
      const rawLighting = await backend.lighting(),
        lighting = lightingModule.decode(rawLighting);
      if (lighting.activeProfileIndex !== decoded.activeProfile.wireIndex)
        throw Error('Keyboard profile changed between metadata and lighting reads; retry');
      const directory = path.join(profile, 'hardware-state');
      fs.mkdirSync(directory, { recursive: true });
      const backup = 'state-' + new Date().toISOString().replaceAll(':', '-') + '.json';
      fs.writeFileSync(
        path.join(directory, backup),
        JSON.stringify(
          { capturedAt: new Date().toISOString(), raw, rawLighting, decoded, lighting },
          null,
          2,
        ),
        { flag: 'wx' },
      );
      record('device-state-read', {
        firmware: decoded.firmware,
        activeProfile: decoded.activeProfile.wireIndex,
        backup,
        settingsWritePerformed: false,
      });
      return {
        ...decoded,
        lighting,
        roundTripMs: Date.now() - started,
        backup: 'hardware-state/' + backup,
      };
    }),
  );
  handle('keyboard:write', (_event, value) => store.write(value));
}
