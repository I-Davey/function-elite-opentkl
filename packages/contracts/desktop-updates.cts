export interface UpdateState {
  phase: 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'installing' | 'error';
  installedVersion: string;
  latestVersion: string | null;
  downloadedBytes: number;
  totalBytes: number;
  error: string | null;
}

/** SemVer ordering includes numeric prerelease identifiers (beta.10 follows beta.9). */
export function versionParts(value: string) {
  const match = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
  if (!match) throw Error('Invalid release version');
  const numbers = match.slice(1, 4).map(Number), pre = match[4]?.split('.') ?? [];
  if (numbers.some(n => !Number.isSafeInteger(n)) || pre.some(p => !p || (/^\d+$/.test(p) && (p.length > 1 && p[0] === '0' || !Number.isSafeInteger(Number(p)))))) throw Error('Invalid release version');
  return { numbers, pre };
}
export function compareVersions(a: string, b: string): number {
  const left = versionParts(a), right = versionParts(b);
  for (let i = 0; i < 3; i++) if (left.numbers[i] !== right.numbers[i]) return left.numbers[i] - right.numbers[i];
  if (!left.pre.length || !right.pre.length) return Number(!left.pre.length) - Number(!right.pre.length);
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    const x = left.pre[i], y = right.pre[i];
    if (x === undefined || y === undefined) return Number(x !== undefined) - Number(y !== undefined);
    if (x === y) continue;
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
    if (xn && yn) return Number(x) - Number(y);
    if (xn !== yn) return xn ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
