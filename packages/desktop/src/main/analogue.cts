import fs from 'node:fs';
import path from 'node:path';
import type { Serial, IpcRegistrar, Window, Electron } from '../../../contracts/desktop-platform.cjs';
import { registrar } from '../../../contracts/desktop-channels.cjs';
import { object, errorMessage } from '../../../contracts/desktop.cjs';
import { AnalogueEngine, OverrideShortcut, binding, emptyProfile, neutralFrame, parseProfile, type AnalogueProfile, type AnalogueState, type CalibrationState, type TravelCalibration } from '../../../contracts/desktop-analogue.cjs';
import { createAnalogueFeedback, restoreAnalogueLighting } from './analogue-feedback.cjs';
import * as devices from '../../../backend/src/devices.cjs';
import * as depth from '../../../backend/src/depth.cjs';
import * as remaps from '../../../backend/src/remaps.cjs';
import { durable, replaceDurable } from '../../../backend/src/transaction-journal.cjs';
import type { RemapRawInput, Connection } from '../../../backend/src/contracts.cjs';
import { ProfileStore } from './profile-store.cjs';
import { profileId as validId } from '../../../contracts/desktop-profiles.cjs';

interface Controller { initialize(file: string): string; setEnabled(enabled: boolean): string; update(report: string): string; status(): string }
interface Journal { devicePath: string; records: RemapRawInput[] }
// Same empty one-shot macro used by the CAM patch, on both actuation/Fn layers.
const quiet = '01010000000000';
const journalFile = (profile: string) => path.join(profile, 'analogue-session.json');
function succeeded(result: { outcome: string; error?: string }) {
  if (!['applied', 'unchanged'].includes(result.outcome)) throw Error(result.error || 'Keyboard mapping verification failed');
}
function readKeyJournal(profile: string): Journal | undefined {
  const file = journalFile(profile);
  if (!fs.existsSync(file)) return;
  const saved = object(JSON.parse(fs.readFileSync(file, 'utf8')), 'analogue recovery');
  if (typeof saved.devicePath !== 'string' || !Array.isArray(saved.records) || saved.records.length > 352) throw Error('Invalid analogue recovery record');
  const records = saved.records.map(item => {
    const r = object(item, 'saved key');
    if (!Number.isInteger(r.wireIndex) || Number(r.wireIndex) < 0 || Number(r.wireIndex) > 4 ||
      !remaps.physicalToWire.has(Number(r.physicalKey)) || ![0, 1].includes(Number(r.level)) || typeof r.fnLayer !== 'boolean' ||
      typeof r.data !== 'string' || !/^(?:[0-9a-f]{2})*$/.test(r.data)) throw Error('Invalid saved analogue key');
    return { wireIndex: Number(r.wireIndex), physicalKey: Number(r.physicalKey), level: Number(r.level), fnLayer: r.fnLayer, data: r.data };
  });
  return { devicePath: saved.devicePath, records };
}
/** Idempotent recovery: only replace our temporary mapping, never an unrelated user edit. */
export async function restoreAnalogueKeys(profile: string, keys?: number[]): Promise<void> {
  const saved = readKeyJournal(profile);
  if (!saved) return;
  const connection = await devices.connection();
  if (connection.devicePath !== saved.devicePath) throw Error('Reconnect the keyboard used for analogue control to restore its keys');
  for (const original of saved.records.filter(record => !keys || keys.includes(record.physicalKey))) {
    const current = await devices.remaps({ wireIndex: original.wireIndex, physicalKeys: [original.physicalKey] });
    const record = current.records.find((key) => key.physicalKey === original.physicalKey && key.level === original.level && key.fnLayer === original.fnLayer);
    if (!record) throw Error('Saved analogue key is unavailable');
    if (record.data === original.data) continue;
    if (record.data !== quiet) throw Error('Key ' + original.physicalKey + ' changed outside analogue control; its original mapping remains saved');
    succeeded(await devices.applyRemap({ ...original, expectedActive: current.activeProfileIndex, expectedData: quiet }));
  }
  const remaining = keys ? saved.records.filter(record => !keys.includes(record.physicalKey)) : [];
  if (remaining.length) replaceDurable(journalFile(profile), { ...saved, records: remaining });
  else fs.unlinkSync(journalFile(profile));
}
const suppressedKeys = (settings: AnalogueProfile, excluded: number[] = []) => Object.entries(settings.bindings)
  .filter(([key, b]) => b.enabled && b.overwriteDefault && !excluded.includes(Number(key))).map(([key]) => Number(key)).sort((a, b) => a - b);
