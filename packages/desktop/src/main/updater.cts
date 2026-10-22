import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { registrar } from '../../../contracts/desktop-channels.cjs';
import { object, errorMessage } from '../../../contracts/desktop.cjs';
import { compareVersions, versionParts, type UpdateState } from '../../../contracts/desktop-updates.cjs';
import type { Electron, Window, IpcRegistrar, RecordEvent } from '../../../contracts/desktop-platform.cjs';

const repository = 'I-Davey/function-elite-opentkl', maxInstaller = 300 * 1024 * 1024;
const assetPrefix = `https://github.com/${repository}/releases/download/`;
interface Candidate { version: string; name: string; url: string; checksumUrl: string; size: number; digest?: string }
const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'Function-Elite-OpenTKL' };
async function text(url: string, limit: number): Promise<string> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.body) throw Error('Update server returned ' + response.status);
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) {
    const next = await reader.read(); if (next.done) break;
    size += next.value.length; if (size > limit) throw Error('Update response exceeds size limit');
    chunks.push(next.value);
  } } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}
async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function assetUrl(value: unknown, tag: string, name: string): string {
  if (typeof value !== 'string') throw Error('Missing release download URL');
  const expected = assetPrefix + encodeURIComponent(tag) + '/' + encodeURIComponent(name);
  if (value !== expected) throw Error('Update download is outside the official release');
  return value;
}

