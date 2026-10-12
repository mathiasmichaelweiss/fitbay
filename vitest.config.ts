import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'services/**/src/**/*.test.ts', 'apps/**/src/**/*.test.{ts,tsx}'],
    coverage: { provider: 'v8', include: ['packages/calc/src/**'], thresholds: { lines: 90 } },
  },
});
