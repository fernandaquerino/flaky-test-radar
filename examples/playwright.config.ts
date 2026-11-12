import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './sample-tests',
  fullyParallel: true,
  retries: 1,
  workers: 1,
  reporter: [
    [
      'json',
      {
        outputFile:
          process.env.FIXTURE_OUTPUT ??
          '../packages/report-parser/fixtures/report.json',
      },
    ],
  ],
  projects: [{ name: 'chromium' }],
  timeout: 1000,
});
