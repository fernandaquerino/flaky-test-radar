import { test, expect, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
const exec = promisify(execFile);
let auth: Awaited<ReturnType<APIRequestContext['storageState']>>;
let emptySlug: string,
  dataSlug: string,
  token: string,
  apiRequest: APIRequestContext;
test.beforeAll(async ({ playwright }) => {
  apiRequest = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
  });
  const login = await apiRequest.post('/api/auth/login', {
    data: { password: 'radar-e2e-only-password' },
  });
  expect(login.ok()).toBeTruthy();
  auth = await apiRequest.storageState();
  const id = randomUUID();
  emptySlug = `e2e-empty-${id}`;
  dataSlug = `e2e-data-${id}`;
  for (const [slug, name] of [
    [emptySlug, 'E2E Empty'],
    [dataSlug, 'E2E Store'],
  ])
    expect(
      (await apiRequest.post('/api/projects', { data: { name, slug } })).ok(),
    ).toBeTruthy();
  const created = await apiRequest.post(`/api/projects/${dataSlug}/tokens`, {
    data: { label: 'E2E uploader' },
  });
  token = ((await created.json()) as { token: string }).token;
  const directory = await mkdtemp(join(tmpdir(), 'radar-e2e-'));
  try {
    const report = JSON.parse(
      await readFile('packages/report-parser/fixtures/report.json', 'utf8'),
    ) as { stats: { startTime: string } };
    report.stats.startTime = new Date().toISOString();
    const file = join(directory, 'report.json');
    await writeFile(file, JSON.stringify(report));
    const args = [
      resolve('packages/cli/dist/index.js'),
      'upload',
      '--report',
      file,
      '--run-id',
      id,
      '--sha',
      'a'.repeat(40),
      '--branch',
      'main',
    ];
    const env = {
      ...process.env,
      FLAKY_RADAR_URL: 'http://localhost:3000',
      FLAKY_RADAR_TOKEN: token,
    };
    expect((await exec(process.execPath, args, { env })).stdout).toContain(
      'accepted',
    );
    expect((await exec(process.execPath, args, { env })).stdout).toContain(
      'already received',
    );
    await expect
      .poll(async () => {
        const response = await apiRequest.get(
          `/api/projects/${dataSlug}/tests`,
        );
        return ((await response.json()) as { total: number }).total;
      })
      .toBe(5);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test.afterAll(async () => {
  const db = new PrismaClient();
  await db.project.deleteMany({
    where: { slug: { in: [emptySlug, dataSlug] } },
  });
  await db.$disconnect();
  await apiRequest.dispose();
});
test('login, protected route and logout', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/login');
  await page.getByLabel('Admin password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Incorrect password',
  );
  await page.getByLabel('Admin password').fill('radar-e2e-only-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Projects', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/login');
  await page.goto('/');
  await expect(page).toHaveURL('/login');
});
test('empty project explains setup; token is shown once and can be revoked', async ({
  page,
  context,
}) => {
  await context.addCookies(auth.cookies);
  await page.goto(`/projects/${emptySlug}`);
  await expect(
    page.getByRole('heading', { name: 'No uploads yet' }),
  ).toBeVisible();
  await page.getByLabel('Token label').fill('My CI');
  await page.getByRole('button', { name: 'Create token' }).click();
  await expect(page.getByText('Copy this token now.')).toBeVisible();
  await page.getByRole('button', { name: 'I saved my token' }).click();
  await page.reload();
  await expect(page.getByText('Copy this token now.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Revoke My CI' }).click();
  await expect(page.getByText('Revoked', { exact: true })).toBeVisible();
});
test('real CLI upload reaches worker, ranking and detail history', async ({
  page,
  context,
}) => {
  await context.addCookies(auth.cookies);
  await page.goto(`/projects/${dataSlug}`);
  await expect(
    page.getByRole('link', {
      name: 'sample checkout › flaky on first attempt',
    }),
  ).toBeVisible();
  await expect(
    page.getByText('1 flaky or unstable executions out of 4.'),
  ).toBeVisible();
  await page.getByLabel('Window').selectOption('7d');
  await expect(
    page.getByRole('link', { name: 'sample checkout › passes', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Executions', exact: true }).click();
  await expect(
    page.getByRole('columnheader', { name: /Executions/ }),
  ).toHaveAttribute('aria-sort', 'descending');
  await page
    .getByRole('link', { name: 'sample checkout › flaky on first attempt' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Result history' }),
  ).toBeVisible();
  await expect(page.getByText('aaaaaaaa', { exact: true })).toBeVisible();
  await page.getByText('View error', { exact: true }).click();
  await expect(page.locator('pre.error-message')).toContainText('expect');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test('query failures are actionable and retry recovers', async ({
  page,
  context,
}) => {
  await context.addCookies(auth.cookies);
  await page.route('**/api/projects/*/tests?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'UNAVAILABLE',
        message: 'Sample service interruption.',
      }),
    }),
  );
  await page.goto(`/projects/${dataSlug}`);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Sample service interruption.',
  );
  await page.unroute('**/api/projects/*/tests?*');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Tests to watch' }),
  ).toBeVisible();
});
