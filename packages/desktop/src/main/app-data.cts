import type { App } from '../../../contracts/desktop-platform.cjs';

import fs from 'node:fs';
import path from 'node:path';
/** User data is independent of installed application code; launchers can select an E-drive root. */
export function configure(app: Pick<App, 'setPath' | 'getPath'>, testing: boolean) {
  const dataRoot = path.resolve(
    process.argv.find(arg => arg.startsWith('--data-dir='))?.slice('--data-dir='.length) ||
    process.env.NZXT_HE_DATA_DIR || path.join(app.getPath('appData'), 'NZXT HE Keyboard'),
  );
  const profile = path.join(dataRoot, testing ? 'test-profile' : 'profile');
  fs.mkdirSync(profile, { recursive: true });
  for (const name of ['userData', 'sessionData', 'logs', 'crashDumps'] as const) {
    const dir = path.join(profile, name);
    fs.mkdirSync(dir, { recursive: true });
    app.setPath(name, dir);
  }
  return { profile, dataRoot };
}
