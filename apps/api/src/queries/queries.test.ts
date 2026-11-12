import 'dotenv/config';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Database } from '../database';
import { ProjectsService } from '../projects/projects.service';
import { QueriesService } from './queries.service';
import { refreshDailyStats } from '@flaky-radar/database';
import { testQuerySchema, windowBounds } from '@flaky-radar/shared';
const db = new Database();
const projects = new ProjectsService(db);
const queries = new QueriesService(db, projects);
const slug = `math-${randomUUID()}`;
const now = new Date('2026-06-30T16:00:00Z');
let projectId: string;
let testId: string;
beforeAll(async () => {
  projectId = (await projects.create('Window sample', slug)).id;
  testId = (
    await db.testCase.create({
      data: {
        projectId,
        fileName: 'sample.ts',
        titlePath: ['sample'],
        playwrightProject: 'chromium',
        stableKey: 'sample',
      },
    })
  ).id;
  for (const [date, outcome, commit] of [
    ['2026-06-01', 'passed', 'same'],
    ['2026-06-24', 'failed', 'same'],
    ['2026-06-25', 'flaky', 'other'],
    ['2026-06-26', 'skipped', 'same'],
    ['2026-06-27', 'passed', 'clean'],
    ['2026-07-01', 'failed', 'future'],
  ] as const) {
    const upload = await db.upload.create({
      data: {
        projectId,
        ciRunId: date,
        attempt: 1,
        commitSha: commit,
        branch: 'main',
        rawReport: {},
        status: 'PROCESSED',
      },
    });
    const run = await db.testRun.create({
      data: {
        projectId,
        uploadId: upload.id,
        commitSha: commit,
        branch: 'main',
        startedAt: new Date(`${date}T00:00:00Z`),
        durationMs: 1,
      },
    });
    await db.testResult.create({
      data: {
        testCaseId: testId,
        testRunId: run.id,
        outcome,
        retries: 0,
        durationMs: 1,
      },
    });
  }
  await db.$transaction((tx) => refreshDailyStats(tx, projectId, [testId]));
  await db.testCase.create({
    data: {
      projectId,
      fileName: 'empty.ts',
      titlePath: ['empty'],
      playwrightProject: 'chromium',
      stableKey: 'empty',
    },
  });
});
afterAll(async () => {
  await db.project.delete({ where: { id: projectId } });
  await db.$disconnect();
});
test('UTC calendar window is half-open across month boundaries', () => {
  expect(windowBounds('7d', now)).toEqual({
    start: new Date('2026-06-24T00:00:00Z'),
    end: new Date('2026-07-01T00:00:00Z'),
  });
});
test('counts instability evidence outside window, excludes skips and future days', async () => {
  const page = await queries.tests(
    slug,
    testQuerySchema.parse({ window: '7d', pageSize: 1 }),
    now,
  );
  expect(page.total).toBe(2);
  expect(page.items).toHaveLength(1);
  expect(page.items[0]).toMatchObject({
    executions: 3,
    flakyCount: 2,
    failedCount: 1,
    flakeRate: 2 / 3,
  });
  expect(page.trend).toHaveLength(30);
  expect(page.trend.find((p) => p.day === '2026-06-01')).toMatchObject({
    executions: 1,
    flakyCount: 1,
  });
  const empty = await queries.tests(
    slug,
    testQuerySchema.parse({ page: 2, pageSize: 1 }),
    now,
  );
  expect(empty.items[0]?.flakeRate).toBeNull();
});
test('30-day project rate matches test rate; unknown and cross-project details return 404', async () => {
  const page = await queries.tests(
    slug,
    testQuerySchema.parse({ window: '30d' }),
    now,
  );
  expect(page.items[0]).toMatchObject({
    executions: 4,
    flakyCount: 3,
    flakeRate: 0.75,
  });
  expect(
    (await queries.listProjects(now)).find((p) => p.id === projectId)
      ?.flakeRate,
  ).toBe(0.75);
  await expect(queries.detail(slug, 'unknown')).rejects.toMatchObject({
    status: 404,
  });
  expect((await queries.detail(slug, testId)).results).toHaveLength(6);
});
test('pagination and sorting inputs are bounded', () => {
  expect(testQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  expect(testQuerySchema.safeParse({ sort: 'injected SQL' }).success).toBe(
    false,
  );
});
