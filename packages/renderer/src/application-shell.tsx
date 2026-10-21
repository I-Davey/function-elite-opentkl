import { useEffect, useRef, useState, type ReactNode } from 'react';
import { observer } from 'mobx-react';
import { useHistory, useLocation } from 'react-router';
import { ProfilesPage, ProfileToolbar } from './profiles-page.js';
import { keyboardRoutes } from '../../keyboard-ui/src/keyboardRoutes.js';
import { errorMessage } from '../../contracts/desktop.cjs';
import type { RendererContext } from './context.js';

export interface WorkspaceAction {
  id: 'rescan' | 'onboard' | 'undo' | 'restore' | 'export' | 'import';
  label: string;
  description: string;
  complete: string;
  requiresConnection?: boolean;
  run(): unknown | Promise<unknown>;
}

const icons = {
  keyboard: 'M3 5h18v14H3zM6 9h1m3 0h1m3 0h1m3 0h.1M6 12h1m3 0h1m3 0h1m3 0h.1M7 16h10',
  lighting: 'm12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3z',
  performance: 'M4 17a9 9 0 1 1 16 0M12 14l5-6M7 17h10',
  remapping: 'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4',
  macros: 'M5 4v16l14-8L5 4z',
  sensors: 'M3 12h4l3-8 4 16 3-8h4',
  analogue: 'M6 8h12l3 11-5-3H8l-5 3 3-11zM8 10v4m-2-2h4m6 0h.1m2-2h.1',
  tools: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h4',
  undo: 'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12',
  rescan: 'M20 7v5h-5M4 17v-5h5M5.2 7a8 8 0 0 1 13-2L20 8M4 16l1.8 3a8 8 0 0 0 13-2',
  export: 'M12 16V3m-4 4 4-4 4 4M5 14v6h14v-6',
  import: 'M12 3v13m-4-4 4 4 4-4M5 14v6h14v-6',
  restore: 'M4 7v5h5M4 12a8 8 0 1 0 2-6M12 7v5l3 2',
  onboard: 'M5 5h14v14H5zM9 9h6v6H9zM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3M19 9h3m-3 6h3',
} as const;

function ShellIcon({ name }: { name: keyof typeof icons }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}

const pages = [
  { id: 'lighting', title: 'Lighting', path: keyboardRoutes.keyboardDeviceLighting },
  { id: 'performance', title: 'Performance', path: keyboardRoutes.keyboardDevicePerformance },
  { id: 'remapping', title: 'Remapping', path: keyboardRoutes.keyboardDeviceRemaps },
  { id: 'macros', title: 'Macros', path: keyboardRoutes.keyboardDeviceMacros },
] as const;

