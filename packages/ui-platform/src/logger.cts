/** Renderer logs are delivered through an injected desktop diagnostics port. */
type Level = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'verbose' | 'silly';
interface LogEvent {
  kind: string;
  detail: string;
}
type Sink = (event: LogEvent) => void;
interface Logger {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  verbose(...args: unknown[]): void;
  silly(...args: unknown[]): void;
  scope(name?: string): Logger;
  configure(sink: Sink | null): void;
  configureLogger(sink: Sink | null): void;
  transports: { file: Record<string, unknown>; console: Record<string, unknown> };
}
let sink: Sink | null = null;
const send = (level: Level, args: unknown[]) =>
  sink?.({ kind: 'log.' + level, detail: args.map(String).join(' ').slice(0, 3000) });
const logger: Logger = {
  log: (...args) => send('log', args),
  info: (...args) => send('info', args),
  warn: (...args) => send('warn', args),
  error: (...args) => send('error', args),
  debug: (...args) => send('debug', args),
  verbose: (...args) => send('verbose', args),
  silly: (...args) => send('silly', args),
  scope: () => logger,
  configure(next) {
    sink = next;
  },
  configureLogger(next) {
    sink = next;
  },
  transports: { file: {}, console: {} },
};
export = logger;
