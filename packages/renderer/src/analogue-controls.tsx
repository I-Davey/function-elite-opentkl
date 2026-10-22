import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { KeyboardHost } from '../../contracts/desktop-host.cjs';
import { binding, channels, axes, buttons, isButton, isStick, emptyProfile, evaluate, clamp, feedbackColor,
  type AnalogueProfile, type AnalogueState, type Binding, type Channel } from '../../contracts/desktop-analogue.cjs';
import type { KeyboardViewPort } from '../../sensor-monitor/src/types.js';
import { getKeyInfo } from '../../keyboard-ui/src/layouts/keyInfo.js';
import { jsKeyToKeyMap } from '../../keyboard-ui/src/layouts/keyboardInfo.js';
import { KeyboardAnaloguePreview } from '../../keyboard-ui/src/components/KeyboardAnaloguePreview.js';
import { AngleDownIcon } from '../../keyboard-ui/src/components/icons/AngleDownIcon.js';

type ResponseCurve = Pick<Binding, 'startMm' | 'endMm' | 'curve' | 'strength' | 'points' | 'outputMin' | 'outputMax' | 'smoothMs'>;
const pendingEditors = new Set<() => Promise<void>>();
export const flushAnalogueChanges = () => Promise.all([...pendingEditors].map(flush => flush()));

function NumberField({ label, value, min, max, step = .1, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange(value: number): void;
}) {
  return <label className="analog-field"><span>{label}</span><span className="analog-number">
    <input type="number" min={min} max={max} step={step} value={Number(value.toFixed(3))}
      onChange={(event) => { if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) onChange(clamp(event.target.valueAsNumber, min, max)); }} />
    {unit && <small>{unit}</small>}</span></label>;
}

