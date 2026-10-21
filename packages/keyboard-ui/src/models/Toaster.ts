import { types, type Instance } from 'mobx-state-tree';

export const BACKGROUND_TYPES = { DEFAULT: 'DEFAULT', ALERT: 'ALERT', INFO: 'INFO' } as const;
export const POSITION_TYPES = { DEFAULT: 'DEFAULT', FIXED: 'FIXED' } as const;
export const JUSTIFY_CONTENT_TYPES = { DEFAULT: 'DEFAULT', CENTER: 'CENTER' } as const;

export interface ToastOptions {
  message: string;
  buttons?: { name: string; handler: () => void }[];
  onClose?: () => void;
  backgroundType?: keyof typeof BACKGROUND_TYPES;
  positionType?: keyof typeof POSITION_TYPES;
  showCloseButton?: boolean;
  justifyContent?: keyof typeof JUSTIFY_CONTENT_TYPES;
}

/** Keyboard feedback; callbacks are transient and never enter profile snapshots. */
export const Toaster = types
  .model('Toaster', {
    show: false,
    message: '',
    buttonNames: types.array(types.string),
    backgroundType: types.optional(types.enumeration('BACKGROUND_TYPES', ['DEFAULT', 'ALERT', 'INFO']), 'DEFAULT'),
    positionType: types.optional(types.enumeration('POSITION_TYPES', ['DEFAULT', 'FIXED']), 'DEFAULT'),
    showCloseButton: true,
    justifyContent: types.optional(types.enumeration('JUSTIFY_CONTENT_TYPES', ['DEFAULT', 'CENTER']), 'DEFAULT'),
  })
  .volatile(() => ({
    buttonHandlers: {} as Record<string, (() => void) | undefined>,
    onCloseHandler: undefined as (() => void) | undefined,
  }))
  .views((self) => ({
    get onClose() {
      return self.onCloseHandler;
    },
    getButtonHandler(name: string) {
      return self.buttonHandlers[name];
    },
  }))
  .actions((self) => ({
    showToaster({ message, buttons = [], onClose, backgroundType = 'DEFAULT',
      positionType = 'DEFAULT', showCloseButton = true, justifyContent = 'DEFAULT' }: ToastOptions) {
      for (const button of buttons) self.buttonHandlers[button.name] = button.handler;
      self.justifyContent = justifyContent;
      self.showCloseButton = showCloseButton;
      self.positionType = positionType;
      self.backgroundType = backgroundType;
      self.message = message;
      self.show = true;
      self.buttonNames.replace(buttons.map((button) => button.name));
      self.onCloseHandler = onClose;
    },
    hideToaster() {
      self.message = '';
      self.show = false;
      for (const name in self.buttonHandlers) delete self.buttonHandlers[name];
      // The caller owns close callbacks; hiding during recording must not invoke them.
    },
  }));

export type ToasterInstance = Instance<typeof Toaster>;
