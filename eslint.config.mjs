import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import js from '@eslint/js';

export default tseslint.config(
  // Global ignore
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.astro/**', '**/.agent/**'],
  },

  // Base JS/TS configuration
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Node environment configuration
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Custom rules override
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn', // Downgrade to warning for now as codebase has some anys
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },

  // Prettier must be last to override conflicting rules
  eslintConfigPrettier,
);