/** Curve coordinates are travel in millimetres and normalized controller output. */
function CurveEditor({ value, millimetres, onChange }: { value: Binding; millimetres?: number; onChange(patch: Partial<Binding>): void }) {
  const drag = useRef<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const x = (mm: number) => 42 + mm / 4 * 476, y = (output: number) => 210 - output * 184;
  const position = (event: { currentTarget: SVGSVGElement; clientX: number; clientY: number }) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return { x: value.startMm, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: clamp((point.x - 42) / 476 * 4, value.startMm, value.endMm), y: clamp((210 - point.y) / 184) };
  };
  const movePoint = (index: number, point: { x: number; y: number }) => {
    const points = value.points.map((p) => ({ ...p }));
    if (index <= 0 || index >= points.length - 1) return;
    points[index] = { x: clamp((point.x - value.startMm) / (value.endMm - value.startMm), points[index - 1].x + .002, points[index + 1].x - .002),
      y: clamp((point.y - value.outputMin) / Math.max(.001, value.outputMax - value.outputMin)) };
    onChange({ points });
  };
  return <>
    <div className="analog-curve-types" aria-label="Response curve">
      {(['linear', 'exponential', 'logarithmic', 'custom'] as const).map((curve) =>
        <button key={curve} aria-pressed={value.curve === curve} onClick={() => onChange({ curve })}>{curve}</button>)}
    </div>
    <svg ref={svg} className="analog-curve" viewBox="0 0 550 250" role="img" aria-label="Response curve: estimated travel in millimetres to controller output"
      onPointerMove={(event) => { if (drag.current !== null) movePoint(drag.current, position(event)); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onDoubleClick={(event) => {
        if (value.curve !== 'custom' || value.points.length >= 32) return;
        const point = position(event);
        const next = { x: (point.x - value.startMm) / (value.endMm - value.startMm), y: clamp((point.y - value.outputMin) / Math.max(.001, value.outputMax - value.outputMin)) };
        onChange({ points: [...value.points, next] });
      }}>
      {[0, .25, .5, .75, 1].map((n) => <g key={n}><line x1="42" x2="518" y1={y(n)} y2={y(n)} className="analog-grid-line" /><text x="32" y={y(n) + 4} textAnchor="end">{n * 100}</text></g>)}
      {[0, .1, 1, 2, 3, 4].map((mm) => <g key={mm}><line x1={x(mm)} x2={x(mm)} y1="26" y2="210" className={mm === .1 ? 'analog-reference' : 'analog-grid-line'} />
        <text x={x(mm)} y={mm === .1 ? 242 : 229} textAnchor="middle">{mm}{mm === 4 ? ' mm' : ''}</text></g>)}
      <text x="42" y="14">Output %</text>
      <path className="analog-curve-line" d={Array.from({ length: 161 }, (_, i) => `${i ? 'L' : 'M'}${x(i / 40)},${y(evaluate(i / 40, value))}`).join(' ')} />
      {value.curve === 'custom' && value.points.slice(1, -1).map((point, index) => <circle key={index} r="6"
        cx={x(value.startMm + point.x * (value.endMm - value.startMm))} cy={y(value.outputMin + point.y * (value.outputMax - value.outputMin))}
        className="analog-control-point" onPointerDown={(event) => { event.preventDefault(); drag.current = index + 1; svg.current?.setPointerCapture(event.pointerId); }} />)}
      {millimetres !== undefined && <circle className="analog-live-point" r="5" cx={x(millimetres)} cy={y(evaluate(millimetres, value))} />}
    </svg>
    {(value.curve === 'exponential' || value.curve === 'logarithmic') && <label className="analog-strength">Strength
      <input type="range" min=".1" max="10" step=".1" value={value.strength} onChange={(event) => onChange({ strength: Number(event.target.value) })} />
      <output>{value.strength.toFixed(1)}</output></label>}
    {value.curve === 'custom' && <details className="analog-points"><summary>Edit control points <span>Drag points or double-click the graph to add</span></summary>
      {value.points.slice(1, -1).map((p, i) => <div key={i}>
        <NumberField label={'Point ' + (i + 1) + ' · travel'} value={value.startMm + p.x * (value.endMm - value.startMm)} min={value.startMm} max={value.endMm} unit="mm"
          onChange={(x) => movePoint(i + 1, { x, y: value.outputMin + p.y * (value.outputMax - value.outputMin) })} />
        <NumberField label="Output" value={p.y * 100} min={0} max={100} step={1} unit="%"
          onChange={(n) => onChange({ points: value.points.map((point, j) => j === i + 1 ? { ...point, y: n / 100 } : point) })} />
        <button className="shell-text-button" aria-label={'Remove point ' + (i + 1)} onClick={() => onChange({ points: value.points.filter((_, j) => j !== i + 1) })}>×</button>
      </div>)}
      <button className="shell-text-button" onClick={() => onChange({ points: [...value.points, { x: .5, y: .5 }] })}>Add midpoint</button>
    </details>}
  </>;
}

function ControllerPreview({ state }: { state: AnalogueState | null }) {
  return <div className="analog-controller-preview">
    {(['l', 'r'] as const).map((side) => <div className="analog-stick" key={side}>
      <svg viewBox="0 0 100 100" role="img" aria-label={side === 'l' ? 'Left stick output' : 'Right stick output'}>
        <circle cx="50" cy="50" r="40" /><path d="M10 50h80M50 10v80" />
        <circle className="analog-stick-position" cx={50 + (state?.axes[side === 'l' ? 'lx' : 'rx'] ?? 0) * 38} cy={50 - (state?.axes[side === 'l' ? 'ly' : 'ry'] ?? 0) * 38} r="5" />
      </svg><span>{side === 'l' ? 'Left stick' : 'Right stick'}</span></div>)}
    <div className="analog-triggers">{(['lt', 'rt'] as const).map((axis) => <label key={axis}>{axis.toUpperCase()}<meter min="0" max="1" value={state?.axes[axis] ?? 0} /><output>{Math.round((state?.axes[axis] ?? 0) * 100)}%</output></label>)}</div>
    <div className="analog-buttons">{Object.keys(buttons).map((key) => <span key={key} title={channels[key as Channel]} data-held={state?.buttons[key as keyof typeof buttons]}>{key.startsWith('dpad') ? '↑↓←→'[['Up', 'Down', 'Left', 'Right'].indexOf(key.slice(4))] : key.toUpperCase()}</span>)}</div>
  </div>;
}

function useAnalogueProfile(host: KeyboardHost, profileId: string) {
  const [settings, setSettings] = useState<AnalogueProfile>(emptyProfile), [state, setState] = useState<AnalogueState | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(true);
  const [ready, setReady] = useState(false);
  const pending = useRef<AnalogueProfile | null>(null), saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const generation = useRef(0);
  useEffect(() => {
    const ticket = ++generation.current;
    let disposed = false, timer: ReturnType<typeof setTimeout>;
    setReady(false);
    host.analogueProfile(profileId).then((value) => {
      if (disposed) return;
      setState(value); setSettings(value.settings); setSaved(true); setError(''); setReady(true);
      const poll = async () => {
        try { const next = await host.analogueState(); if (!disposed && ticket === generation.current) setState(next); }
        catch (caught) { if (!disposed) setError(String(caught)); }
        if (!disposed) timer = setTimeout(poll, 80);
      };
      void poll();
    }).catch((caught) => { if (!disposed) setError(String(caught)); });
    return () => { disposed = true; clearTimeout(timer); clearTimeout(saveTimer.current);
      if (pending.current) { const value = pending.current; pending.current = null; void host.analogueSave(value, profileId).catch(() => {}); }
    };
  }, [host, profileId]);
  const flush = async () => {
    clearTimeout(saveTimer.current);
    const next = pending.current;
    if (!next) return;
    const ticket = generation.current;
    pending.current = null;
    try { const result = await host.analogueSave(next, profileId); if (ticket === generation.current) { setState(result); if (!pending.current) setSaved(true); setError(''); } }
    catch (caught) { if (ticket === generation.current) { pending.current ??= next; setError(String(caught)); } throw caught; }
  };
  const update = (next: AnalogueProfile) => {
    setSettings(next); pending.current = next; setSaved(false);
    clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => void flush().catch(() => {}), 300);
  };
  useEffect(() => { pendingEditors.add(flush); return () => { pendingEditors.delete(flush); }; }, [host, profileId]);
  const act = async (operation: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await flush(); await operation(); } catch (caught) { setError(String(caught)); } finally { setBusy(false); }
  };
  return { settings, state, ready, busy, error, saved, update, act, setState, setSettings, setSaved };
}

