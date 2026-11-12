import 'dotenv/config';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { processUpload } from './process-upload';
const db = new PrismaClient();
let projectId: string;
beforeAll(async () => {
  projectId = (
    await db.project.create({
      data: { name: 'Worker sample', slug: `worker-${randomUUID()}` },
    })
  ).id;
});
afterAll(async () => {
  await db.project.delete({ where: { id: projectId } });
  await db.$disconnect();
});
async function upload(outcome: string, time: string) {
  return db.upload.create({
    data: {
      projectId,
      ciRunId: randomUUID(),
      attempt: 1,
      commitSha: 'a'.repeat(40),
      branch: 'main',
      rawReport: {
        config: {},
        stats: { startTime: time, duration: 20 },
        suites: [
          {
            title: 'sample.spec.ts',
            specs: [
              {
                title: 'works',
                file: 'sample.spec.ts',
                tests: [
                  {
                    projectName: 'chromium',
                    status: outcome,
                    results: [
                      {
                        status: outcome === 'unexpected' ? 'failed' : 'passed',
                        retry: 0,
                        duration: 20,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  });
}
test('concurrent reprocessing writes one run, one result and one daily execution', async () => {
  const item = await upload('expected', '2026-01-01T12:00:00.000Z');
  await Promise.all([processUpload(db, item.id), processUpload(db, item.id)]);
  expect(await db.testRun.count({ where: { uploadId: item.id } })).toBe(1);
  expect(
    await db.testResult.count({ where: { testRun: { uploadId: item.id } } }),
  ).toBe(1);
  const stats = await db.dailyTestStat.findMany({
    where: { testCase: { projectId } },
  });
  expect(stats).toMatchObject([{ executions: 1, flakyCount: 0 }]);
});
test('new contradictory final outcome updates earlier days without double-counting', async () => {
  const item = await upload('unexpected', '2026-01-02T12:00:00.000Z');
  await processUpload(db, item.id);
  await processUpload(db, item.id);
  const stats = await db.dailyTestStat.findMany({
    where: { testCase: { projectId } },
    orderBy: { day: 'asc' },
  });
  expect(stats).toMatchObject([
    { executions: 1, flakyCount: 1, failedCount: 0 },
    { executions: 1, flakyCount: 1, failedCount: 1 },
  ]);
});
test('invalid raw report creates no partial run', async () => {
  const item = await db.upload.create({
    data: {
      projectId,
      ciRunId: randomUUID(),
      attempt: 1,
      commitSha: 'b'.repeat(40),
      branch: 'main',
      rawReport: {},
    },
  });
  await expect(processUpload(db, item.id)).rejects.toThrow();
  expect(await db.testRun.count({ where: { uploadId: item.id } })).toBe(0);
});
