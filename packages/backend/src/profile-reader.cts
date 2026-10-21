import type * as C from './contracts.cjs';
import { readJson } from './validation.cjs';
import { durable } from './transaction-journal.cjs';
import * as remapsModule from './remaps.cjs';
import * as settingsModule from './settings.cjs';
import * as deviceBackend from './devices.cjs';

import fs from 'node:fs';
import path from 'node:path';
const edits = settingsModule,
  remaps = remapsModule;
const journal = (profile: string) => path.join(profile, 'hardware-read-session.json');
function validBrightness(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 100)
  );
}
// Use normal profile selection to read each live table. Never request the
// inactive-slot getter that can load defaults into shared firmware RAM.
async function recover(profile: string, backend: C.DeviceBackend = deviceBackend) {
  const file = journal(profile);
  if (!fs.existsSync(file)) return;
  const saved = readJson<{ kind: string; originalSlot: number; brightnessChannels?: number[] }>(
    fs.readFileSync(file, 'utf8'),
  );
  if (
    saved.kind !== 'profile-read' ||
    !Number.isInteger(saved.originalSlot) ||
    saved.originalSlot < 0 ||
    saved.originalSlot > 3
  )
    throw Error('Invalid profile read recovery');
  if (saved.brightnessChannels !== undefined && !validBrightness(saved.brightnessChannels))
    throw Error('Invalid profile read brightness recovery');
  const current = await backend.connection();
  if (current.activeProfileIndex === 4)
    throw Error('Finish the software session before recovering the profile read');
  if (current.activeProfileIndex !== saved.originalSlot)
    await edits.apply(
      profile,
      { field: 'activeProfile', wireIndex: saved.originalSlot, value: saved.originalSlot },
      backend,
    );
  // Profile selection can load stored brightness into runtime state. Restore the
  // exact observed channels only after returning to the original slot.
  if (saved.brightnessChannels) {
    const returned = await backend.connection();
    if (returned.activeProfileIndex !== saved.originalSlot)
      throw Error('Original profile was not restored');
    for (const [channel, field] of (['brightnessKeys', 'brightnessRing'] as const).entries())
      if (returned.brightnessChannels[channel] !== saved.brightnessChannels[channel])
        await edits.apply(
          profile,
          { field, wireIndex: saved.originalSlot, value: saved.brightnessChannels[channel] },
          backend,
        );
  }
  const verified = await backend.connection();
  if (
    verified.activeProfileIndex !== saved.originalSlot ||
    (saved.brightnessChannels &&
      saved.brightnessChannels.some((value, index) => verified.brightnessChannels[index] !== value))
  )
    throw Error('Profile read runtime state could not be restored');
  // Old journals without channels restore only the slot; never invent brightness.
  fs.unlinkSync(file);
}
async function read(profile: string, backend: C.DeviceBackend = deviceBackend) {
  await recover(profile, backend);
  const before = await backend.connection(),
    originalSlot = before.activeProfileIndex;
  if (originalSlot === 4) throw Error('Read onboard profiles before starting a software session');
  if (!validBrightness(before.brightnessChannels))
    throw Error('Invalid original runtime brightness');
  fs.mkdirSync(profile, { recursive: true });
  durable(journal(profile), {
    kind: 'profile-read',
    originalSlot,
    brightnessChannels: [...before.brightnessChannels],
    at: new Date().toISOString(),
  });
  const profiles = [];
  try {
    for (const slot of [originalSlot, ...[0, 1, 2, 3].filter((slot) => slot !== originalSlot)]) {
      const current = await backend.connection();
      if (current.activeProfileIndex !== slot)
        await edits.apply(
          profile,
          { field: 'activeProfile', wireIndex: slot, value: slot },
          backend,
        );
      const actuation = await backend.actuation(),
        raw = await remaps.readSlot(slot, backend);
      if (actuation.activeProfileIndex !== slot || raw.activeProfileIndex !== slot)
        throw Error('Profile changed during onboard read');
      profiles.push({
        wireIndex: slot,
        brightnessChannels: (await backend.connection()).brightnessChannels,
        actuation,
        remaps: { ...raw, configs: remaps.coreConfigs(raw, actuation) },
      });
    }
  } finally {
    await recover(profile, backend);
  }
  const after = await backend.connection();
  if (
    after.activeProfileIndex !== originalSlot ||
    before.brightnessChannels.some((value, index) => after.brightnessChannels[index] !== value)
  )
    throw Error('Original profile runtime controls were not restored');
  return {
    profiles,
    originalSlot,
    returnedToOriginalSlot: true,
    runtimeBrightnessRestored: true,
    temporaryProfileSelection: true,
    profileContentsWritten: false,
  };
}
export { read, recover };
