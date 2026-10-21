import { registrar } from '../../contracts/desktop-channels.cjs';
import type { Electron } from '../../contracts/desktop-platform.cjs';
import { object, jsonObject, errorMessage } from '../../contracts/desktop.cjs';
import * as sessionPolicy from '../../backend/src/session-policy.cjs';
import * as devicesModule from '../../backend/src/devices.cjs';
import * as appDataModule from './main/app-data.cjs';
import * as diagnosticsModule from './main/diagnostics.cjs';
import * as deviceLifecycleModule from './main/device-lifecycle.cjs';
import * as macroRecorderModule from './main/macro-recorder.cjs';
import * as keyboardIpcModule from './main/keyboard-ipc.cjs';
import { createAnalogue } from './main/analogue.cjs';
import { watchApplications } from './main/applications.cjs';
import { createTray } from './main/tray.cjs';
('use strict');
// Owned host with an independent allowlisted HID backend; no original CAM addon/helper.
const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  Tray,
  Menu,
}: Pick<Electron, 'app' | 'BrowserWindow' | 'ipcMain' | 'session' | 'Tray' | 'Menu'> = require('electron');
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const testing = process.argv.includes('--keyboard-test');
const { profile, dataRoot } = appDataModule.configure(app, testing);
const hidden = process.argv.includes('--hidden');
app.setName('Function Elite OpenTKL');
app.setAppUserModelId('FunctionElite.OpenTKL');
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
const { record, report } = diagnosticsModule.createDiagnostics(profile);
process.on('uncaughtException', (error) => {
  record('main-error', error.stack ?? errorMessage(error));
  report({
    status: 'failed',
    error: error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => devicesModule.stop());
app
  .whenReady()
  .then(async () => {
    sessionPolicy.protect(session.defaultSession, profile);
    let analogue: ReturnType<typeof createAnalogue> | undefined;
    const serial = await deviceLifecycleModule.createDeviceLifecycle({
      app,
      profile,
      record,
      beforeShutdown: () => analogue?.stopInside(),
    });
    const win = new BrowserWindow({
      show: !testing && !hidden,
      width: 1440,
      height: 960,
      minWidth: 1100,
      minHeight: 740,
      backgroundColor: '#131316',
      title: 'Function Elite OpenTKL',
      icon: path.join(__dirname, '../resources/icons/app.png'),
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: '#111114', symbolColor: '#b9b7c5', height: 40 },
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });
    win.removeMenu();
    analogue = createAnalogue(profile, serial);
    analogue.register(ipcMain, win);
    if (!testing) createTray({ app, Tray, Menu }, win, analogue, dataRoot, record);
    app.on('second-instance', () => {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    });
    const handle = registrar(ipcMain);
    handle('keyboard:lifecycle-status', () => serial.status());
    const unsubscribeLifecycle = serial.subscribe((snapshot) => {
      if (!win.isDestroyed()) win.webContents.send('keyboard:lifecycle-event', snapshot);
    });
    win.on('closed', unsubscribeLifecycle);

    macroRecorderModule.registerMacroRecorder({
      app,
      win,
      ipcMain,
      record,
    });
    handle('keyboard:monitor-preview', async () => {
      if (!testing) throw Error('Preview capture is available only to integration checks');
      const image = await win.webContents.capturePage();
      const output = path.join(profile, 'monitor-preview.png');
      fs.writeFileSync(output, image.toPNG());
      return output;
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(pathToFileURL(__dirname).href + '/')) event.preventDefault();
    });
    win.webContents.on('console-message', (_event, level, message) =>
      record('console', { level, message: message.slice(0, 4000) }),
    );
    win.webContents.on('did-start-loading', () => report({ status: 'starting' }));
    win.webContents.on('render-process-gone', (_event, detail) => {
      report({ status: 'failed', error: detail });
      void serial(() => analogue?.stopInside()).catch((error) => record('analogue-recovery-pending', errorMessage(error)));
    });
    keyboardIpcModule.registerKeyboardIpc({
      ipcMain,
      profile,
      win,
      serial,
      record,
      analogue,
      retryRecovery: serial.retryRecovery,
    });
    if (!testing) watchApplications(app, win);
    ipcMain.on('keyboard:report', (_event, value) => {
      const parsed = jsonObject(value);
      record('renderer', parsed);
      report(parsed);
    });
    ipcMain.on('keyboard:diagnostic', (_event, value) => record('diagnostic', jsonObject(value)));
    let deadline: NodeJS.Timeout | undefined;
    ipcMain.on('keyboard:test-report', (_event, value) => {
      if (!testing) return;
      clearTimeout(deadline);
      fs.writeFileSync(
        path.join(profile, 'test-report.json'),
        JSON.stringify(
          { ...jsonObject(value), at: new Date().toISOString(), pid: process.pid },
          null,
          2,
        ),
      );
      win.close();
    });
    if (testing)
      deadline = setTimeout(
        () => {
          report({ status: 'failed', error: 'Renderer test timeout' });
          fs.writeFileSync(
            path.join(profile, 'test-report.json'),
            JSON.stringify({
              status: 'failed',
              cases: [{ name: 'renderer', status: 'failed', error: '60-second timeout' }],
            }),
          );
          win.close();
        },
        process.argv.includes('--keyboard-live-test') ? 120000 : 60000,
      );
    const query: Record<string, string> = {
      ...(process.argv.includes('--keyboard-parity-test') ? { parity: '1' } : {}),
      ...(testing ? { test: '1' } : {}),
      ...(process.argv.includes('--keyboard-brightness-test') ? { brightness: '1' } : {}),
      ...(process.argv.includes('--keyboard-live-test') ? { live: '1' } : {}),
      ...(process.argv.includes('--keyboard-analogue-test') ? { analogueTest: '1' } : {}),
      ...(process.argv.includes('--keyboard-depth') ? { depth: '1' } : {}),
      ...(process.argv.includes('--keyboard-analogue') ? { analogue: '1' } : {}),
      ...(process.argv.includes('--keyboard-profiles') ? { profiles:'1' } : {}),
      ...(process.argv.includes('--keyboard-state') ? { state: '1' } : {}),
    };
    if (testing) {
      const checksBundle = process.env.NZXT_HE_CHECKS_BUNDLE;
      if (!checksBundle || !path.isAbsolute(checksBundle) || !fs.statSync(checksBundle).isFile())
        throw Error('Test launch requires NZXT_HE_CHECKS_BUNDLE pointing to a local check bundle');
      query.checks = pathToFileURL(checksBundle).href;
      const verificationToken = process.env.NZXT_HE_VERIFICATION_TOKEN;
      if (!verificationToken) throw Error('Test launch requires NZXT_HE_VERIFICATION_TOKEN');
      query.verificationToken = verificationToken;
    }
    await win.loadFile(path.join(__dirname, 'index.html'), { query });
    if (process.argv.includes('--keyboard-capture'))
      setTimeout(async () => {
        try {
          const image = await win.webContents.capturePage();
          fs.writeFileSync(path.join(profile, 'monitor-visible.png'), image.toPNG());
        } catch (error) {
          record('capture-error', errorMessage(error));
        }
      }, 12000);
    if (!testing && !hidden) win.show();
    win.on('closed', () => clearTimeout(deadline));
  })
  .catch((error) => {
    report({
      status: 'failed',
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
    app.quit();
  });
