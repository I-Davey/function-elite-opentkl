import fs from 'node:fs';
import path from 'node:path';
import * as devices from '../../../backend/src/devices.cjs';
import * as lighting from '../../../backend/src/lighting.cjs';
import { physicalToWire } from '../../../backend/src/remaps.cjs';
import { durable, replaceDurable } from '../../../backend/src/transaction-journal.cjs';
import { object } from '../../../contracts/desktop.cjs';
import { feedbackColor, type AnalogueProfile } from '../../../contracts/desktop-analogue.cjs';
import type { WireLightingRecord } from '../../../backend/src/contracts.cjs';

const location = (profile: string) => path.join(profile, 'analogue-lighting-session.json');
interface Session { devicePath: string; wireIndex: number; base: string; reactive: string; reactiveApplied?: string }
function liveData(data: string) {
  // Empty masks recreate an empty live layer without invoking a stored-profile clear command.
  return data || lighting.encodeZones([{ keys: [], effectSettings: { kind: 'Color', color: { r: 0, g: 0, b: 0 } } }], 'Base');
}
async function write(data: string, active: number) {
  const result = await devices.applyRuntimeLighting({ wireIndex: 4, layer: 'Base', data: liveData(data), expectedActive: active, expectedData: '' });
  if (result.outcome !== 'acknowledged') throw Error(result.error || 'Lighting feedback was not acknowledged');
}
export async function restoreAnalogueLighting(profile: string): Promise<void> {
  const file = location(profile);
  if (!fs.existsSync(file)) return;
  const raw = object(JSON.parse(fs.readFileSync(file, 'utf8')), 'lighting recovery');
  if (typeof raw.devicePath !== 'string' || !Number.isInteger(raw.wireIndex) || Number(raw.wireIndex) < 0 || Number(raw.wireIndex) > 4 || typeof raw.base !== 'string' || typeof raw.reactive !== 'string') throw Error('Invalid lighting recovery');
  lighting.records(raw.base, 'Base'); lighting.records(raw.reactive, 'Reactive');
  if (raw.reactiveApplied !== undefined && typeof raw.reactiveApplied !== 'string') throw Error('Invalid reactive lighting recovery');
  if (typeof raw.reactiveApplied === 'string') lighting.records(raw.reactiveApplied, 'Reactive');
  const current = await devices.connection();
  if (current.devicePath !== raw.devicePath) throw Error('Reconnect the keyboard used for analogue lighting');
  const snapshot = await devices.lighting(Number(raw.wireIndex)), layers = snapshot.profiles.find(p => p.wireIndex === raw.wireIndex)?.layers;
  if (!layers || snapshot.activeProfileIndex !== current.activeProfileIndex) throw Error('Keyboard changed during lighting recovery');
  const reactive = layers.find(l => l.kind === 'Reactive')!.data;
  // Older journals only attempted a rejected FF reactive write, so their stored layer is untouched.
  if (typeof raw.reactiveApplied === 'string' && reactive !== raw.reactive && reactive === raw.reactiveApplied) {
    const result = await devices.applyLighting({ wireIndex: Number(raw.wireIndex), layer: 'Reactive', data: raw.reactive, expectedData: reactive, expectedActive: current.activeProfileIndex });
    if (!['applied', 'unchanged'].includes(result.outcome)) throw Error(result.error || 'Reactive lighting recovery failed');
  }
  if (current.activeProfileIndex === raw.wireIndex) {
    // Restore current stored effects, including any newer edits made in CAM while we were closed.
    await write(layers.find(l => l.kind === 'Base')!.data, current.activeProfileIndex);
  }
  fs.unlinkSync(file);
}
function omitKeys(records: WireLightingRecord[], keys: Set<number>) {
  return records.map(record => {
    const mask = [...record.mask];
    for (const key of keys) mask[key >> 3] &= ~(1 << (key & 7));
    return { ...record, mask };
  }).filter(record => record.mask.some(Boolean));
}
export function createAnalogueFeedback(profile: string) {
  let session: Session | undefined, last = '', lastAt = 0, lastMode = '';
  const colors = new Map<string, number[]>();
  return {
    async stop() { await restoreAnalogueLighting(profile); session = undefined; last = ''; lastAt = 0; lastMode = ''; colors.clear(); },
    async update(settings: AnalogueProfile, overridden: number[], now: number, pending: number[] = []) {
      if (!settings.feedback.enabled) { if (session) await this.stop(); return; }
      const currentMode = JSON.stringify([overridden, pending]);
      if (now - lastAt < 100 && currentMode === lastMode) return;
      if (!session) {
        const connection = await devices.connection(), raw = await devices.lighting(connection.activeProfileIndex);
        if (!connection.devicePath || raw.activeProfileIndex !== connection.activeProfileIndex) throw Error('Keyboard changed before lighting feedback');
        const layers = raw.profiles.find(p => p.wireIndex === raw.activeProfileIndex)?.layers;
        if (!layers) throw Error('Lighting backup is unavailable');
        session = { devicePath: connection.devicePath, wireIndex: connection.activeProfileIndex,
          base: layers.find(l => l.kind === 'Base')!.data, reactive: layers.find(l => l.kind === 'Reactive')!.data };
        lighting.records(session.base, 'Base'); lighting.records(session.reactive, 'Reactive');
        durable(location(profile), session);
      }
      const mapped = Object.entries(settings.bindings).filter(([, b]) => b.enabled);
      const keys = new Set(mapped.map(([key]) => physicalToWire.get(Number(key))!));
      const base = omitKeys(lighting.records(session.base, 'Base'), keys);
      const mode = (key: string) => pending.includes(Number(key)) ? 'pending' : overridden.includes(Number(key)) ? 'override' : settings.bindings[key].overwriteDefault ? 'suppressed' : 'active';
      const modes = new Set(mapped.map(([key]) => mode(key))).size;
      const available = 10 - base.length;
      if (available < modes) throw Error('Analogue feedback needs more free base lighting zones; combine some existing zones');
      const groups = new Map<string, number[]>(), nextColors = new Map<string, number[]>();
      const elapsed = lastAt ? now - lastAt : 100;
      const alpha = settings.feedback.fadeMs ? -Math.expm1(-elapsed / settings.feedback.fadeMs) : 1;
      for (const [key, b] of mapped) {
        const kind = mode(key);
        if (!nextColors.has(kind)) {
          const target = kind === 'pending'
            ? feedbackColor(b, true, { ...settings.feedback, brightness: settings.feedback.brightness * (.3 + .7 * (.5 + .5 * Math.sin(now / 100))) })
            : feedbackColor(b, overridden.includes(Number(key)), settings.feedback);
          const previous = colors.get(kind);
          nextColors.set(kind, [1, 3, 5].map((offset, index) => {
            const value = parseInt(target.slice(offset, offset + 2), 16);
            return previous ? previous[index] + (value - previous[index]) * alpha : value;
          }));
        }
        const color = '#' + nextColors.get(kind)!.map(value => Math.round(value).toString(16).padStart(2, '0')).join('');
        groups.set(color, [...(groups.get(color) ?? []), Number(key)]);
      }
      colors.clear(); for (const [kind, color] of nextColors) colors.set(kind, color);
      const data = base.map(lighting.encodeRecord).join('') + lighting.encodeZones([...groups].map(([color, keys]) => ({ keys, effectSettings: { kind: 'Color', color: {
        r: parseInt(color.slice(1, 3), 16), g: parseInt(color.slice(3, 5), 16), b: parseInt(color.slice(5, 7), 16),
      } } })), 'Base');
      const reactive = omitKeys(lighting.records(session.reactive, 'Reactive'), keys).map(lighting.encodeRecord).join('');
      const signature = data + '/' + reactive;
      if (signature !== last) {
        const previous = session.reactiveApplied ?? session.reactive;
        if (reactive !== previous) {
          // Reactive FF is unsupported: change its masks once, with an exact compare and recovery journal.
          session.reactiveApplied = reactive; replaceDurable(location(profile), session);
          const result = await devices.applyLighting({ wireIndex: session.wireIndex, layer: 'Reactive', data: reactive, expectedData: previous, expectedActive: session.wireIndex });
          if (!['applied', 'unchanged'].includes(result.outcome)) throw Error(result.error || 'Reactive feedback masking failed');
        }
        await write(data, session.wireIndex);
        last = signature;
      }
      lastAt = now;
      lastMode = currentMode;
    },
  };
}
