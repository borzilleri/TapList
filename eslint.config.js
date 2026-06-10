// Flat config for ESLint 10 + TypeScript + Svelte 5.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
        // Injected at build time via Vite's `define` (see vite.config.ts).
        __APP_VERSION__: 'readonly',
        __APP_RELEASE_URL__: 'readonly',
      },
    },
    rules: {
      // We use `_` prefix to mark intentionally-unused args (e.g. unused
      // parameters that document a contract).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // The Svelte parser handles .svelte files; nested <script lang="ts">
    // blocks defer to the TS parser via parserOptions.parser.
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    // .svelte.ts / .svelte.js modules (rune-using stores) are plain TS as
    // far as ESLint is concerned. eslint-plugin-svelte v3's recommended
    // configs claim this extension for the Svelte parser, so we override
    // it back to the TS parser here.
    files: ['**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  {
    // Don't lint generated or vendored output.
    ignores: ['dist/', 'node_modules/', '.svelte-kit/', 'coverage/', '.vite/'],
  },
];
