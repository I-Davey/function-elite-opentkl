import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
/** Persist original state or a receipt before a transaction advances. */
function durable(file: string, value: unknown) {
  const fd = fs.openSync(file, 'wx');
  try {
    fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/** Replace a mutable session journal without truncating its last good backup. */
function replaceDurable(file: string, value: unknown) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    durable(temporary, value);
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export { durable, replaceDurable };
