import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.{test,spec}.ts'],
    testTimeout: 30000,
    alias: [
      { find: /^@nexical\/generator\/(.*)/, replacement: path.resolve(__dirname, 'src/$1') },
      {
        find: /^@nexical\/generator-tests\/(.*)/,
        replacement: path.resolve(__dirname, 'tests/unit/$1'),
      },
      {
        find: /^@nexical\/cli-core/,
        replacement: path.resolve(__dirname, 'src/lib/cli-core.ts'),
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
