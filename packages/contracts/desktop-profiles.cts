import { object } from './desktop.cjs';
export interface AppAssociation { path: string; name: string; mode: 'focused' | 'running' }
export interface ProfileLibrary {
  automatic: boolean; pinned: boolean; defaultProfileId: string;
  associations: Record<string, AppAssociation[]>;
  names: Record<string, string>;
}
export interface RunningApplication { pid: number; path: string; name: string; title: string }
export interface ApplicationSnapshot { foreground: RunningApplication | null; running: RunningApplication[]; error?: string; keepProfile?: boolean }
export function profileId(value: unknown): string {
  if (typeof value !== 'string' || !value.length || value.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(value)) throw Error('Invalid profile ID');
  return value;
}
export function parseLibrary(value: unknown = {}): ProfileLibrary {
  const row = object(value, 'profile library'), associations: ProfileLibrary['associations'] = {}, names: Record<string,string> = {};
  for (const [id, apps] of Object.entries(object(row.associations ?? {}))) {
    profileId(id);
    if (!Array.isArray(apps) || apps.length > 100) throw Error('Invalid application associations');
    associations[id] = apps.map(value => {
      const app = object(value);
      if (typeof app.path !== 'string' || !/^[a-z]:\\.*\.exe$/i.test(app.path) || app.path.length > 32767 || typeof app.name !== 'string' || app.name.length > 200 || !['focused', 'running'].includes(String(app.mode))) throw Error('Invalid application association');
      return { path: app.path, name: app.name, mode: app.mode as AppAssociation['mode'] };
    });
  }
  for (const [id, name] of Object.entries(object(row.names ?? {}))) {
    profileId(id); if (typeof name !== 'string' || name.length > 100) throw Error('Invalid profile name'); names[id] = name;
  }
  return { automatic: row.automatic === true, pinned: row.pinned === true, defaultProfileId: profileId(row.defaultProfileId ?? 'hardware-0'), associations, names };
}
export function matchProfile(library: ProfileLibrary, snapshot: ApplicationSnapshot): { id: string; reason: string } | null {
  if (!library.automatic || library.pinned || snapshot.error || snapshot.keepProfile) return null;
  const foreground = snapshot.foreground?.path.toLowerCase();
  const running = new Set(snapshot.running.map(app => app.path.toLowerCase()));
  for (const mode of ['focused', 'running'] as const)
    for (const [id, apps] of Object.entries(library.associations))
      for (const app of apps)
        if (app.mode === mode && (mode === 'focused' ? app.path.toLowerCase() === foreground : running.has(app.path.toLowerCase())))
          return { id, reason: app.name };
  return { id: library.defaultProfileId, reason: 'Default profile' };
}
