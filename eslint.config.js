import js from '@eslint/js';
import globals from 'globals';

export default [
  // `docs/` holds the committed GitHub Pages build output, so it is generated code like `dist/`.
  { ignores: ['dist/', 'docs/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
  }
];
