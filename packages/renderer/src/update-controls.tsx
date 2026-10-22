import { useEffect, useState } from 'react';
import type { KeyboardHost } from '../../contracts/desktop-host.cjs';
import type { UpdateState } from '../../contracts/desktop-updates.cjs';
import { errorMessage } from '../../contracts/desktop.cjs';

export function UpdateControls({ host, beforeInstall }: { host: KeyboardHost; beforeInstall(): Promise<void> }) {
  const [state, setState] = useState<UpdateState | null>(null), [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  useEffect(() => {
    let disposed = false;
    const receive = (value: UpdateState) => { if (!disposed) setState(value); };
    const unsubscribe = host.onUpdateState(receive);
    void host.updateStatus().then(receive).catch(caught => { if (!disposed) setError(errorMessage(caught)); });
    return () => { disposed = true; unsubscribe(); };
  }, [host]);
  const run = async (operation: () => Promise<UpdateState>) => {
    if (working) return;
    setWorking(true); setError('');
    try { setState(await operation()); } catch (caught) { setError(errorMessage(caught)); }
    finally { setWorking(false); }
  };
  const phase = state?.phase, busy = working || phase === 'checking' || phase === 'downloading' || phase === 'installing';
  const percent = state?.totalBytes ? Math.floor(state.downloadedBytes / state.totalBytes * 100) : 0;
  const message = error || state?.error || (phase === 'available' ? `Version ${state?.latestVersion} is available`
    : phase === 'downloading' ? `Downloading update · ${percent}%`
    : phase === 'ready' ? `Version ${state?.latestVersion} is ready to install`
    : phase === 'installing' ? 'Restoring keyboard settings before opening Setup…'
    : phase === 'checking' ? 'Checking for updates…'
    : phase === 'current' ? 'Up to date' : 'Automatic update checks enabled');
  return <section className={'app-update-row' + (phase === 'available' || phase === 'ready' ? ' has-update' : '')} aria-label="Application updates">
    <span>OpenTKL {state?.installedVersion ? 'v' + state.installedVersion : ''}</span>
    <span role={error || state?.error ? 'alert' : 'status'}>{message}</span>
    <div className="app-update-actions">
      {phase === 'available' && <button className="shell-button" disabled={busy} onClick={() => void run(() => host.downloadUpdate())}>Download update</button>}
      {phase === 'ready' && <button className="shell-button" disabled={busy} onClick={() => void run(async () => { await beforeInstall(); return host.installUpdate(); })}>Install update</button>}
      <button className="shell-text-button" disabled={busy || phase === 'ready'} onClick={() => void run(() => host.checkForUpdates())}>Check for updates</button>
    </div>
  </section>;
}
