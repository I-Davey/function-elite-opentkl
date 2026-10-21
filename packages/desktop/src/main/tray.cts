import path from 'node:path';
import type { Electron, Window, RecordEvent } from '../../../contracts/desktop-platform.cjs';
import type { createAnalogue } from './analogue.cjs';
import { errorMessage } from '../../../contracts/desktop.cjs';

/** The window stays alive so application rules and analogue controls keep running. */
export function createTray(
  { app, Tray, Menu }: Pick<Electron, 'app' | 'Tray' | 'Menu'>,
  win: Window,
  analogue: Pick<ReturnType<typeof createAnalogue>, 'state' | 'enable'>,
  dataRoot: string,
  record: RecordEvent,
) {
  const tray = new Tray(path.join(__dirname, '../../resources/icons/app.ico'));
  const startup = {
    path: process.execPath,
    args: [
      ...(path.basename(process.execPath).toLowerCase() === 'electron.exe' ? [path.resolve(__dirname, '..')] : []),
      '--hidden', '--data-dir=' + dataRoot,
    ],
  };
  let quitting = false;
  const open = () => {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  };
  const navigate = (page: 'profiles' | 'analogue') => {
    open();
    win.webContents.send('keyboard:navigate', page);
  };
  tray.setToolTip('Function Elite OpenTKL');
  tray.on('click', open);
  tray.on('double-click', open);
  tray.on('right-click', () => {
    const state = analogue.state();
    tray.popUpContextMenu(Menu.buildFromTemplate([
      { label: 'Open OpenTKL', click: open },
      { label: 'Profiles…', click: () => navigate('profiles') },
      { type: 'separator' },
      { label: 'Controller output', type: 'checkbox', checked: state.running,
        enabled: Object.values(state.settings.bindings).some(binding => binding.enabled) && !state.transitioning,
        click: () => { void analogue.enable(!state.running).catch(error => {
          record('tray-controller-error', errorMessage(error));
          navigate('analogue');
        }); },
      },
      { label: 'Analogue controls…', click: () => navigate('analogue') },
      { type: 'separator' },
      { label: 'Start with Windows', type: 'checkbox', checked: app.getLoginItemSettings(startup).openAtLogin,
        click: () => {
          try {
            app.setLoginItemSettings({ ...startup, name: 'Function Elite OpenTKL',
              openAtLogin: !app.getLoginItemSettings(startup).openAtLogin });
          } catch (error) { record('startup-error', errorMessage(error)); open(); }
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]));
  });
  app.on('before-quit', () => { quitting = true; });
  win.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });
  // Windows shutdown must not be treated as a request to hide the window.
  win.on('session-end', () => { quitting = true; app.quit(); });
  app.on('will-quit', () => tray.destroy());
  return tray;
}