/** Lighting owns feedback appearance; analogue controls only link to this compact disclosure. */
export function AnalogueLightingFeedback({ host, profileId }: { host: KeyboardHost; profileId: string }) {
  const { settings, state, ready, busy, error, update } = useAnalogueProfile(host, profileId);
  const change = (patch: Partial<AnalogueProfile['feedback']>) => update({ ...settings, feedback: { ...settings.feedback, ...patch } });
  return <details id="analogue-lighting-feedback" className="analog-feedback-settings">
    {settings.feedback.enabled && <style>{Object.entries(settings.bindings).filter(([, binding]) => binding.enabled).map(([key, binding]) =>
      `.keyboard-preview-card [data-code="key-${key}"]::after{content:"";position:absolute;inset:5px;pointer-events:none;z-index:1;border-radius:3px;opacity:.4;background:${feedbackColor(binding, state?.overriddenKeys.includes(Number(key)) ?? false, settings.feedback)}}`
    ).join('\n')}</style>}
    <summary><strong>Analogue feedback</strong><span>{settings.feedback.enabled ? 'On' : 'Off'}</span></summary>
    <fieldset disabled={!ready || busy} className="analog-editor-fields">
      <label className="analog-check"><input type="checkbox" checked={settings.feedback.enabled} onChange={event => change({ enabled: event.target.checked })} />Show controller output on mapped keys</label>
      <div className="analog-feedback-colors">{([
        ['activeColor', 'Controller + normal key'], ['suppressedColor', 'Controller only'], ['overrideColor', 'Controller off'],
      ] as const).map(([name, label]) => <label key={name}><input type="color" value={settings.feedback[name]} onChange={event => change({ [name]: event.target.value })} /><span>{label}</span></label>)}</div>
      <div className="analog-pair-fields"><NumberField label="Brightness" value={settings.feedback.brightness * 100} min={0} max={100} step={1} unit="%" onChange={value => change({ brightness: value / 100 })} />
        <NumberField label="Fade" value={settings.feedback.fadeMs} min={0} max={500} step={10} unit="ms" onChange={fadeMs => change({ fadeMs })} /></div>
      <p className="analog-hint">“Controller only” applies when Overwrite default key is enabled. Brightness applies equally to all three colours.</p>
    </fieldset>
    {(error || state?.feedbackError) && <p className="analog-inline-error" role="alert">{error || state?.feedbackError}</p>}
  </details>;
}

