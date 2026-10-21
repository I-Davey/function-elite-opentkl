import type { RecordEvent } from '../../../contracts/desktop-platform.cjs';
import { object } from '../../../contracts/desktop.cjs';

import fs from 'node:fs';
import path from 'node:path';
/** Keep diagnostics bounded while preserving a recent rotated log. */
export function createDiagnostics(profile: string) {
  const file = path.join(profile, 'events.jsonl');
  const record: RecordEvent = (kind, detail) => {
    if (fs.existsSync(file) && fs.statSync(file).size > 5 * 1024 * 1024) {
      fs.copyFileSync(file, file + '.previous');
      fs.truncateSync(file, 0);
    }
    fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), kind, detail }) + '\n');
  };
  const report = (detail: unknown) =>
    fs.writeFileSync(
      path.join(profile, 'runtime-report.json'),
      JSON.stringify(
        { ...object(detail, 'diagnostic report'), pid: process.pid, at: new Date().toISOString() },
        null,
        2,
      ),
    );
  return { record, report };
}
