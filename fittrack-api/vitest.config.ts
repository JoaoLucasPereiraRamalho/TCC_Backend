import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    setupFiles: ['test/setup-env.ts'],
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    exclude: ['test/integration/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/main.*.ts', 'src/**/index.ts', 'src/**/__tests__/**'],
    },
  },
});
