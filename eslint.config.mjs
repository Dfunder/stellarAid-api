import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', '.husky/_/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    // Plain CommonJS scripts, if any are added later, run under Node.
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        process: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    // k6 load-test scripts run in the k6 runtime, not Node — they only get
    // the k6/web globals, not the Node globals above.
    files: ['loadtest/**/*.js'],
    languageOptions: {
      globals: {
        __ENV: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
);
