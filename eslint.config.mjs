// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // ── General TypeScript rules ─────────────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],

      // ── Naming conventions ───────────────────────────────────────────────
      // See docs/naming-conventions.md for the full rationale.
      '@typescript-eslint/naming-convention': [
        'error',

        // Default: camelCase for everything unless a more specific rule below applies
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'forbid',
        },

        // Variables: camelCase or UPPER_CASE (module-level constants);
        // also allow PascalCase for exported decorator factories and class-like values
        // (e.g. `export const Roles = ...`, `export const CurrentUser = ...`)
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },

        // Parameters: camelCase; leading underscore for intentionally unused params
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },

        // Class members (properties, accessor, method): camelCase
        {
          selector: 'memberLike',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },

        // Types (classes, interfaces, type aliases, enums): PascalCase
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },

        // Enum members: UPPER_SNAKE_CASE
        {
          selector: 'enumMember',
          format: ['UPPER_CASE'],
        },

        // Imports: allow PascalCase for class/namespace imports from third-party
        // libraries (e.g. `import Redis from 'ioredis'`, `import * as StellarSdk`)
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
      ],
    },
  },
);
