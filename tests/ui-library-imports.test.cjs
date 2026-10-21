const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('maintained source has no recovered binding imports or library proxy exports', async () => {
  const { auditLibraryImports } = await import('../scripts/audit-library-imports.mjs');
  assert.deepEqual(auditLibraryImports(), []);
  const directory = 'packages/keyboard-ui/src/recovered/bindings';
  assert.deepEqual(fs.existsSync(directory) ? fs.readdirSync(directory) : [], []);
});

test('library import guard rejects aliases in any folder and allows real components', async () => {
  const { libraryImportProblems } = await import('../scripts/audit-library-imports.mjs');
  for (const source of [
    "import * as emotion from '@emotion/react'; export { emotion as oo };",
    "import * as emotion from '@emotion/react'; const renamed = emotion; export { renamed };",
    "import * as emotion from '@emotion/react'; export const oo = emotion;",
    "import * as emotion from '@emotion/react'; export default emotion;",
    "export * as emotion from '@emotion/react';",
    "export { css as oo } from '@emotion/react';",
    "import * as oo from '@emotion/react'; oo.css({});",
    "import { css as oo } from '@emotion/react'; oo({});",
    "import { oo } from './recovered/bindings/oo-abcd.jsx';",
    "import * as React from 'react'; const R = React; R.useState();",
    "import * as React from 'react'; const h = React.createElement; h('div');",
    "import * as React from 'react'; function View() { const R = React; return R.createElement('div'); }",
    "import * as React from 'react'; function View() { const { createElement: h } = React; return h('div'); }",
    "import * as emotion from '@emotion/react'; export const cssProxy = emotion.css;",
  ]) assert(libraryImportProblems(source, 'any-folder/view.tsx').length, source);
  assert.deepEqual(libraryImportProblems(
    "import { css } from '@emotion/react'; export function Button() { return <button css={css({})}/>; }",
    'Button.tsx'), []);
  assert.deepEqual(libraryImportProblems(
    "import * as React from 'react'; function shadow(React) { const R = React; return R; }",
    'shadow.ts'), []);
});

test('renderer uses one npm Emotion and state implementation without copied providers', () => {
  const { inputs } = JSON.parse(fs.readFileSync('reports/renderer-build.json', 'utf8'));
  for (const name of ['@emotion/react', '@emotion/styled', 'react-select', 'mobx', 'mobx-react',
    'mobx-react-lite', 'mobx-state-tree']) {
    assert(inputs.some((file) => file.startsWith('node_modules/' + name + '/')), name);
    assert(!inputs.some((file) => file.includes('/src/vendor/.pnpm/') &&
      file.includes('/node_modules/' + name + '/')), name);
  }
  const providers = inputs.filter((file) => /node_modules\/@emotion\/react\/dist\/emotion-element.*\.js$/.test(file));
  assert.equal(providers.length, 1, providers.join('\n'));
});

test('npm state reactions, model actions and snapshots retain their expected behaviour', () => {
  const api = { ...require('mobx'), ...require('mobx-state-tree') };
  const state = api.observable({ depth: 0 }), observed = [];
  const dispose = api.reaction(() => state.depth, (value) => observed.push(value));
  api.action(() => { state.depth = 0.1; state.depth = 0.2; })();
  dispose();
  api.action(() => { state.depth = 4; })();
  assert.deepEqual(observed, [0.2]);
  const Profile = api.types.model({ depth: api.types.number }).actions((self) => ({
    setDepth(depth) { self.depth = depth; },
  }));
  const profile = Profile.create({ depth: 0 });
  profile.setDepth(0.1);
  assert.deepEqual(api.getSnapshot(profile), { depth: 0.1 });
  api.applySnapshot(profile, { depth: 4 });
  assert.deepEqual(api.getSnapshot(profile), { depth: 4 });
});
