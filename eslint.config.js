import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `dist` is build output. `.claude/worktrees` holds checkouts of this same
  // repo, made by agent sessions and by the two-branch workflow, and linting
  // them lints the project two or three more times over: every finding is a
  // duplicate of one already reported against the real path, and a run with a
  // few worktrees open buries a genuine error under a couple of thousand
  // copies. It is git-ignored, and it was not eslint-ignored, so `npm run lint`
  // passed in CI - which checks out clean - and was unusable on the machine
  // where the code is actually written.
  globalIgnores(['dist', '.claude/worktrees']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Core no-unused-vars can't see identifiers referenced only in JSX
      // (no eslint-plugin-react installed). The capitalized pattern exempts
      // component imports; `m` is framer-motion's lowercase JSX namespace under
      // LazyMotion, used as <m.div> and otherwise flagged as unused.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]|^m$' }],
    },
  },
  {
    files: ['*.config.js', 'vite/**/*.js', 'scripts/**/*.js', 'api/**/*.js', 'lib/**/*.js'],
    languageOptions: { globals: globals.node },
  },
])
