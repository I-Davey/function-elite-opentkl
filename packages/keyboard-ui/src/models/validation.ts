import { typecheck, type IAnyType, type SnapshotIn } from 'mobx-state-tree';

/** Validate unknown persisted/host data against the actual model before narrowing its type. */
export function validatedSnapshot<Model extends IAnyType>(
  model: Model,
  value: unknown,
): SnapshotIn<Model> {
  typecheck(model, value);
  return value as SnapshotIn<Model>;
}