function validProfile(value: unknown): AnalogueProfile {
  const parsed = parseProfile(value);
  for (const key of Object.keys(parsed.bindings)) if (!remaps.physicalToWire.has(Number(key))) throw Error('Unknown keyboard key: ' + key);
  for (const key of parsed.override.shortcut) if (!remaps.physicalToWire.has(key)) throw Error('Unknown shortcut key: ' + key);
  if (parsed.override.enabled && parsed.override.shortcut.some(key => parsed.bindings[key]?.enabled)) throw Error('Use unmapped keys for the override shortcut');
  return parsed;
}

export function createAnalogue(profile: string, serial: Serial) {
  const store = new ProfileStore(profile);
  let profiles: Record<string, AnalogueProfile> = {};
  let loadError = '';
  try {
    const saved = store.read();
    for (const [id, value] of Object.entries(object(saved.analogueProfiles ?? {}))) profiles[id] = validProfile(value);
  } catch (error) { loadError = errorMessage(error); }
  let settings = emptyProfile(), profileId = '', output: Controller | undefined;
  let outputWanted = false;
  let activeDevice = '', activeSlot = -1;
  let running = false, generation = 0, timer: NodeJS.Timeout | undefined, lastSample = 0, lastTick = 0, rateHz = 0, error = loadError;
  let latest: (ReturnType<typeof depth.decode> & { roundTripMs: number }) | undefined;
  let frame = neutralFrame();
  const engine = new AnalogueEngine();
  const shortcut = new OverrideShortcut(), feedback = createAnalogueFeedback(profile);
  let shortcutCaptureUntil = 0;
  let overriddenKeys: number[] = [], transitioning = false, feedbackError = '', feedbackFailed = false;
  let calibration: CalibrationState | null = null, resumeAfterCalibration = false;
  let released: { mean: number; noise: number } | undefined;
  let calibrationSamples: { adc: number; at: number }[] = [];
  const state = (): AnalogueState => ({ ...(lastSample && Date.now() - lastSample < 200 ? frame : neutralFrame()), settings, profileId, running: running && !shortcut.active,
    connected: lastSample > 0 && Date.now() - lastSample < 200, error, rateHz,
    overriddenKeys, overrideRequested: shortcut.active, transitioning, calibration, feedbackError,
    sampleAgeMs: lastSample ? Date.now() - lastSample : null,
    recoveryPending: fs.existsSync(journalFile(profile)) || fs.existsSync(path.join(profile, 'analogue-lighting-session.json')), preview: false });
  const silence = (detach = true) => {
    running = false; generation++; clearTimeout(timer); engine.reset(); frame = neutralFrame(); latest = undefined; lastSample = 0; rateHz = 0;
    shortcut.reset(); overriddenKeys = []; transitioning = false; calibration = null; calibrationSamples = []; released = undefined;
    if (detach) output?.setEnabled(false);
    else output?.update('0,0,0,0,0,0,0');
  };
  // Caller holds the shared device transaction queue, including during shutdown.
  const stopInside = async (detach = true) => {
    silence(detach);
    const failures: string[] = [];
    for (const restore of [() => restoreAnalogueKeys(profile), () => feedback.stop()]) {
      try { await restore(); } catch (caught) { failures.push(errorMessage(caught)); }
    }
    if (failures.length) throw Error(failures.join(' · '));
  };
  async function suppress(excluded: number[] = [], only?: number[]) {
    const previous = readKeyJournal(profile);
    const keys = suppressedKeys(settings, excluded).filter(key => (!only || only.includes(key)) && !previous?.records.some(record => record.physicalKey === key));
    if (!keys.length) return;
    const connection = await devices.connection();
    if (!connection.devicePath) throw Error('Keyboard identity is unavailable');
    if (previous && previous.devicePath !== connection.devicePath) throw Error('Reconnect the keyboard used for analogue control');
    const saved: Journal = { devicePath: connection.devicePath, records: previous?.records ?? [] }, pending: RemapRawInput[] = [];
    for (let i = 0; i < keys.length; i += 4) {
      const snapshot = await devices.remaps({ wireIndex: connection.activeProfileIndex, physicalKeys: keys.slice(i, i + 4) });
      if (snapshot.activeProfileIndex !== connection.activeProfileIndex) throw Error('Keyboard profile changed; start analogue control again');
      for (const key of keys.slice(i, i + 4)) for (const level of [0, 1]) for (const fnLayer of [false, true]) {
        if (snapshot.records.filter((r) => r.physicalKey === key && r.level === level && r.fnLayer === fnLayer).length !== 1) throw Error('Incomplete key mappings; nothing has been overwritten');
      }
      for (const record of snapshot.records) {
        // Refuse to replace a firmware mapping that our writer cannot restore.
        if (record.data !== quiet) remaps.encode(remaps.decode(record.data, record.physicalKey), record.physicalKey);
        pending.push({ wireIndex: connection.activeProfileIndex, physicalKey: record.physicalKey,
          level: record.level, fnLayer: record.fnLayer, data: record.data });
      }
    }
    saved.records.push(...pending);
    if (previous) replaceDurable(journalFile(profile), saved);
    else durable(journalFile(profile), saved);
    for (const record of pending) succeeded(await devices.applyRemap({ ...record, data: quiet, expectedData: record.data, expectedActive: connection.activeProfileIndex }));
  }
  async function tick(ticket: number) {
    if ((!running && !calibration) || ticket !== generation) return;
    try {
      await serial(async () => {
        if ((!running && !calibration) || ticket !== generation) return;
        const started = Date.now(), snapshot = depth.decode(await devices.sensors()), now = Date.now();
        if (now - started > 200) throw Error('Sensor readings are too slow; analogue output stopped');
        latest = { ...snapshot, roundTripMs: now - started };
        const elapsed = lastTick ? now - lastTick : 16;
        rateHz = lastTick ? (rateHz ? rateHz * .85 + 1000 / elapsed * .15 : 1000 / elapsed) : 0;
        const rawMm = Object.fromEntries(snapshot.keys.map(key => {
          const c = settings.bindings[key.physicalKeyId]?.calibration;
          const valid = c && c.factoryBaseline === key.baseline && c.factoryScale === key.scale && c.factoryPressed === key.pressed;
          return [String(key.physicalKeyId), valid ? depth.estimate((key.adc - c.released) / (c.pressed - c.released) * depth.fullCoefficient) : key.millimetresEstimate];
        }));
        if (calibration) {
          const key = snapshot.keys.find(key => key.physicalKeyId === calibration!.key);
          if (!key) throw Error('Calibration key is unavailable');
          calibrationSamples.push({ adc: key.adc, at: now });
          calibrationSamples = calibrationSamples.filter(sample => now - sample.at < 700).slice(-512);
          calibration = { ...calibration, samples: calibrationSamples.length };
          frame = { ...neutralFrame(), rawMm };
        } else {
          const requested = now < shortcutCaptureUntil ? shortcut.active : shortcut.update(rawMm, settings.override);
          outputWanted = !requested;
          const targets = requested ? Object.keys(settings.bindings).map(Number).filter(key => settings.bindings[key].enabled).sort((a, b) => a - b) : [];
          transitioning = JSON.stringify(targets) !== JSON.stringify(overriddenKeys);
          const blocked = new Set([...targets, ...overriddenKeys]);
          const before = suppressedKeys(settings, overriddenKeys), after = suppressedKeys(settings, targets);
          const restore = before.filter(key => !after.includes(key)), add = after.filter(key => !before.includes(key));
          const effective = { ...settings, bindings: Object.fromEntries(Object.entries(settings.bindings).map(([key, b]) => [key, blocked.has(Number(key)) ? { ...b, enabled: false } : b])) };
          frame = engine.update(rawMm, effective, elapsed);
          const result = output!.update([...Object.values(frame.axes), frame.buttonMask].join(','));
          if (result !== 'updated') throw Error(result);
          if (transitioning && [...restore, ...add].every(key => rawMm[key] <= settings.bindings[key].startMm)) {
            // Keep the controller attached to the game; release every control during mapping writes.
            if (restore.length || add.length) {
              const neutral = output!.update('0,0,0,0,0,0,0');
              if (neutral !== 'updated') throw Error(neutral);
              if (restore.length) await restoreAnalogueKeys(profile, restore);
              if (add.length) await suppress(targets, add);
            }
            overriddenKeys = targets; transitioning = false; engine.reset();
          }
          if (!feedbackFailed) {
            try {
              await feedback.update(settings, overriddenKeys, now, transitioning ? [...blocked] : []); feedbackError = '';
            }
            catch (caught) {
              feedbackError = errorMessage(caught); feedbackFailed = true;
              try { await feedback.stop(); } catch (recovery) { feedbackError += ' · ' + errorMessage(recovery); }
            }
          }
        }
        lastTick = lastSample = now;
      });
      if ((running || calibration) && ticket === generation) timer = setTimeout(() => void tick(ticket), 1);
    } catch (caught) {
      if (ticket !== generation) return;
      error = errorMessage(caught); outputWanted = false; silence();
      try { await serial(async () => { await restoreAnalogueKeys(profile); await restoreAnalogueLighting(profile); }); } catch (recovery) { error += ' · ' + errorMessage(recovery); }
    }
  }
  async function startInside(paused = false) {
    if (!Object.values(settings.bindings).some((b) => b.enabled)) throw Error('Map at least one key first');
    await stopInside(false);
    // Read the device before creating a game controller or changing normal key output.
    const connection = await devices.connection();
    const expectedSlot = /^hardware-[0-3]$/.test(profileId) ? Number(profileId.slice(-1)) : 4;
    if (connection.activeProfileIndex !== expectedSlot) throw Error('Waiting for the selected keyboard profile');
    const sample = depth.decode(await devices.sensors());
    activeDevice = connection.devicePath ?? ''; activeSlot = connection.activeProfileIndex;
    const available = new Set(sample.keys.map((key) => String(key.physicalKeyId)));
    for (const [key, b] of Object.entries(settings.bindings)) if (b.enabled && !available.has(key)) throw Error('Sensor unavailable for key ' + key);
    if (!output) {
      output = require(path.join(__dirname, '../../native/analog-controller/controller.node')) as Controller;
      const result = output.initialize(path.join(__dirname, '../../resources/controller/ViGEmClient.dll'));
      if (result !== 'ready') { output = undefined; throw Error(result); }
    }
    const result = output.setEnabled(true);
    if (result !== 'enabled') throw Error(result + '. Install the ViGEmBus driver if it is missing.');
    try { if (!paused) await suppress(); } catch (caught) { await stopInside(); throw caught; }
    shortcut.active = paused;
    outputWanted = !paused;
    if (paused) overriddenKeys = Object.keys(settings.bindings).map(Number).filter(key => settings.bindings[key].enabled).sort((a, b) => a - b);
    error = ''; feedbackError = ''; feedbackFailed = false; running = true; lastTick = 0;
    timer = setTimeout(() => void tick(generation), 0);
  }
  const save = () => {
    if (loadError) throw Error('Existing analogue settings could not be read: ' + loadError);
    const next = { ...profiles, [profileId]: settings };
    store.writeExtra('analogueProfiles', next); profiles = next;
  };
  const choose = async (id: unknown) => {
    if (typeof id !== 'string' || !id.length || id.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(id)) throw Error('Invalid analogue profile ID');
    if (id !== profileId) {
      await stopInside(false); profileId = id; settings = profiles[id] ?? emptyProfile(); error = loadError;
    }
    if (!running && (outputWanted || settings.override.enabled) && Object.values(settings.bindings).some(b=>b.enabled)) {
      try { await startInside(!outputWanted); } catch (caught) { error=errorMessage(caught); }
    }
    return state();
  };
  const replace = async (value: unknown, targetId = profileId) => {
    validId(targetId);
    if (targetId !== profileId) {
      const next = { ...profiles, [targetId]: validProfile(value) };
      store.writeExtra('analogueProfiles', next); profiles = next;
      return state();
    }
    if (!profileId) throw Error('Select a keyboard profile first');
    const next = validProfile(value), wasRunning = running, wasPaused = shortcut.active;
    const changedKeys = JSON.stringify(suppressedKeys(settings)) !== JSON.stringify(suppressedKeys(next)) || JSON.stringify(settings.override) !== JSON.stringify(next.override);
    if (changedKeys) await stopInside(false);
    const previous = settings; settings = next;
    try { save(); } catch (caught) { settings = previous; throw caught; }
    engine.reset();
    feedbackFailed = false; feedbackError = '';
    if (wasRunning && changedKeys) await startInside(wasPaused);
    else if (!running && next.override.enabled && Object.values(next.bindings).some(b => b.enabled)) {
      try { await startInside(true); } catch (caught) { error = errorMessage(caught); }
    }
    return state();
  };
  return {
    reloadProfiles: async () => {
      await stopInside(false);
      const next:Record<string,AnalogueProfile>={};
      for(const [id,value] of Object.entries(object(store.read().analogueProfiles??{}))) next[validId(id)]=validProfile(value);
      profiles=next;settings=profiles[profileId]??emptyProfile();loadError='';error='';
    },
    copyProfile: async (source: string, target: string) => {
      validId(source); validId(target);
      const next = { ...profiles, [target]: validProfile(profiles[source] ?? emptyProfile()) };
      store.writeExtra('analogueProfiles', next); profiles = next;
      if (target === profileId) await replace(next[target]);
    },
    removeProfile: (id: string) => { validId(id); delete profiles[id]; store.writeExtra('analogueProfiles', profiles); },
    state, stopInside, latest: () => running && latest && Date.now() - lastSample < 100 ? latest : undefined,
    async observeConnection(connection: Connection) {
      if ((running || calibration) && (connection.devicePath !== activeDevice || connection.activeProfileIndex !== activeSlot)) {
        await stopInside(connection.devicePath !== activeDevice); error = 'Controller stopped because the keyboard profile changed';
      }
    },
    async beforeConfiguration() {
      const resume = running ? { profileId, activeDevice, activeSlot, paused: shortcut.active } : undefined;
      if (running || calibration || fs.existsSync(journalFile(profile)) || fs.existsSync(path.join(profile, 'analogue-lighting-session.json'))) {
        // Settings writes pause input without making the game rediscover its controller.
        await stopInside(false); error = 'Stopped for keyboard settings changes';
      }
      return async () => {
        if (!resume || profileId !== resume.profileId) return;
        const connection = await devices.connection();
        // A different profile must select its own bindings before output can resume.
        if (connection.devicePath !== resume.activeDevice || connection.activeProfileIndex !== resume.activeSlot) return;
        await startInside(resume.paused);
      };
    },
    register(ipcMain: IpcRegistrar, win: Window) {
      const handle = registrar(ipcMain);
      handle('keyboard:analogue-state', () => state());
      handle('keyboard:analogue-profile', (_event, id) => serial(() => choose(id)));
      handle('keyboard:analogue-save', (_event, value) => serial(() => {
        const row = object(value);
        return row.profileId !== undefined ? replace(row.settings, validId(row.profileId)) : replace(value);
      }));
      handle('keyboard:analogue-shortcut-capture', (_event, value) => serial(async () => {
        if (typeof value !== 'boolean') throw Error('Expected shortcut capture flag');
        shortcutCaptureUntil = value ? Date.now() + 15000 : 0;
        shortcut.rearm();
      }));
      handle('keyboard:analogue-calibrate', (_event, input) => serial(async () => {
        const request = object(input, 'calibration request'), key = Number(request.key);
        if (!remaps.physicalToWire.has(key) || !['start', 'capture', 'apply', 'cancel'].includes(String(request.action))) throw Error('Invalid calibration request');
        if (request.action === 'start') {
          resumeAfterCalibration = running && !shortcut.active;
          await stopInside(false);
          const connection = await devices.connection();
          activeDevice = connection.devicePath ?? ''; activeSlot = connection.activeProfileIndex;
          calibration = { key, phase: 'released', samples: 0, error: '' }; lastTick = 0; error = '';
          timer = setTimeout(() => void tick(generation), 0);
        } else {
          if (!calibration || calibration.key !== key) throw Error('Start calibration for this key first');
          if (request.action === 'cancel' || request.action === 'apply') {
            const resume = resumeAfterCalibration;
            if (request.action === 'apply') {
              if (!calibration.result) throw Error('Capture both travel endpoints first');
              await replace({ ...settings, bindings: { ...settings.bindings, [key]: binding({ ...settings.bindings[key], calibration: calibration.result }) } });
            }
            await stopInside(false); if (resume || settings.override.enabled) await startInside(!resume);
          } else {
            const sample = latest?.keys.find(sample => sample.physicalKeyId === key);
            try {
              if (!sample || !lastSample || Date.now() - lastSample > 200 || calibrationSamples.length < 12 || calibrationSamples.at(-1)!.at - calibrationSamples[0].at < 300) throw Error('Hold steadily for a moment, then capture again');
              const values = calibrationSamples.map(sample => sample.adc).sort((a, b) => a - b);
              const trimmed = values.slice(Math.floor(values.length * .1), Math.ceil(values.length * .9));
              const mean = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
              const noise = Math.sqrt(trimmed.reduce((sum, value) => sum + (value - mean) ** 2, 0) / trimmed.length);
              if (calibration.phase === 'released') {
                if (noise > Math.max(3, sample.scale * .01, (sample.pressed - sample.baseline) * .005) || mean > sample.baseline + (sample.pressed - sample.baseline) * .25) throw Error('Release the key completely and hold it still');
                released = { mean, noise }; calibration = { ...calibration, phase: 'pressed', samples: 0, error: '' }; calibrationSamples = [];
              } else {
                if (!released || mean - released.mean < Math.max(20, (sample.pressed - sample.baseline) * .6, released.noise * 20) || noise > Math.max(4, (mean - released.mean) * .02)) throw Error('Hold the key fully down and steady, then capture again');
                const result: TravelCalibration = { released: released.mean, pressed: mean, noise: released.noise, factoryBaseline: sample.baseline, factoryScale: sample.scale, factoryPressed: sample.pressed, at: new Date().toISOString() };
                calibration = { ...calibration, phase: 'review', error: '', result };
              }
            } catch (caught) { calibration = { ...calibration!, error: errorMessage(caught) }; }
          }
        }
        return state();
      }));
      handle('keyboard:analogue-enable', (_event, value) => serial(async () => {
        if (typeof value !== 'boolean') throw Error('Expected analogue enabled flag');
        outputWanted = value;
        try {
          if (running) { shortcut.active = !value; engine.reset(); output!.update('0,0,0,0,0,0,0'); frame = neutralFrame(); }
          else if (value || settings.override.enabled) await startInside(!value);
          else { await stopInside(); error = ''; }
        }
        catch (caught) { error = errorMessage(caught); silence(); throw caught; }
        return state();
      }));
      handle('keyboard:analogue-import', () => serial(async () => {
        const { dialog }: Pick<Electron, 'dialog'> = require('electron');
        const chosen = await dialog.showOpenDialog(win, { title: 'Import CAM analogue mappings', properties: ['openFile'], filters: [{ name: 'Analogue settings', extensions: ['json'] }] });
        if (chosen.canceled || !chosen.filePaths[0]) return null;
        if (fs.statSync(chosen.filePaths[0]).size > 1024 * 1024) throw Error('Analogue settings file is too large');
        return replace(JSON.parse(fs.readFileSync(chosen.filePaths[0], 'utf8')));
      }));
      handle('keyboard:analogue-export', async () => {
        const { dialog }: Pick<Electron, 'dialog'> = require('electron');
        const chosen = await dialog.showSaveDialog(win, { title: 'Export analogue mappings', defaultPath: path.join(profile, 'analog-settings.json'), filters: [{ name: 'Analogue settings', extensions: ['json'] }] });
        if (chosen.canceled || !chosen.filePath) return null;
        fs.writeFileSync(chosen.filePath, JSON.stringify(settings, null, 2) + '\n'); return chosen.filePath;
      });
    },
  };
}
