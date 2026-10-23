const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createTray } = require('../dist/app/main/tray.cjs');

test('tray keeps the window alive, routes pages and pauses output through the shared controller', async () => {
  const app = new EventEmitter(), win = new EventEmitter();
  let menu, hidden = 0, shown = 0, quits = 0, startup, enabled = true;
  const navigation = [];
  Object.assign(app, { quit: () => { quits++; app.emit('before-quit'); },
    getLoginItemSettings: () => ({ openAtLogin: false,
      launchItems: startup?.openAtLogin ? [{ name: startup.name, enabled: true }] : [] }),
    setLoginItemSettings: value => { startup = value; },
  });
  Object.assign(win, { isMinimized: () => false, show: () => { shown++; }, focus: () => {},
    hide: () => { hidden++; }, webContents: { send: (channel, page) => navigation.push([channel, page]) },
  });
  class Tray extends EventEmitter {
    setToolTip(value) { this.tooltip = value; }
    popUpContextMenu(value) { menu = value.items; }
    destroy() { this.destroyed = true; }
  }
  const tray = createTray({ app, Tray, Menu: { buildFromTemplate: items => ({ items }) } }, win, {
    state: () => ({ running: enabled, transitioning: false, settings: { bindings: { 26: { enabled: true } } } }),
    enable: async value => { enabled = value; },
  }, 'E:\\fixture-data', () => {});
  assert.equal(startup, undefined, 'Startup remains opt-in');
  let prevented = false;
  win.emit('close', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(hidden, 1);
  tray.emit('right-click');
  menu.find(item => item.label === 'Profiles…').click();
  assert.deepEqual(navigation.pop(), ['keyboard:navigate', 'profiles']);
  assert.equal(shown, 1);
  assert.equal(menu.find(item => item.label === 'Mapped output').checked, true);
  menu.find(item => item.label === 'Mapped output').click();
  await Promise.resolve();
  assert.equal(enabled, false);
  tray.emit('right-click');
  assert.equal(menu.find(item => item.label === 'Mapped output').checked, false);
  menu.find(item => item.label === 'Start with Windows').click();
  assert.equal(startup.openAtLogin, true);
  assert.ok(startup.args.includes('--hidden'));
  assert.ok(startup.args.includes('"--data-dir=E:\\fixture-data"'));
  assert.ok(startup.path.startsWith('"') && startup.path.endsWith('"'));
  tray.emit('right-click');
  assert.equal(menu.find(item => item.label === 'Start with Windows').checked, true);
  menu.find(item => item.label === 'Start with Windows').click();
  assert.equal(startup.openAtLogin, false);
  tray.emit('right-click');
  assert.equal(menu.find(item => item.label === 'Start with Windows').checked, false);
  menu.find(item => item.label === 'Quit').click();
  assert.equal(quits, 1);
  win.emit('close', { preventDefault: () => assert.fail('Quit must allow the window to close') });
  app.emit('will-quit');
  assert.equal(tray.destroyed, true);
});
