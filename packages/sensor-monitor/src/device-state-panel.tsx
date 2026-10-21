import * as React from 'react';
import type { DeviceStateContext, DeviceStateSnapshot } from './types.js';
function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw Error('Read device settings first');
  return value;
}
export function DeviceStatePanel({ context }: { context: DeviceStateContext }) {
  const [state, setState] = React.useState(context.initialState),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(''),
    [message, setMessage] = React.useState(''),
    [selected, setSelected] = React.useState(context.initialState?.activeProfile.wireIndex ?? 0);
  const button: React.CSSProperties = {
    background: '#56376e',
    color: '#fff',
    border: '1px solid #9975bd',
    borderRadius: 6,
    padding: '9px 14px',
    cursor: 'pointer',
  };
  const read = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await context.host.state();
      setState(next);
      setSelected(next.activeProfile.wireIndex);
      context.updateState(next);
      context.report();
    } catch (caught) {
      const e = caught instanceof Error ? caught : Error(String(caught));
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  React.useEffect(() => {
    if (!state) read();
  }, []);
  const copy = async () => {
    setBusy(true);
    setError('');
    try {
      await context.importDeviceState(required(state), selected);
      setMessage(
        'Copied lighting, brightness, polling rate, idle timeout and game mode into the local editor. Previous editor values were backed up.',
      );
    } catch (caught) {
      const e = caught instanceof Error ? caught : Error(String(caught));
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const cell: React.CSSProperties = {
    padding: '13px 16px',
    borderBottom: '1px solid #43354f',
    textAlign: 'left',
  };
  const name = (p: DeviceStateSnapshot['profiles'][number] | undefined) =>
    p?.kind === 'Hardware' ? 'Hardware ' + (p.id + 1) : 'Software';
  return (
    <section
      data-testid="device-state"
      style={{
        maxWidth: 1050,
        margin: '0 auto',
        padding: 24,
        background: '#24212b',
        border: '1px solid #554064',
        borderRadius: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 25 }}>Keyboard settings readback</h1>
        <button style={button} onClick={read} disabled={busy}>
          {busy ? 'Reading…' : 'Refresh from keyboard'}
        </button>
      </div>
      <p style={{ color: '#c4b2d2', lineHeight: 1.6 }}>
        Read directly from your keyboard. Import copies the supported values into the local editor;
        hardware settings are not applied.
      </p>
      {error && (
        <p role="alert" style={{ color: '#ffb2b2' }}>
          {error}
        </p>
      )}
      {state && (
        <React.Fragment>
          <p data-testid="device-state-summary">
            {'Firmware ' +
              state.firmware +
              ' · Active: ' +
              name(state.activeProfile) +
              ' · ' +
              state.roundTripMs +
              ' ms read'}
          </p>
          <div style={{ display: 'flex', gap: 40, margin: '24px 0' }}>
            <div>
              <small>KEY BRIGHTNESS</small>
              <div style={{ fontSize: 30 }}>{Math.round(state.brightnessKeys * 100) + '%'}</div>
            </div>
            <div>
              <small>PERIMETER BRIGHTNESS</small>
              <div style={{ fontSize: 30 }}>{Math.round(state.brightnessRing * 100) + '%'}</div>
            </div>
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              {React.createElement(
                'tr',
                null,
                ...['Profile', 'Polling rate', 'Idle timeout', 'Game mode'].map((label) => (
                  <th key={label} style={cell}>
                    {label}
                  </th>
                )),
              )}
            </thead>
            {React.createElement(
              'tbody',
              null,
              ...state.profiles.map((p) => (
                <tr
                  key={p.wireIndex}
                  data-device-profile={p.wireIndex}
                  style={{
                    background:
                      p.wireIndex === state.activeProfile.wireIndex ? '#352940' : 'transparent',
                  }}
                >
                  <td style={cell}>{name(p)}</td>
                  <td style={cell}>{p.pollingRate.slice(2) + ' Hz'}</td>
                  <td style={cell}>
                    {p.idleTimeout.disabled
                      ? 'Disabled'
                      : p.idleTimeout.timeoutSeconds / 60 + ' minutes'}
                  </td>
                  <td style={cell}>{p.gameModeEnabled ? 'On' : 'Off'}</td>
                </tr>
              )),
            )}
          </table>
          <h2 style={{ fontSize: 18, marginTop: 28 }}>Stored lighting</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              {React.createElement(
                'tr',
                null,
                ...['Profile', 'Base', 'Perimeter', 'Reactive'].map((label) => (
                  <th key={label} style={cell}>
                    {label}
                  </th>
                )),
              )}
            </thead>
            {React.createElement(
              'tbody',
              null,
              ...state.lighting.profiles.map((p) =>
                React.createElement(
                  'tr',
                  { key: p.wireIndex, 'data-lighting-profile': p.wireIndex },
                  <td style={cell}>
                    {name(state.profiles.find((s) => s.wireIndex === p.wireIndex))}
                  </td>,
                  ...[p.baseZones, p.perimeterZones, p.reactiveZones].map((zones, i) => (
                    <td key={i} style={cell}>
                      {zones.length
                        ? zones
                            .map((z) => z.effectSettings.kind.replace(/([a-z])([A-Z])/g, '$1 $2'))
                            .join(', ')
                        : 'Off'}
                    </td>
                  )),
                ),
              ),
            )}
          </table>
          <p style={{ color: '#b7a8c2', lineHeight: 1.6 }}>
            Fn lock, actuation, remaps and macros are not included in this readback yet.
          </p>
          <label style={{ display: 'block', marginBottom: 12 }}>
            {'Source profile '}
            {React.createElement(
              'select',
              {
                'aria-label': 'Source keyboard profile',
                value: selected,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSelected(Number(e.target.value)),
                disabled: busy,
                style: {
                  background: '#342b3e',
                  color: '#eee',
                  padding: 8,
                  border: '1px solid #76578d',
                  borderRadius: 5,
                },
              },
              ...state.profiles.map((p) => (
                <option key={p.wireIndex} value={p.wireIndex}>
                  {name(p)}
                </option>
              )),
            )}
          </label>
          <button data-testid="import-device-state" style={button} onClick={copy} disabled={busy}>
            Copy selected settings into local editor
          </button>
          {message && <p role="status">{message}</p>}
          <details style={{ marginTop: 24, color: '#b7a8c2' }}>
            <summary>Capture details</summary>
            <p>{'Raw replies saved to ' + state.backup}</p>
            <p>Source: independent HID · Settings writes: none</p>
          </details>
        </React.Fragment>
      )}
    </section>
  );
}
