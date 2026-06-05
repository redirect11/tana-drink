import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  // App React (browser).
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2021,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  // File di configurazione e script (Node).
  {
    files: ['*.config.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      globals: globals.node,
      parserOptions: { ecmaVersion: 'latest' },
      sourceType: 'module',
    },
    rules: { ...js.configs.recommended.rules },
  },
  // Service worker.
  {
    files: ['public/sw.js'],
    languageOptions: {
      ecmaVersion: 2021,
      globals: { ...globals.serviceworker, caches: 'readonly' },
    },
    rules: { ...js.configs.recommended.rules },
  },
]
