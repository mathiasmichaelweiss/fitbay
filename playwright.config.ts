import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
  projects: [{ name: 'mobile', use: { ...devices['iPhone 13'] } }],
  webServer: { command: 'pnpm dev', port: 5173, reuseExistingServer: true },
});
