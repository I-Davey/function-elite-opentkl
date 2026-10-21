import globals from 'globals';
export default [
  {
    ignores: ['dist/**', '.build/**', 'node_modules/**', 'tests/regression-fixtures/**'],
  },
  {
    files: [
      'eslint.config.mjs',
      'scripts/**/*.{js,mjs,cjs}',
      'tests/**/*.{js,mjs,cjs}',
      'packages/renderer/checks/**/*.js',
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.es2024 },
    },
    rules: {
      'no-undef': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-class-members': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'valid-typeof': 'error',
      'constructor-super': 'error',
      'no-this-before-super': 'error',
    },
  },
];
