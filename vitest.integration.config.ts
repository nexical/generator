import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.{test,spec}.ts'],
    testTimeout: 60000,
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
  },
});
