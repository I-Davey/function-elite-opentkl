import * as React from 'react';
import type { SensorMonitorContext, MonitorSnapshot, RowsProps } from './types.js';
import * as sensorStats from './sensor-stats.js';
function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw Error('Incomplete sensor selection');
  return value;
}
/** CAM Performance view with explicit device and diagnostics dependencies. */
export function DepthPanel({ context }: { context: SensorMonitorContext }) {
  const curve = context.curve;
  const [snapshot, setSnapshot] = React.useState<MonitorSnapshot | null>(null),
    [error, setError] = React.useState(''),
    [readError, setReadError] = React.useState('');
  const study = context.restStudy;
  const [paused, setPaused] = React.useState(false),
    [selected, setSelected] = React.useState(26);
  const [windowMs, setWindowMs] = React.useState(30000),
    [zoom, setZoom] = React.useState('log');
  const [calibration, setCalibration] = React.useState(
    context.diagnostics.sensorNoiseCalibration ?? null,
  );
  const [calibrating, setCalibrating] = React.useState(false),
    [progress, setProgress] = React.useState(0);
  const [sensorsOpen, setSensorsOpen] = React.useState(false);
  const [, refresh] = React.useState(0),
    history = React.useRef(new sensorStats.SensorHistory()),
    capture = React.useRef<sensorStats.NoiseCalibration | null>(null),
    start = React.useRef(performance.now());
  if (!history.current) history.current = new sensorStats.SensorHistory();
  const latestSample = React.useRef<MonitorSnapshot | null>(null);
  const calibrationRef = React.useRef(calibration);
  calibrationRef.current = calibration;
  React.useEffect(() => {
    if (paused) {
      if (latestSample.current) setSnapshot(latestSample.current);
      context.diagnostics.depthConnection = { status: 'paused' };
      context.report();
      return;
    }
    let cancelled = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      first = true,
      failures = 0,
      lastPaint = -Infinity,
      lastSampledAt = '';
    const poll = async () => {
      try {
        const value = await context.host.sensors();
        if (cancelled) return;
        // The controller can share its latest sample. Count each observation only once.
        if (value.sampledAt === lastSampledAt) { timer = setTimeout(poll, 1); return; }
        lastSampledAt = value.sampledAt;
        const time = performance.now() - start.current;
        if (calibrationRef.current?.devicePath && (calibrationRef.current.devicePath !== value.devicePath || calibrationRef.current.firmware !== value.firmware)) {
          calibrationRef.current = null; setCalibration(null); context.diagnostics.sensorNoiseCalibration = null;
          history.current.clear();
        }
        history.current.append(value, time);
        latestSample.current = value;
        if (capture.current) {
          try {
            const complete = capture.current.append(value, time);
            setProgress(
              Math.min(
                99,
                Math.round(((time - capture.current.startedAt) / capture.current.durationMs) * 100),
              ),
            );
            if (complete) {
              const result = capture.current.finish();
              context.diagnostics.sensorNoiseCalibration = result;
              calibrationRef.current = result;
              setCalibration(result);
              history.current.clear();
              capture.current = null;
              setCalibrating(false);
              setProgress(100);
              context.report();
            } else if (time - capture.current.startedAt > capture.current.durationMs + 8000)
              throw Error('Not enough samples. Retry noise calibration.');
          } catch (caught) {
            const failure = caught instanceof Error ? caught : Error(String(caught));
            capture.current = null;
            setCalibrating(false);
            setError(failure.message);
          }
        }
        if (first || time - lastPaint >= 1000 / 30) {
          setSnapshot(value);
          setReadError('');
          lastPaint = time;
        }
        failures = 0;
        context.diagnostics.depthSnapshot = value;
        context.diagnostics.depthStatistics = history.current.summary();
        context.diagnostics.depthConnection = {
          status: 'live',
          sampledAt: value.sampledAt,
          roundTripMs: value.roundTripMs,
        };
        if (first) {
          first = false;
          context.setStatusLabel(
            'Raw Sensor Monitor · firmware ' + value.firmware + ' · read only',
          );
          setTimeout(() => context.report(), 50);
        }
        timer = setTimeout(poll, 0);
      } catch (caught) {
        const failure = caught instanceof Error ? caught : Error(String(caught));
        if (cancelled) return;
        history.current.clear();
        latestSample.current = null;
        capture.current = null;
        setCalibrating(false);
        setSnapshot(null);
        setReadError(failure.message);
        context.diagnostics.depthSnapshot = null;
        context.diagnostics.depthStatistics = null;
        context.diagnostics.depthConnection = { status: 'error', error: failure.message };
        context.report();
        if (!failure.message.includes('only verified'))
          timer = setTimeout(poll, Math.min(5000, 500 * 2 ** ++failures));
      }
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [paused]);
  const { layout, theme, Rows, Wrapper, Key, keyboardInfo } = context.keyboardView;
  const keyScalar = 42;
  const renderRows = (props: Omit<RowsProps, 'children'>, children: RowsProps['children']) => (
    <Rows {...props} children={children} />
  );
  const byKey = new Map((snapshot?.keys || []).map((key) => [key.physicalKeyId, key]));
  const active = byKey.get(selected),
    summary = history.current.summary(),
    stats = history.current.key(selected);
  const series = history.current.series(selected),
    format = (v: number | undefined | null, digits = 2) =>
      typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—';
  const corrected = active ? sensorStats.conditioned(active, calibration, curve) : null;
  const assumptions = active
    ? (zoom === 'log' ? [0, .01, .05, .1, .2, .4, 1, 2, 4] : [0, .1, .6, 1, 1.5, 2, 2.5, 3, 3.5, 4]).map((mm) => ({
        mm,
        adc:
          required(corrected).baseline +
          active.scale * sensorStats.coefficientAtMillimetres(mm, curve),
      }))
    : [];
  const graphMin =
    zoom !== 'noise' && active
      ? Math.min(required(corrected).baseline, stats?.min ?? required(corrected).baseline) - 10
      : (stats?.min ?? 0) - 3;
  const graphMax =
    zoom !== 'noise' && active
      ? Math.max(required(assumptions.at(-1)).adc, stats?.max ?? 0) + 10
      : (stats?.max ?? 1) + 3;
  const firstTime = series[0]?.time ?? 0,
    lastTime = series.at(-1)?.time ?? firstTime + 1;
  const x = (time: number) => 64 + ((time - firstTime) / Math.max(1, lastTime - firstTime)) * 812;
  const baseline = corrected?.baseline ?? 0;
  const depthAtAdc = (adc: number) => active ? sensorStats.millimetresAtCoefficient((adc - baseline) / active.scale, curve) : 0;
  // A signed logarithm includes zero and negative rest noise, with detail around 0.1 mm.
  const log = (mm: number) => Math.sign(mm) * Math.log1p(Math.abs(mm) / .01);
  const logMin = log(Math.min(-.05, depthAtAdc(stats?.min ?? baseline))), logMax = log(4);
  const y = (adc: number) => 254 - (zoom === 'log'
    ? (log(depthAtAdc(adc)) - logMin) / (logMax - logMin)
    : (adc - graphMin) / (graphMax - graphMin)) * 232;
  const adcAtFraction = (f: number) => {
    if (zoom !== 'log' || !active) return graphMax - (graphMax - graphMin) * f;
    const position = logMax - (logMax - logMin) * f;
    const mm = Math.sign(position) * Math.expm1(Math.abs(position)) * .01;
    return baseline + Math.sign(mm) * active.scale * sensorStats.coefficientAtMillimetres(Math.abs(mm), curve);
  };
  const points = (
    values: {
      time: number;
      adc: number;
    }[],
  ) => values.map((p) => x(p.time).toFixed(2) + ',' + y(p.adc).toFixed(2)).join(' ');
  const processedSeries = active
    ? series.map((p) => ({
        time: p.time,
        adc: sensorStats.conditioned(
          { ...active, adc: p.adc, filteredAdc: p.filteredAdc },
          calibration,
          curve,
        ).adc,
      }))
    : [];
  const metric = (label: string, value: React.ReactNode) => (
    <div>
      <span className="sm-muted">{label}</span>
      <output>{value}</output>
    </div>
  );
  const cancelCalibration = () => {
    capture.current = null;
    setCalibrating(false);
  };
  const calibrate = () => {
    setError('');
    setProgress(0);
    setCalibrating(true);
    capture.current = new sensorStats.NoiseCalibration(performance.now() - start.current, {
      durationMs: 15000,
      curve,
    });
  };
  return (
    <section className="sensor-monitor" data-testid="live-depth-panel">
      <header className="sm-toolbar sm-monitor-controls">
        <div className="sm-stream-status" data-testid="sensor-rate">
          <span className="sm-live-dot" data-live={!!snapshot && !paused} />
          <span>{paused ? 'Paused' : snapshot ? 'Live' : 'No readings'}</span>
          <output title="Host observation rate, separate from USB polling rate">
            {format(summary.updatesPerSecond, 1)} Hz
          </output>
        </div>
        <div className="sm-actions">
          <select
            aria-label="Statistics window"
            value={windowMs}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const value = Number(e.target.value);
              setWindowMs(value);
              history.current = new sensorStats.SensorHistory(value);
              refresh((n) => n + 1);
            }}
          >
            {[5000, 10000, 30000, 60000].map((v) => (
              <option key={v} value={v}>
                {v / 1000 + ' s history'}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              history.current.clear();
              refresh((n) => n + 1);
            }}
          >
            Reset
          </button>
          <button
            data-testid="pause-sensors"
            onClick={() => {
              setError('');
              cancelCalibration();
              if (paused) history.current.clear();
              setPaused(!paused);
            }}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </header>
      {readError && (
        <p role="alert" className="sm-read-error" title={readError}>
          {readError.includes('browser preview') ? 'Live readings are available in the desktop app.'
            : readError.includes('Close NZXT CAM') ? 'Close NZXT CAM to read the keyboard sensors.'
              : 'Sensor readings unavailable. Reconnect your keyboard.'}
        </p>
      )}
      <div className="sm-panel sm-keyboard-panel">
        <div className="sm-toolbar">
          <h3>Key travel</h3>
          <span className="sm-muted">Select a key</span>
        </div>
        <div className="sm-keyboard" data-testid="performance-keyboard-base">
          {renderRows({ layout, scalar: keyScalar, selectedKeys: new Set([selected]) }, (wrapper) => {
            const { keyItem, dataCode } = wrapper,
              key = keyItem.code !== undefined ? byKey.get(keyItem.code) : undefined,
              value = key ? sensorStats.conditioned(key, calibration, curve) : null;
            const width = keyScalar * (keyItem.x || keyItem.width || 1),
              height = keyScalar * (keyItem.height || 1);
            return (
              <div
                key={dataCode}
                className="sm-key-slot"
                data-depth-key={keyItem.code}
                data-selected={keyItem.code === selected}
                role={key ? 'button' : undefined}
                tabIndex={key ? 0 : undefined}
                aria-label={key ? 'Select ' + key.label + ' sensor' : undefined}
                onClick={() => key && setSelected(key.physicalKeyId)}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (key && ['Enter', ' '].includes(e.key)) {
                    e.preventDefault();
                    setSelected(key.physicalKeyId);
                  }
                }}
                style={{ width, height }}
                title={key ? key.label + ' · ADC ' + key.adc : undefined}
              >
                <Wrapper {...wrapper}>
                  <Key
                    keyItem={keyItem}
                    keyIndex={wrapper.keyIndex}
                    scalar={keyScalar}
                    theme={theme}
                    keyboardInfo={keyboardInfo}
                  />
                </Wrapper>
                {key && (
                  <span
                    className="sm-key-fill"
                    data-depth-fill={key.physicalKeyId}
                    style={{ height: Math.max(0, (height - 10) * required(value).normalized) }}
                  />
                )}
                {key && (
                  <small className="sm-key-value">{format(required(value).millimetres, 1)}</small>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="sm-analysis-grid">
      <div className="sm-panel">
        <div className="sm-toolbar">
          <h3>{active?.label ? active.label + ' · history' : 'Selected key'}</h3>
          <select
            aria-label="Graph scale"
            value={zoom}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setZoom(e.target.value)}
          >
            <option value="log">Logarithmic travel</option>
            <option value="travel">Linear full travel</option>
            <option value="noise">Raw noise zoom</option>
          </select>
        </div>
        <div className="sm-metrics">
          <div>
            <span className="sm-muted">Estimated depth</span>
            <output data-testid="selected-depth">
              {corrected ? format(corrected.millimetres) + ' mm' : '—'}
            </output>
          </div>
          <div>
            <span className="sm-muted">Raw ADC</span>
            <output data-testid="selected-raw">{active ? active.adc : '—'}</output>
          </div>
          {metric('Noise (σ)', format(stats?.standardDeviation))}
        </div>
        <div className="sm-chart" data-empty={!active}>
        {!active && <span className="sm-chart-empty">Waiting for sensor readings</span>}
        <svg
          className="sm-graph"
          data-testid="sensor-history"
          viewBox="0 0 1000 305"
          role="img"
          aria-hidden={!active}
          aria-label={zoom === 'log' ? 'Logarithmic key travel history with raw ADC and estimated depth reference lines' : 'Raw ADC history with estimated depth reference lines'}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={'time-' + f}>
              <line x1={64 + 812 * f} x2={64 + 812 * f} y1={22} y2={254} stroke="#35353e" />
              <text x={64 + 812 * f} y={277} fill="#aaaab7" fontSize={11} textAnchor="middle">
                {format(((lastTime - firstTime) / 1000) * (f - 1), 1) + ' s'}
              </text>
            </g>
          ))}
          {[0, 0.5, 1].map((f) => (
            <text
              key={'adc-' + f}
              x={56}
              y={26 + 232 * f}
              fill="#aaaab7"
              fontSize={11}
              textAnchor="end"
            >
              {format(adcAtFraction(f), 0)}
            </text>
          ))}
          {assumptions
            .filter((t) => zoom === 'log' || (t.adc >= graphMin && t.adc <= graphMax))
            .map((t) => (
              <g key={t.mm} data-mm-reference={t.mm}>
                <line
                  x1={64}
                  x2={876}
                  y1={y(t.adc)}
                  y2={y(t.adc)}
                  stroke={t.mm === 0.1 ? '#75d6df' : '#655078'}
                  strokeDasharray="5 5"
                />
                <text
                  x={888}
                  y={y(t.adc) + 4}
                  fill={t.mm === 0.1 ? '#75d6df' : '#ccb5e2'}
                  fontSize={11}
                >
                  {t.mm + ' mm*'}
                </text>
              </g>
            ))}
          <polyline points={points(series)} fill="none" stroke="#d1d1da" strokeWidth={1.5} />
          {corrected?.calibrated && (
            <polyline
              points={points(processedSeries)}
              fill="none"
              stroke="#b57be5"
              strokeWidth={2}
            />
          )}
          <text x={64} y={298} fill="#aaaab7" fontSize={11}>
            {zoom === 'log' ? 'Logarithmic travel · ADC labels ↑     Observation time →' : 'ADC counts ↑     Observation time →'}
          </text>
        </svg>
        </div>
        <div className="sm-legend">
          <span className="sm-legend-raw">Raw ADC</span>
          {corrected?.calibrated && <span className="sm-legend-filtered">Baseline corrected · no smoothing</span>}
          <span className="sm-legend-depth">Estimated depth</span>
        </div>
        <p className="sm-muted sm-note">
          * Estimated travel; below 0.6 mm is extrapolated.
        </p>
        <details className="sm-disclosure sm-sensor-details">
          <summary>Sensor details</summary>
          <p className="sm-muted" data-testid="selected-raw-statistics">
            {stats
              ? 'Min ' +
                stats.min +
                ' · Max ' +
                stats.max +
                ' · Mean ' +
                format(stats.mean) +
                ' · σ ' +
                format(stats.standardDeviation) +
                ' ADC · Peak-to-peak ' +
                stats.peakToPeak +
                ' · n=' +
                stats.samples
              : 'Collecting raw samples…'}
          </p>
          <dl className="sm-detail-grid">
            <div><dt>Read latency</dt><dd>{snapshot ? snapshot.roundTripMs + ' ms' : '—'}</dd></div>
            <div><dt>Samples</dt><dd>{summary.samples}</dd></div>
            <div><dt>Sensor / matrix</dt><dd>{active ? active.sensorId + ' / ' + active.matrixIndex : '—'}</dd></div>
            <div><dt>Released / full press</dt><dd>{active ? active.baseline + ' / ' + active.pressed : '—'}</dd></div>
            <div><dt>Scale / threshold</dt><dd>{active ? active.scale + ' / ' + active.threshold : '—'}</dd></div>
            <div><dt>Filtering</dt><dd>None · live samples</dd></div>
            <div><dt>Zero correction</dt><dd>{corrected?.calibrated ? format(corrected.baseline - required(active).baseline, 1) + ' ADC' : 'Not calibrated'}</dd></div>
            <div><dt>Rest noise band</dt><dd>{corrected?.calibrated ? format(calibration?.keys[selected]?.noiseMillimetres, 3) + ' mm*' : '—'}</dd></div>
            <div><dt>Firmware</dt><dd>{snapshot?.firmware ?? '—'}</dd></div>
            <div><dt>Metadata age</dt><dd>{snapshot ? (snapshot.metadataAgeMs ?? 0) + ' ms' : '—'}</dd></div>
          </dl>
        </details>
      </div>
      <div className="sm-panel">
        <div className="sm-toolbar">
          <div>
            <h3>Noise calibration</h3>
            <p className="sm-muted">
              Release all keys for 15 seconds.
            </p>
          </div>
          <div className="sm-actions">
            <button
              className="sm-primary"
              data-testid="calibrate-noise"
              disabled={paused || !snapshot || calibrating}
              onClick={calibrate}
            >
              {calibrating ? 'Capturing… ' + progress + '%' : 'Calibrate all'}
            </button>
            <button
              data-testid="clear-noise-calibration"
              disabled={!calibration && !calibrating}
              onClick={() => {
                if (calibrating) { cancelCalibration(); setProgress(0); setError(''); return; }
                cancelCalibration();
                setCalibration(null);
                calibrationRef.current = null;
                history.current.clear();
                context.diagnostics.sensorNoiseCalibration = null;
                setProgress(0);
                setError('');
              }}
            >
              {calibrating ? 'Cancel capture' : 'Clear calibration'}
            </button>
          </div>
        </div>
        <p className="sm-muted" data-testid="noise-calibration-status">
          {calibration
            ? 'Calibrated ' +
              Object.keys(calibration.keys).length +
              ' / 88 keys · zero correction only' +
              (calibration.skipped?.length
                ? ' · retry: ' +
                  calibration.skipped.map((key) => key.label + ' (' + key.reason + ')').join(', ')
                : '')
            : 'Using firmware baseline'}
        </p>
        {corrected?.calibrated && <p className="sm-muted sm-note" data-testid="calibration-quality">
          {calibration?.keys[selected]?.restCrossings === undefined ? 'Rest noise measured. No temporal filtering is applied.'
            : calibration.keys[selected].restCrossings! > 0
              ? active?.label + ': rest noise crossed 0.1 mm ' + calibration.keys[selected].restCrossings + ' times in the validation samples.'
              : active?.label + ': no 0.1 mm rest crossings in the validation samples.'}
        </p>}
        {error && (
          <p role="alert" className="sm-error sm-note">
            {error}
          </p>
        )}
        {study && (
          <details className="sm-disclosure sm-reference-study" data-testid="rest-study">
            <summary>Historical reference · not applied</summary>
            <p className="sm-muted sm-note">
              {study.frames + ' samples/key · ' + format(study.rateHz) + ' Hz · 60-second reference capture'}
            </p>
            <div className="sm-table-scroll">
              <table>
                <thead>
                  <tr>
                    {['Key', '0.1 mm ADC*', 'Median window', 'EMA τ', 'Rest crossings / 30s'].map(
                      (label) => (
                        <th key={label}>{label}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {study.perKey.map((key) => (
                    <tr key={key.physicalKeyId} onClick={() => setSelected(key.physicalKeyId)}>
                      {[
                        key.key,
                        format(key.targetAdcAssumption),
                        key.chosen.medianSamples,
                        key.chosen.tauMs + ' ms',
                        key.chosen.heldOutFalseActivations,
                      ].map((value, index) => (
                        <td key={index}>{value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="sm-muted sm-note">
              0.1 mm is not reliable on all keys. Filtering adds delay; calibration does not change actuation.
            </p>
          </details>
        )}
      </div>
      </div>
      <details className="sm-panel sm-disclosure" onToggle={event => setSensorsOpen(event.currentTarget.open)}>
        <summary>All sensors <span>{snapshot?.supportedCount ?? 0} keys</span></summary>
        <div className="sm-table-scroll">
          <table data-testid="raw-sensor-table">
            <thead>
              <tr>
                {[
                  'Key',
                  'Physical',
                  'Sensor',
                  'Matrix',
                  'ADC',
                  'Released',
                  'Full press',
                  'Scale',
                  'Threshold',
                  'Coefficient',
                  'Min',
                  'Max',
                  'Mean',
                  'σ',
                  'Peak-to-peak',
                  'Deadband',
                  'Estimated mm',
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(sensorsOpen ? snapshot?.keys || [] : []).map((key) => {
                const stat = history.current.key(key.physicalKeyId),
                  value = sensorStats.conditioned(key, calibration, curve);
                return (
                  <tr
                    key={key.physicalKeyId}
                    data-raw-sensor={key.physicalKeyId}
                    data-selected={selected === key.physicalKeyId}
                    onClick={() => setSelected(key.physicalKeyId)}
                  >
                    {[
                      key.label,
                      key.physicalKeyId,
                      key.sensorId,
                      key.matrixIndex,
                      key.adc,
                      key.baseline,
                      key.pressed,
                      key.scale,
                      key.threshold,
                      format(key.coefficient, 5),
                      stat?.min,
                      stat?.max,
                      format(stat?.mean),
                      format(stat?.standardDeviation),
                      stat?.peakToPeak,
                      format(value.deadband),
                      format(required(value).millimetres),
                    ].map((value, index) => (
                      <td key={index}>{value ?? '—'}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
