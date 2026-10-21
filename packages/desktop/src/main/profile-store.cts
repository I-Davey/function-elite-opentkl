import {
  jsonObject,
  object,
  errorMessage,
  type ProfileDocument,
  type StoredProfiles,
} from '../../../contracts/desktop.cjs';

import fs from 'node:fs';
import path from 'node:path';
import { parseProfile } from '../../../contracts/desktop-analogue.cjs';
import { parseLibrary } from '../../../contracts/desktop-profiles.cjs';
const MAX_BYTES = 4_000_000;
/** Stored/imported snapshots remain schema v1 so existing profiles round-trip exactly. */
export function validate(input: unknown): StoredProfiles {
  const value = jsonObject(input);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Invalid profile document');
  if (Object.keys(value).length === 0) return {};
  if (value.schemaVersion !== 1 || !value.keyboard || !value.remap)
    throw Error('Unsupported or incomplete profile schema');
  if (
    !Array.isArray(object(value.keyboard).softwareProfiles) ||
    typeof object(value.keyboard).activeProfileId !== 'string'
  )
    throw Error('Invalid keyboard profile collection');
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text) > MAX_BYTES) throw Error('Profile size limit exceeded');
  object(value.remap, 'remap profile collection');
  const keyboard = object(value.keyboard);
  for (const profile of keyboard.softwareProfiles as unknown[]) object(profile, 'software profile');
  if (value.analogueProfiles) for (const item of Object.values(object(value.analogueProfiles))) parseProfile(item);
  if (value.profileLibrary) parseLibrary(value.profileLibrary);
  return value as ProfileDocument;
}
export class ProfileStore {
  readonly file: string;
  constructor(readonly directory: string) {
    this.file = path.join(directory, 'profiles.json');
  }
  read() {
    if (!fs.existsSync(this.file)) return {};
    if (fs.statSync(this.file).size > MAX_BYTES) throw Error('Stored profile exceeds size limit');
    try {
      const value = validate(JSON.parse(fs.readFileSync(this.file, 'utf8')));
      const legacy = path.join(this.directory, 'analogue-profiles.json');
      if (!value.analogueProfiles && fs.existsSync(legacy)) {
        const saved = object(JSON.parse(fs.readFileSync(legacy, 'utf8')));
        value.analogueProfiles = jsonObject(saved.profiles);
        validate(value);
      }
      return value;
    } catch (error) {
      throw Error('Profile recovery required; saved data was retained: ' + errorMessage(error));
    }
  }
  write(value: unknown, replaceExtras = false): boolean {
    const next = validate(value), current = this.read();
    if (!replaceExtras && next.schemaVersion === 1) for (const key of ['analogueProfiles', 'profileLibrary'])
      if (current[key]) next[key] = current[key];
    const text = JSON.stringify(validate(next));
    const temporary = this.file + '.tmp';
    const fd = fs.openSync(temporary, 'w');
    try {
      fs.writeFileSync(fd, text);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.file + '.bak');
    fs.renameSync(temporary, this.file);
    return true;
  }
  writeExtra(key: 'analogueProfiles' | 'profileLibrary', value: unknown) {
    const next = this.read();
    if (next.schemaVersion !== 1) throw Error('Create a keyboard profile before saving its settings');
    next[key] = jsonObject(value);
    this.write(next, true);
  }
  checkpoint() {
    if (!fs.existsSync(this.file)) return null;
    const directory = path.join(this.directory, 'import-backups');
    fs.mkdirSync(directory, { recursive: true });
    const name =
      'profiles-' +
      new Date().toISOString().replaceAll(':', '-') +
      '-' +
      require('node:crypto').randomBytes(4).toString('hex') +
      '.json';
    fs.copyFileSync(this.file, path.join(directory, name), fs.constants.COPYFILE_EXCL);
    return 'import-backups/' + name;
  }
  importFile(file: string): StoredProfiles {
    if (fs.statSync(file).size > MAX_BYTES) throw Error('Profile file too large');
    return validate(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
}
