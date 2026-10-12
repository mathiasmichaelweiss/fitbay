import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  // API с отдельной базой для тестов + web, который ходит в этот API
  webServer: [
    { command: 'pnpm --filter @fitbay/api start', port: 8787, reuseExistingServer: true, env: { DB_FILE: '.data/e2e.json', AI_MOCK: '1' } },
    { command: 'pnpm dev:web', port: 5173, reuseExistingServer: true },
  ],
});