/** Main-process-only downloads; the renderer cannot supply URLs, paths or executable arguments. */
export function registerUpdater(ipc: IpcRegistrar, win: Window, profile: string, record: RecordEvent, automatic: boolean) {
  const { app, Notification }: Pick<Electron, 'app' | 'Notification'> = require('electron');
  const installedVersion = app.getVersion(), beta = versionParts(installedVersion).pre.length > 0;
  const directory = path.join(profile, 'updates');
  let state: UpdateState = { phase: 'idle', installedVersion, latestVersion: null, downloadedBytes: 0, totalBytes: 0, error: null };
  let candidate: Candidate | undefined, downloaded: { file: string; hash: string } | undefined;
  let checking: Promise<UpdateState> | undefined, downloading: Promise<UpdateState> | undefined, notified = '';
  const publish = (patch: Partial<UpdateState>): UpdateState => {
    state = { ...state, ...patch };
    if (!win.isDestroyed()) win.webContents.send('keyboard:update-state', state);
    return { ...state };
  };
  const failure = (caught: unknown) => {
    record('updater-error', errorMessage(caught));
    return publish({ phase: 'error', error: errorMessage(caught) });
  };
  async function check(): Promise<UpdateState> {
    if (checking) return checking;
    if (downloading || state.phase === 'ready' || state.phase === 'installing') return { ...state };
    checking = (async () => {
      publish({ phase: 'checking', error: null });
      try {
        const releases: unknown = JSON.parse(await text(`https://api.github.com/repos/${repository}/releases?per_page=30`, 2 * 1024 * 1024));
        if (!Array.isArray(releases)) throw Error('Invalid release list');
        const choices: Candidate[] = [];
        for (const item of releases) {
          const release = object(item);
          if (release.draft !== false || typeof release.tag_name !== 'string' || !Array.isArray(release.assets)) continue;
          let version: string;
          try { version = release.tag_name.replace(/^v/, ''); versionParts(version); } catch { continue; }
          if (!beta && (release.prerelease === true || versionParts(version).pre.length)) continue;
          const name = `Function-Elite-OpenTKL-${version}-windows-x64-Setup.exe`;
          const assets = release.assets.map(a => object(a));
          const setup = assets.find(a => a.name === name), sums = assets.find(a => a.name === 'SHA256SUMS.txt');
          if (!setup || !sums || !Number.isSafeInteger(setup.size) || Number(setup.size) <= 0 || Number(setup.size) > maxInstaller) continue;
          choices.push({ version, name, size: Number(setup.size), url: assetUrl(setup.browser_download_url, release.tag_name, name),
            checksumUrl: assetUrl(sums.browser_download_url, release.tag_name, 'SHA256SUMS.txt'), digest: typeof setup.digest === 'string' ? setup.digest : undefined });
        }
        choices.sort((a, b) => compareVersions(b.version, a.version));
        candidate = choices[0]; downloaded = undefined;
        if (!candidate || compareVersions(candidate.version, installedVersion) <= 0) return publish({ phase: 'current', latestVersion: null });
        publish({ phase: 'available', latestVersion: candidate.version, downloadedBytes: 0, totalBytes: candidate.size });
        if (notified !== candidate.version && automatic && Notification.isSupported()) {
          notified = candidate.version;
          const notification = new Notification({ title: 'OpenTKL update available', body: `Version ${candidate.version} is available. Click to open the app.` });
          notification.on('click', () => { if (!win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
          notification.on('failed', message => record('updater-notification-error', message));
          notification.show();
        }
        return { ...state };
      } catch (caught) { return failure(caught); }
    })();
    try { return await checking; } finally { checking = undefined; }
  }
  async function download(): Promise<UpdateState> {
    if (downloading) return downloading;
    if (state.phase === 'ready') return { ...state };
    if (!candidate || state.phase !== 'available') throw Error('Check for an available update first');
    const selected = candidate;
    downloading = (async () => {
      publish({ phase: 'downloading', downloadedBytes: 0, error: null });
      const file = path.join(directory, selected.name), partial = file + '.partial';
      try {
        const sums = await text(selected.checksumUrl, 65536);
        const matches = sums.split(/\r?\n/).map(line => /^([a-fA-F0-9]{64})[ \t]+\*?(.+)$/.exec(line)).filter(match => match?.[2] === selected.name);
        if (matches.length !== 1) throw Error('Installer checksum missing or ambiguous');
        const expected = matches[0]![1].toLowerCase();
        if (selected.digest && selected.digest !== 'sha256:' + expected) throw Error('Release checksums disagree');
        fs.mkdirSync(directory, { recursive: true });
        if (!fs.existsSync(file) || await sha256(file) !== expected) {
          if (fs.existsSync(partial)) fs.unlinkSync(partial);
          const response = await fetch(selected.url, { signal: AbortSignal.timeout(300000) });
          if (!response.ok || !response.body) throw Error('Installer download returned ' + response.status);
          const reader = response.body.getReader(), handle = await fs.promises.open(partial, 'wx'), hash = createHash('sha256');
          let bytes = 0, lastNotice = 0;
          try { for (;;) {
            const chunk = await reader.read(); if (chunk.done) break;
            bytes += chunk.value.length;
            if (bytes > selected.size || bytes > maxInstaller) throw Error('Installer exceeds declared size');
            hash.update(chunk.value); await handle.writeFile(chunk.value);
            if (Date.now() - lastNotice > 200) { publish({ downloadedBytes: bytes }); lastNotice = Date.now(); }
          }
          if (bytes !== selected.size || hash.digest('hex') !== expected) throw Error('Installer checksum or size mismatch');
          } finally { try { await reader.cancel(); } finally { await handle.close(); } }
          fs.renameSync(partial, file);
        }
        downloaded = { file, hash: expected };
        return publish({ phase: 'ready', downloadedBytes: selected.size });
      } catch (caught) {
        try { if (fs.existsSync(partial)) fs.unlinkSync(partial); } catch (cleanup) { record('updater-cleanup-error', errorMessage(cleanup)); }
        return failure(caught);
      }
    })();
    try { return await downloading; } finally { downloading = undefined; }
  }
  async function install(): Promise<UpdateState> {
    if (state.phase !== 'ready' || !downloaded) throw Error('Download and verify the update first');
    const verified = downloaded;
    publish({ phase: 'installing', error: null });
    try {
    if (await sha256(verified.file) !== verified.hash) return failure(Error('Downloaded installer changed; download it again'));
    const errorFile = path.join(directory, 'install-error.txt');
    if (fs.existsSync(errorFile)) fs.unlinkSync(errorFile);
    // The helper waits for normal shutdown and refuses installation if keyboard recovery failed.
    const script = `$ErrorActionPreference='Stop'; try {
      $taskOld = Get-Process -Id ([int]$env:OPENTKL_UPDATE_PID) -ErrorAction SilentlyContinue;
      if ($taskOld) { $taskOld | Wait-Process -Timeout 300; }
      foreach ($taskName in @('analogue-session.json','analogue-runtime-session.json','analogue-lighting-session.json','hardware-read-session.json','software-session.json')) {
        if (Test-Path -LiteralPath (Join-Path $env:OPENTKL_UPDATE_PROFILE $taskName)) { throw 'Keyboard recovery is pending; update was not started.'; }
      }
      if ((Get-FileHash -LiteralPath $env:OPENTKL_UPDATE_FILE -Algorithm SHA256).Hash.ToLowerInvariant() -ne $env:OPENTKL_UPDATE_HASH) { throw 'Installer checksum changed.'; }
      $taskArguments = @('/SP-');
      if ($env:OPENTKL_UPDATE_DIRECTORY) { $taskArguments += ('/DIR="' + $env:OPENTKL_UPDATE_DIRECTORY + '"'); }
      $taskSetup = Start-Process -FilePath $env:OPENTKL_UPDATE_FILE -ArgumentList $taskArguments -PassThru -Wait;
      if ($taskSetup.ExitCode -ne 0) { throw ('Installer exited with code ' + $taskSetup.ExitCode); }
    } catch {
      $_.Exception.Message | Set-Content -LiteralPath $env:OPENTKL_UPDATE_ERROR -Encoding UTF8;
      Start-Process -FilePath $env:OPENTKL_RESTART_EXE -ArgumentList @(('"' + $env:OPENTKL_RESTART_APP + '"'), ('"--data-dir=' + $env:OPENTKL_RESTART_DATA + '"')) -WindowStyle Hidden;
    }`;
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      detached: true, windowsHide: true, stdio: 'ignore', env: { ...process.env,
        OPENTKL_UPDATE_PID: String(process.pid), OPENTKL_UPDATE_PROFILE: profile,
        OPENTKL_UPDATE_FILE: verified.file, OPENTKL_UPDATE_HASH: verified.hash, OPENTKL_UPDATE_ERROR: errorFile,
        OPENTKL_UPDATE_DIRECTORY: path.basename(process.execPath) === 'Function Elite OpenTKL.exe' ? path.dirname(path.dirname(process.execPath)) : '',
        OPENTKL_RESTART_EXE: process.execPath, OPENTKL_RESTART_APP: path.resolve(__dirname, '..'), OPENTKL_RESTART_DATA: path.dirname(profile) },
    });
    await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
    publish({ phase: 'installing', error: null });
    setImmediate(() => app.quit());
    return { ...state };
    } catch (caught) { return failure(caught); }
  }
  const installError = path.join(directory, 'install-error.txt');
  if (fs.existsSync(installError)) {
    state.phase = 'error'; state.error = fs.readFileSync(installError, 'utf8').slice(0, 4096).trim();
  }
  const handle = registrar(ipc);
  handle('keyboard:update-status', () => ({ ...state }));
  handle('keyboard:check-updates', check);
  handle('keyboard:download-update', download);
  handle('keyboard:install-update', install);
  if (automatic) {
    const startup = setTimeout(() => void check(), 10000), periodic = setInterval(() => void check(), 6 * 60 * 60 * 1000);
    startup.unref(); periodic.unref();
    app.on('will-quit', () => { clearTimeout(startup); clearInterval(periodic); });
  }
}