export function AnalogueControls({ host, keyboardView, profileId, onLighting }: {
  host: KeyboardHost; keyboardView: KeyboardViewPort; profileId: string; onLighting(key: number): void;
}) {
  const { settings, state, ready, busy, error, saved, update, act, setState, setSettings, setSaved } = useAnalogueProfile(host, profileId);
  const [selected, setSelected] = useState(26), [copiedCurve, setCopiedCurve] = useState<ResponseCurve | null>(null);
  const [exportPath, setExportPath] = useState('');
  const [capturingShortcut, setCapturingShortcut] = useState(false), captured = useRef<number[]>([]);
  useEffect(() => {
    void host.analogueShortcutCapture(capturingShortcut).catch(() => setCapturingShortcut(false));
    if (!capturingShortcut) return;
    const timeout = setTimeout(() => setCapturingShortcut(false), 14000);
    return () => { clearTimeout(timeout); void host.analogueShortcutCapture(false).catch(() => {}); };
  }, [capturingShortcut, host]);
  const { layout, keyboardInfo } = keyboardView;
  const keyLabel = (code: number) => ({ 44: 'Space', 224: 'Left Ctrl', 225: 'Left Shift', 226: 'Left Alt', 228: 'Right Ctrl', 229: 'Right Shift', 230: 'Right Alt' } as Record<number, string>)[code] ?? String(getKeyInfo(code, keyboardInfo.layout, keyboardInfo.region).label || code);
  const current = settings.bindings[String(selected)] ?? binding();
  const enabledCount = Object.values(settings.bindings).filter(b => b.enabled).length;
  const patchKey = (patch: Partial<Binding>) => update({ ...settings, bindings: { ...settings.bindings, [selected]: binding({ ...current, ...patch }) } });
  const changeOverride = (patch: Partial<AnalogueProfile['override']>) => update({ ...settings, override: { ...settings.override, ...patch } });
  const calibrate = (action: 'start' | 'capture' | 'apply' | 'cancel') => void act(async () => {
    const value = await host.analogueCalibrate({ key: state?.calibration?.key ?? selected, action });
    setState(value); if (action === 'apply') setSettings(value.settings);
  });
  const mm = state?.connected ? state.rawMm[String(selected)] : undefined;
  const profileActions = document.getElementById('analogue-profile-actions');
  return <section className="analogue-page" aria-label="Analogue controls">
    {profileActions && createPortal(<>
      <button className="shell-button" title="Import analogue mappings and curves into this profile" disabled={!ready || busy || state?.preview} onClick={() => void act(async () => {
        const value = await host.analogueImport(); if (value) { setState(value); setSettings(value.settings); setSaved(true); }
      })}>Import</button>
      <button className="shell-button" title="Save analogue mappings and curves to Downloads and show the file" disabled={!ready || busy || state?.preview} onClick={() => void act(async () => { const file = await host.analogueExport(); if (file) setExportPath(file); })}>Export</button>
    </>, profileActions)}
    {exportPath && <p className="analog-hint" role="status">Exported to {exportPath}</p>}
    {(error || state?.error || state?.feedbackError) && <div className="analog-error" role="alert">{error || state?.error || state?.feedbackError}
      {state?.recoveryPending && <button className="shell-button" disabled={busy} onClick={() => void act(async () => setState(await host.analogueEnable(false)))}>Restore normal keys</button>}</div>}
    <div className="keyboard-preview-card analogue-keyboard-card">
      <div className="preview-card-heading"><strong>Keyboard <span className="preview-selection-count"> · {enabledCount} mapped</span>
        <button className="analog-lighting-link" onClick={() => onLighting(selected)}>Lighting ↗</button></strong>
        <div className="analog-toolbar-actions">
          <span className="analog-status"><span className={'connection-dot ' + (state?.connected ? 'is-connected' : '')} />
            {state?.transitioning ? 'Release mapped keys to switch' : state?.overriddenKeys.length ? 'Controller off' : state?.calibration ? 'Calibrating' : state?.running ? state.connected ? 'Live · ' + state.rateHz.toFixed(0) + ' Hz' : 'Waiting for keys' : state?.preview ? 'Preview' : 'Off'}</span>
          {!saved && <span className="analog-save-state">Saving…</span>}
          <div className="analog-output-control">
          <label className="analog-output-toggle"><input type="checkbox" checked={state?.running ?? false}
            disabled={busy || !ready || state?.preview || (!state?.running && enabledCount === 0)}
            onChange={(event) => { const enabled = event.target.checked; void act(async () => setState(await host.analogueEnable(enabled))); }} />Controller output</label>
          <details className="analog-popover analog-override-menu"><summary title="In-game override settings" aria-label="In-game override settings"><AngleDownIcon aria-hidden="true" focusable="false" /></summary>
            <div className="analog-popover-content">
              <strong>Controller shortcut</strong>
              <fieldset className="analog-editor-fields" disabled={!ready || busy}>
              <label className="analog-check"><input type="checkbox" disabled={!ready || busy} checked={settings.override.enabled} onChange={event => changeOverride({ enabled: event.target.checked })} />Enable shortcut</label>
              <label className="analog-field"><span>Shortcut</span><button className="shell-button" aria-pressed={capturingShortcut}
                onClick={() => { captured.current = []; setCapturingShortcut(true); }}
                onBlur={() => setCapturingShortcut(false)}
                onKeyDown={event => {
                  if (!capturingShortcut) return;
                  event.preventDefault(); event.stopPropagation();
                  if (event.code === 'Escape') { setCapturingShortcut(false); return; }
                  const key = jsKeyToKeyMap[event.code];
                  if (key !== undefined && !captured.current.includes(key) && captured.current.length < 4) captured.current.push(key);
                }} onKeyUp={event => {
                  if (!capturingShortcut) return;
                  event.preventDefault(); event.stopPropagation();
                  if (captured.current.length) { changeOverride({ shortcut: [...captured.current] }); setCapturingShortcut(false); }
                }}>{capturingShortcut ? 'Press shortcut…' : settings.override.shortcut.map(keyLabel).join(' + ') || 'Choose shortcut'}</button></label>
              <p className="analog-hint">Toggles all controller controls on or off, including in-game. After a sensor timeout, release the shortcut and press it again to retry. Normal keys return when released. Use unmapped shortcut keys.</p>
              </fieldset>
            </div>
          </details>
          </div>
        </div></div>
      <div className="analogue-keyboard-surface">
        <KeyboardAnaloguePreview layout={layout} keyboardInfo={keyboardInfo} bindings={settings.bindings} selected={selected}
          depths={state?.connected ? state.rawMm : {}} overriddenKeys={state?.overriddenKeys ?? []}
          pendingKeys={state?.transitioning ? Object.entries(settings.bindings).filter(([, b]) => b.enabled).map(([key]) => Number(key)) : []}
          feedback={settings.feedback} onSelect={key => { if (!state?.calibration) setSelected(key); }} />
      </div>
    </div>
    <fieldset disabled={!ready || busy} className="analog-editor-fields">
      <div className="analog-edit-grid">
        <section className="analog-card analog-mapping-card">
          <div className="analog-section-heading"><div className="analog-selected-key">{keyLabel(selected)}</div>
            <label className="analog-switch"><span>Analogue key</span><input type="checkbox" role="switch" checked={current.enabled} onChange={(e) => patchKey({ enabled: e.target.checked })} /><span className="analog-switch-track" /></label></div>
          <label className="analog-field"><span>Controller control</span><select value={current.channel} onChange={(e) => patchKey({ channel: e.target.value as Channel })}>
            <optgroup label="Sticks & triggers">{Object.keys(axes).map((channel) => <option value={channel} key={channel}>{channels[channel as Channel]}</option>)}</optgroup>
            <optgroup label="Buttons">{Object.keys(buttons).map((channel) => <option value={channel} key={channel}>{channels[channel as Channel]}</option>)}</optgroup>
          </select></label>
          {isStick(current.channel) && <label className="analog-field"><span>Direction</span><select value={current.direction} onChange={(e) => patchKey({ direction: Number(e.target.value) as 1 | -1 })}>
            <option value="1">{current.channel.endsWith('x') ? 'Right (+)' : 'Up (+)'}</option><option value="-1">{current.channel.endsWith('x') ? 'Left (−)' : 'Down (−)'}</option>
          </select></label>}
          <div className="analog-travel-fields"><NumberField label="Start travel" value={current.startMm} min={0} max={3.9} step={.05} unit="mm" onChange={(startMm) => patchKey({ startMm })} />
            <NumberField label="Full output at" value={current.endMm} min={current.startMm + .05} max={4} step={.05} unit="mm" onChange={(endMm) => patchKey({ endMm })} />
            <details className="analog-popover analog-calibration-menu" open={state?.calibration ? true : undefined}><summary title="Calibrate selected key travel">Calibrate</summary>
              <div className="analog-popover-content"><strong>Calibrate {keyLabel(selected)}</strong>
                {state?.calibration ? <>
                  <p>{state.calibration.phase === 'released' ? 'Release the key completely, then capture its resting position.' : state.calibration.phase === 'pressed' ? 'Hold the key fully down, then capture its full press.' : 'Endpoints captured. Apply to use this key’s calibrated travel.'}</p>
                  {state.calibration.result && <p className="analog-calibration-result">{state.calibration.result.released.toFixed(1)} → {state.calibration.result.pressed.toFixed(1)} ADC · noise ±{state.calibration.result.noise.toFixed(1)}</p>}
                  {state.calibration.error && <p className="analog-inline-error" role="alert">{state.calibration.error}</p>}
                  <div className="analog-toolbar-actions"><button className="shell-button" disabled={busy || state.calibration.samples < 12} onClick={() => calibrate(state.calibration!.phase === 'review' ? 'apply' : 'capture')}>{state.calibration.phase === 'review' ? 'Apply calibration' : state.calibration.phase === 'released' ? 'Capture released' : 'Capture full press'}</button>
                    <button className="shell-button" disabled={busy} onClick={() => calibrate('cancel')}>Cancel</button></div>
                </> : <><p>Capture the released and fully pressed sensor endpoints. Controller output pauses during calibration.</p>
                  <button className="shell-button" disabled={busy || !!state?.preview} onClick={() => calibrate('start')}>Start calibration</button>
                  {current.calibration && <button className="shell-text-button" onClick={() => patchKey({ calibration: undefined })}>Reset calibration</button>}
                  {state?.preview && <p className="analog-hint">Connect through the desktop app to calibrate.</p>}</>}
              </div>
            </details></div>
          <label className="analog-switch analog-overwrite"><span>Overwrite default key</span><input type="checkbox" role="switch" checked={current.overwriteDefault} onChange={(e) => patchKey({ overwriteDefault: e.target.checked })} /><span className="analog-switch-track" /></label>
          <p className="analog-hint">Restored automatically when stopped.</p>
          {isStick(current.channel) && <label className="analog-field"><span>Link opposite direction</span><select value="" onChange={(e) => {
            if (!e.target.value) return;
            update({ ...settings, bindings: { ...settings.bindings, [e.target.value]: binding({ ...settings.bindings[e.target.value], enabled: true, channel: current.channel, direction: -current.direction }) } });
          }}><option value="">Choose a key…</option>{layout.flat().filter((key) => key.code !== undefined && key.code !== selected).map((key, index) => <option value={key.code} key={index}>{keyLabel(key.code!)}</option>)}</select></label>}
        </section>
        <section className="analog-card analog-curve-card"><div className="analog-section-heading"><h2>Response curve</h2>
          <span className="analog-live-reading">{mm === undefined ? '— mm' : mm.toFixed(2) + ' mm'} <span>→</span> {Math.round((state?.keyLevels[String(selected)] ?? 0) * 100)}%</span></div>
          <div className="analog-curve-tools">
            <button className="shell-button" onClick={() => {
              const { startMm, endMm, curve, strength, points, outputMin, outputMax, smoothMs } = current;
              setCopiedCurve(structuredClone({ startMm, endMm, curve, strength, points, outputMin, outputMax, smoothMs }));
            }}>Copy curve</button>
            <button className="shell-button" disabled={!copiedCurve} onClick={() => { if (copiedCurve) patchKey(structuredClone(copiedCurve)); }}>Paste curve</button>
          </div>
          <CurveEditor value={current} millimetres={mm} onChange={patchKey} />
          <details className="analog-advanced"><summary>Output range & smoothing</summary><div className="analog-curve-options"><NumberField label="Minimum output" value={current.outputMin * 100} min={0} max={100} step={1} unit="%" onChange={(n) => patchKey({ outputMin: n / 100 })} />
            <NumberField label="Maximum output" value={current.outputMax * 100} min={current.outputMin * 100} max={100} step={1} unit="%" onChange={(n) => patchKey({ outputMax: n / 100 })} />
            <NumberField label="Smoothing" value={current.smoothMs} min={0} max={500} step={1} unit="ms" onChange={(smoothMs) => patchKey({ smoothMs })} /></div></details>
          {isButton(current.channel) && <div className="analog-pair-fields"><NumberField label="Button press" value={current.pressThreshold * 100} min={1} max={100} step={1} unit="%" onChange={(n) => patchKey({ pressThreshold: n / 100 })} />
            <NumberField label="Button release" value={current.releaseThreshold * 100} min={0} max={current.pressThreshold * 100 - .1} step={1} unit="%" onChange={(n) => patchKey({ releaseThreshold: n / 100 })} /></div>}
          <p className="analog-hint">Travel is estimated from the sensor. Below 0.6 mm is extrapolated.</p>
        </section>
      </div>
    </fieldset>
    <section className="analog-card analog-output-card"><div className="analog-section-heading"><h2>Controller output</h2>
      <label className="analog-check"><input type="checkbox" disabled={!ready || busy} checked={settings.normalizeSticks} onChange={(event) => update({ ...settings, normalizeSticks: event.target.checked })} />Normalize diagonals</label>
    </div><ControllerPreview state={state} /></section>
  </section>;
}
