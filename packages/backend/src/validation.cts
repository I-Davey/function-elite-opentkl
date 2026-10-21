/** Convert unknown exceptions at public error-reporting boundaries. */
export function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
/** A failed lookup is a corrupt/incomplete snapshot, never an unchecked undefined. */
export function required<T>(
  value: T | null | undefined,
  message = 'Incomplete keyboard snapshot',
): T {
  if (value === undefined || value === null) throw Error(message);
  return value;
}
/** Decode application-owned fixtures/journals. Callers validate edit requests and
 * snapshots before device mutation; native process replies have independent guards.
 * This assertion is confined to JSON deserialization, never used to silence source errors. */
export function readJson<T>(text: string): T {
  const value: unknown = JSON.parse(text);
  return value as T;
}

