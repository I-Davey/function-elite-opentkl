import { types, type Instance } from 'mobx-state-tree';
import { v4 } from 'uuid';

/** Transient dialog state. `next` survives another open and is cleared on close. */
export const OpenableView = types
  .model('OpenableView', {
    id: types.optional(types.identifier, v4()),
    state: types.optional(types.enumeration(['closed', 'opened']), 'closed'),
    next: types.maybe(types.string),
  })
  .views((self) => ({
    get isOpened() {
      return self.state === 'opened';
    },
  }))
  .actions((self) => ({
    open(next?: string) {
      self.state = 'opened';
      if (next !== undefined) self.next = next;
    },
    close() {
      self.state = 'closed';
      self.next = undefined;
    },
  }));

export type OpenableViewInstance = Instance<typeof OpenableView>;