/** Desktop navigation and presentation; device edits still use the existing transaction coordinator. */
export const ApplicationShell = observer(function ApplicationShell({
  context, actions, children,
}: { context: RendererContext; actions: WorkspaceAction[]; children: ReactNode }) {
  const { ui, state } = context;
  const history = useHistory(), { pathname } = useLocation();
  const [snapshot, setSnapshot] = useState(() => state.getSnapshot());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => setSnapshot((previous) => {
      const next = state.getSnapshot();
      // Sensor reads must not repaint the entire shell or flash the save indicator.
      return previous.phase === next.phase && previous.device?.firmware === next.device?.firmware &&
        previous.pendingEdits.length === next.pendingEdits.length ? previous : next;
    });
    const unsubscribe = state.subscribe(update);
    update();
    return unsubscribe;
  }, [state]);
  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => { content.current?.scrollTo(0, 0); }, [pathname, ui.depth, ui.tools, ui.deviceState, ui.analogue]);
  const current = pages.find((page) => page.path === pathname ||
    (page.id === 'macros' && pathname.startsWith(keyboardRoutes.keyboardMacros))) ?? pages[0];
  const active = ui.tools || ui.deviceState ? 'tools' : ui.depth ? 'sensors' : ui.analogue ? 'analogue' : current.id;
  const title = ui.deviceState ? 'Keyboard settings' : ui.tools ? 'Profiles' : ui.depth ? 'Sensor monitor' : ui.analogue ? 'Analogue controls' : current.title;
  const connected = snapshot.phase === 'ready';
  const applying = snapshot.pendingEdits.length > 0;
  const connectionLabel = connected ? 'Connected' : snapshot.phase === 'disconnected' ? 'Disconnected'
    : snapshot.phase === 'error' ? 'Connection issue' : snapshot.phase === 'recovering' ? 'Recovering' : 'Connecting';
  const navigate = (page: typeof active) => {
    ui.depth = page === 'sensors';
    ui.analogue = page === 'analogue';
    ui.tools = page === 'tools';
    ui.deviceState = false;
    if (page !== 'sensors') ui.status = connected ? 'Keyboard connected' : 'Keyboard ' + connectionLabel.toLowerCase();
    const route = pages.find((item) => item.id === page)?.path;
    if (route) history.push(route);
  };
  const perform = async (action: WorkspaceAction) => {
    if (busy) return;
    setBusy(action.id);
    setNotice(null);
    try {
      const result = await action.run();
      if (result !== null) setNotice({ message: action.complete, error: false });
    } catch (error) {
      setNotice({ message: errorMessage(error), error: true });
    } finally {
      setBusy(null);
    }
  };
  const undo = actions.find((action) => action.id === 'undo');
  return (
    <div className="application-shell">
      <header className="app-titlebar">
        <span className="app-wordmark">OpenTKL</span>
        <span className="titlebar-divider" />
        <span>Function Elite</span>
      </header>
      <div className="application-layout">
        <aside className="app-sidebar" aria-label="Application navigation">
          <div className="sidebar-device">
            <div className="device-icon"><ShellIcon name="keyboard" /></div>
            <div><strong>Function Elite</strong></div>
            <span className={'connection-dot ' + (connected ? 'is-connected' : '')} title={connectionLabel} />
          </div>
          <div className="sidebar-section-label">CUSTOMISE</div>
          <nav aria-label="Keyboard settings">
            {pages.map((page) => (
              <button key={page.id} className="sidebar-link" aria-current={active === page.id ? 'page' : undefined}
                onClick={() => navigate(page.id)}>
                <ShellIcon name={page.id} /><span>{page.title}</span>
              </button>
            ))}
            <button className="sidebar-link" aria-current={active === 'analogue' ? 'page' : undefined}
              onClick={() => navigate('analogue')}><ShellIcon name="analogue" /><span>Analogue controls</span></button>
          </nav>
          <div className="sidebar-section-label sidebar-tools-label">WORKSPACE</div>
          <nav aria-label="Workspace tools">
            <button className="sidebar-link" aria-current={active === 'sensors' ? 'page' : undefined}
              onClick={() => navigate('sensors')}><ShellIcon name="sensors" /><span>Sensor monitor</span></button>
            <button className="sidebar-link" aria-current={active === 'tools' ? 'page' : undefined}
              onClick={() => navigate('tools')}><ShellIcon name="tools" /><span>Profiles</span></button>
          </nav>
          <div className="sidebar-bottom">
            <span className="sidebar-section-label">YOUR KEYBOARD</span>
            <div className="sidebar-firmware"><span>Firmware</span><strong>{snapshot.device?.firmware ?? '—'}</strong></div>
          </div>
        </aside>
        <div className="application-main">
          <header className="page-header" id="keyboard-heading">
            <div className="page-heading"><h1>{title}</h1></div>
            {!ui.depth && !ui.tools && !ui.deviceState && (
              <section className="profile-toolbar" aria-label="Active profile">
                <ProfileToolbar context={context} onProfiles={() => navigate('tools')} />
                {ui.analogue && <div id="analogue-profile-actions" className="analog-toolbar-actions" />}
                {undo && <button className="shell-button icon-action" title="Undo last device edit" aria-label="Undo device edit"
                  disabled={!connected || busy !== null} onClick={() => void perform(undo)}><ShellIcon name="undo" /></button>}
              </section>
            )}
          </header>
          <div className="workspace-scroll" ref={content}>
            <div className={'page-content ' + (active === 'tools' ? 'tools-page' : '')}>
              {ui.tools ? (
                <>
                  <ProfilesPage context={context} />
                  <details className="profile-recovery-tools"><summary>Import, export & recovery</summary>
                  <div className="tools-grid">
                    {actions.map((action) => (
                      <section className="tool-card" key={action.id}>
                        <span className="tool-icon"><ShellIcon name={action.id} /></span>
                        <h3>{action.label}</h3><p>{action.description}</p>
                        <button className="shell-button" disabled={busy !== null || (!!action.requiresConnection && !connected)}
                          onClick={() => void perform(action)}>{busy === action.id ? 'Working…' : action.label}<span aria-hidden="true">↗</span></button>
                      </section>
                    ))}
                  </div>
                  <button className="shell-text-button" onClick={() => { ui.tools = false; ui.deviceState = true; }}>Read keyboard settings <span aria-hidden="true">→</span></button>
                  </details>
                </>
              ) : children}
            </div>
          </div>
          <footer className="app-statusbar" aria-live="polite">
            <span className={'connection-dot ' + (connected ? 'is-connected' : '')} />
            <span className="offline-label">{ui.status}</span>
            <span className="save-indicator">{ui.saving?'Saving…':connected ? applying ? 'Applying changes…' : 'Up to date' : 'Settings saved locally'}</span>
          </footer>
        </div>
      </div>
      {notice && <div className={'app-notice ' + (notice.error ? 'is-error' : '')} role={notice.error ? 'alert' : 'status'}>
        <span>{notice.message}</span><button aria-label="Dismiss notification" onClick={() => setNotice(null)}>×</button>
      </div>}
    </div>
  );
});
