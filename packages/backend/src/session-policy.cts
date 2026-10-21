export interface ProtectedSession {
  webRequest: {
    onBeforeRequest(
      listener: (details: { url: string }, done: (response: { cancel: boolean }) => void) => void,
    ): void;
  };
  setPermissionRequestHandler(
    listener: (contents: unknown, permission: string, done: (allowed: boolean) => void) => void,
  ): void;
  setPermissionCheckHandler(listener: () => boolean): void;
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';
/** Permit packaged local resources and deny renderer network requests. */
export const protect = (session: ProtectedSession, profile?: string) => {
  const roots = [
    path.resolve(__dirname, '../app'),
    ...(profile ? [path.resolve(profile)] : []),
  ];
  session.webRequest.onBeforeRequest((details, done) => {
    let allowed = false;
    try {
      const url = new URL(details.url);
      if (['data:', 'blob:', 'devtools:'].includes(url.protocol)) allowed = true;
      else if (url.protocol === 'file:') {
        const target = fileURLToPath(url);
        allowed = roots.some((root) => {
          const relative = path.relative(root, target);
          return (
            relative === '' ||
            (relative !== '..' &&
              !relative.startsWith('..' + path.sep) &&
              !path.isAbsolute(relative))
          );
        });
      }
    } catch {}
    done({ cancel: !allowed });
  });
  session.setPermissionRequestHandler((_contents, _permission, done) => done(false));
  session.setPermissionCheckHandler(() => false);
};
