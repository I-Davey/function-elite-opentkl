import fs from 'node:fs';
import path from 'node:path';
import * as devices from '../../../backend/src/devices.cjs';
import * as profiles from '../../../backend/src/profiles.cjs';
import { physicalToWire } from '../../../backend/src/remaps.cjs';
import { durable, replaceDurable } from '../../../backend/src/transaction-journal.cjs';
import type { Layout, ProfileInput, RemapRecord, RuntimeRemapRequest } from '../../../backend/src/contracts.cjs';

const layout: Layout = JSON.parse(fs.readFileSync(path.join(__dirname, '../../resources/keyboard/key-layout.json'), 'utf8'));

export const runtimeJournal = (profile: string) => path.join(profile, 'analogue-runtime-session.json');
interface Session {
  devicePath: string; original: string; applied: string; pending?: string;
  records: RemapRecord[]; keys: NonNullable<RuntimeRemapRequest['keys']>; snap: string;
}

/** One complete RAM table covers both actuation levels and both Fn layers. */
function table(records: RemapRecord[], suppressed: number[], mapped: number[]): string {
  const output: Buffer[] = [];
  for (const record of records) {
    const wire = physicalToWire.get(record.physicalKey);
    if (wire === undefined || wire >= 127) throw Error('Unsupported runtime key');
    const source = wire | (record.fnLayer ? 128 : 0);
    const data = suppressed.includes(record.physicalKey) ? Buffer.from([6])
      : record.data ? Buffer.from(record.data, 'hex')
      : mapped.includes(record.physicalKey) ? Buffer.from([4, wire]) : null;
    if (!data) continue;
    if (data[0] <= 2) {
      const header = Buffer.from([data[0], record.level, source, 0, 0]);
      header.writeUInt16LE(data.length - 1, 3);
      output.push(header, data.subarray(1));
    } else output.push(Buffer.from([data[0], record.level, source, data[1] ?? 0, 0]));
  }
  const result = Buffer.concat(output);
  if (result.length > 2048) throw Error('Analogue mappings exceed the firmware RAM table');
  return result.toString('hex');
}
function succeeded(result: { outcome: string; error?: string }) {
  if (!['applied', 'unchanged'].includes(result.outcome)) throw Error(result.error || 'Runtime mappings could not be verified');
}

/** Recovery also exits runtime lookup mode and reinstates software actuation/Snap. */
export async function restoreRuntimeRemaps(profile: string): Promise<void> {
  const file = runtimeJournal(profile);
  if (!fs.existsSync(file)) return;
  const saved: Session = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (typeof saved.devicePath !== 'string' || typeof saved.original !== 'string' || typeof saved.applied !== 'string' ||
      !Array.isArray(saved.keys) || typeof saved.snap !== 'string') throw Error('Invalid runtime mapping recovery');
  const current = await devices.runtimeRemaps();
  if (current.devicePath !== saved.devicePath) throw Error('Reconnect the keyboard used for analogue control');
  if (![saved.applied, saved.pending, saved.original, ''].includes(current.data)) throw Error('Runtime mappings changed externally; recovery remains saved');
  succeeded(await devices.applyRuntimeRemaps({ expectedActive: current.activeProfileIndex, expectedData: current.data, data: saved.original,
    restore: true, keys: current.activeProfileIndex === 4 ? saved.keys : null, snap: current.activeProfileIndex === 4 ? saved.snap : null }));
  fs.unlinkSync(file);
}

export function createRuntimeRemaps(profile: string) {
  let session: Session | undefined, mapped: number[] = [], installed = false;
  return {
    get active() { return !!session; },
    async start(keys: number[], activeSlot: number): Promise<boolean> {
      if (!keys.length || activeSlot !== 4) return false;
      const softwareFile = path.join(profile, 'software-session.json');
      if (!fs.existsSync(softwareFile)) return false;
      const source: { lastInput?: ProfileInput } = JSON.parse(fs.readFileSync(softwareFile, 'utf8'));
      if (!source.lastInput) return false;
      const plan = profiles.plan(source.lastInput, true);
      mapped = [...keys];
      // Check both complete states fit before changing the device.
      try { table(plan.records, [], mapped); table(plan.records, mapped, mapped); }
      catch { mapped = []; return false; }
      const before = await devices.runtimeRemaps();
      // This app applies software profiles through stored slot 4; its old RAM buffer is inactive.
      if (before.activeProfileIndex !== 4 || !before.devicePath) return false;
      // Firmware 83 refreshes masks using wire IDs. Include identity entries for any
      // other physical key those mask writes touch, until the set is closed.
      const covered = new Set([...mapped, ...plan.records.filter(record => record.data).map(record => record.physicalKey)]);
      const original = Buffer.from(before.data, 'hex');
      const affected = new Set<number>();
      for (let offset = 0; offset < original.length;) {
        affected.add(original[offset + 2] & 127);
        offset += original[offset] <= 2 ? 5 + original.readUInt16LE(offset + 3) : 5;
      }
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const key of covered) affected.add(physicalToWire.get(key)!);
        for (const key of Object.values(layout.sensors)) {
          if (affected.has(key.canonicalKey) && !covered.has(key.physicalKeyId)) {
            covered.add(key.physicalKeyId); mapped.push(key.physicalKeyId); expanded = true;
          }
        }
      }
      try { table(plan.records, [], mapped); table(plan.records, keys, mapped); }
      catch { mapped = []; return false; }
      session = { devicePath: before.devicePath, original: before.data, applied: before.data, records: plan.records,
        keys: plan.keys.map(key => ({ physicalKey: key.physicalKey, word: ((key.rapidSensitivityIndex << 24) |
          (key.secondLevelIndex << 16) | (key.levelIndex << 8) | { Single: 0, Dual: 1, Rapid: 2 }[key.kind]) >>> 0 })), snap: plan.snap };
      durable(runtimeJournal(profile), session);
      installed = false;
      return true;
    },
    async update(suppressed: number[]) {
      if (!session) throw Error('Runtime analogue session is unavailable');
      const data = table(session.records, suppressed, mapped);
      if (installed && data === session.applied) return;
      session.pending = data;
      replaceDurable(runtimeJournal(profile), session);
      succeeded(await devices.applyRuntimeRemaps({ expectedActive: 4, expectedData: session.applied, data,
        restore: false, keys: null, snap: null }));
      session.applied = data; installed = true; delete session.pending;
      replaceDurable(runtimeJournal(profile), session);
    },
    async stop() { await restoreRuntimeRemaps(profile); session = undefined; mapped = []; installed = false; },
  };
}
