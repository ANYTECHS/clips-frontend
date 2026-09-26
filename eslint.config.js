import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Comment style: enforce a single space after `//` and `/*` so inline
      // comments stay readable and consistent across the codebase.
      'spaced-comment': [
        'error',
        'always',
        {
          line: { markers: ['/'], exceptions: ['-', '+', '*'] },
          block: { balanced: true, exceptions: ['*'], markers: ['!'] },
        },
      ],
      // Comment style: require a space before the `//` of a trailing comment
      // so end-of-line comments are visually separated from the code.
      'no-inline-comments': 'off',
      'line-comment-position': ['error', { position: 'above' }],
      // Comment style: cap comment line length to keep comments scannable.
      'max-len': [
        'error',
        {
          code: 120,
          tabWidth: 2,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignoreComments: false,
        },
      ],
      // Comment style: forbid commented-out code blocks and stray notes by
      // requiring TODO/FIXME markers to be well-formed and actionable.
      'no-warning-comments': [
        'warn',
        { terms: ['todo', 'fixme', 'xxx'], location: 'start' },
      ],
    },
  },
]);
