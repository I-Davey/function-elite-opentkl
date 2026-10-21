/** Narrow Electron surface used by our host. Dynamic payloads enter as unknown. */
export interface CancelableEvent {
  preventDefault(): void;
}
export interface App {
  getPath(name: 'appData'): string;
  setPath(name: 'userData' | 'sessionData' | 'logs' | 'crashDumps', value: string): void;
  setName(name: string): void;
  setAppUserModelId(id: string): void;
  getLoginItemSettings(options: { path: string; args: string[] }): {
    openAtLogin: boolean;
    launchItems: { name: string; enabled: boolean }[];
  };
  setLoginItemSettings(options: { openAtLogin: boolean; path: string; args: string[]; name: string }): void;
  requestSingleInstanceLock(): boolean;
  quit(): void;
  whenReady(): Promise<void>;
  on(event: 'before-quit', listener: (event: CancelableEvent) => void): this;
  on(event: 'window-all-closed' | 'will-quit' | 'second-instance', listener: () => void): this;
}
export interface IpcEvent {
  readonly sender?: WebContents;
}
export type IpcHandler = (event: IpcEvent, input: unknown) => unknown;
export interface IpcRegistrar {
  handle(channel: string, handler: IpcHandler): void;
}
export interface IpcMain extends IpcRegistrar {
  on(channel: string, listener: (event: IpcEvent, input: unknown) => void): void;
}
export interface IpcRenderer {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  send(channel: string, value: unknown): void;
  on(channel: string, listener: (event: IpcEvent, value: unknown) => void): void;
  removeListener(channel: string, listener: (event: IpcEvent, value: unknown) => void): void;
}
export interface NativeImage {
  toPNG(): Buffer;
}
export interface WebContents {
  send(channel: string, value: unknown): void;
  capturePage(): Promise<NativeImage>;
  setWindowOpenHandler(handler: () => { action: 'deny' }): void;
  on(event: 'will-navigate', listener: (event: CancelableEvent, url: string) => void): void;
  on(
    event: 'console-message',
    listener: (event: IpcEvent, level: number, message: string) => void,
  ): void;
  on(event: 'did-start-loading', listener: () => void): void;
  on(event: 'render-process-gone', listener: (event: IpcEvent, detail: unknown) => void): void;
}
export interface Window {
  webContents: WebContents;
  isMinimized(): boolean;
  isDestroyed(): boolean;
  restore(): void;
  show(): void;
  hide(): void;
  focus(): void;
  close(): void;
  removeMenu(): void;
  loadFile(file: string, options: { query: Record<string, string> }): Promise<void>;
  on(event: 'closed', listener: () => void): void;
  on(event: 'close', listener: (event: CancelableEvent) => void): void;
  on(event: 'session-end', listener: () => void): void;
}
interface WindowOptions {
  show: boolean;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  backgroundColor: string;
  title: string;
  icon?: string;
  titleBarStyle?: 'hidden';
  titleBarOverlay?: { color: string; symbolColor: string; height: number };
  webPreferences: {
    preload: string;
    nodeIntegration: false;
    contextIsolation: true;
    sandbox: true;
    webSecurity: true;
  };
}
interface DialogFilter {
  name: string;
  extensions: string[];
}
export interface Dialog {
  showOpenDialog(
    win: Window,
    options: {
      title: string;
      defaultPath?: string;
      properties: ['openFile'];
      filters: DialogFilter[];
    },
  ): Promise<{ canceled: boolean; filePaths: string[] }>;
  showSaveDialog(
    win: Window,
    options: {
      title: string;
      defaultPath: string;
      filters: DialogFilter[];
    },
  ): Promise<{ canceled: boolean; filePath?: string }>;
}
export interface Electron {
  app: App;
  BrowserWindow: new (options: WindowOptions) => Window;
  ipcMain: IpcMain;
  session: { defaultSession: import('../backend/src/session-policy.cjs').ProtectedSession };
  dialog: Dialog;
  contextBridge: { exposeInMainWorld(name: string, api: object): void };
  ipcRenderer: IpcRenderer;
  Tray: new (icon: string) => Tray;
  Menu: { buildFromTemplate(items: MenuItem[]): Menu };
}
export interface MenuItem {
  label?: string;
  type?: 'separator' | 'checkbox';
  checked?: boolean;
  enabled?: boolean;
  click?: () => void;
}
export interface Menu { readonly items: readonly MenuItem[] }
export interface Tray {
  setToolTip(text: string): void;
  popUpContextMenu(menu: Menu): void;
  on(event: 'click' | 'double-click' | 'right-click', listener: () => void): void;
  destroy(): void;
}
export type Serial = <T>(operation: () => T | PromiseLike<T>) => Promise<T>;
export type RecordEvent = (kind: string, detail: unknown) => void;
