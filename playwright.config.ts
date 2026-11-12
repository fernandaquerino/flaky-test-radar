import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'pnpm exec tsx scripts/e2e-api.ts',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'pnpm --filter @flaky-radar/web start',
      url: 'http://localhost:3000/login',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'pnpm exec tsx scripts/e2e-worker.ts',
      wait: { stdout: /Worker ready/ },
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
