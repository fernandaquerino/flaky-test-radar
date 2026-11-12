import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
const db = new PrismaClient();
async function seed() {
  const project = await db.project.upsert({
    where: { slug: 'sample-store' },
    update: {},
    create: { name: 'Sample Store', slug: 'sample-store' },
  });
  await db.project.upsert({
    where: { slug: 'sample-empty' },
    update: {},
    create: { name: 'Sample Empty', slug: 'sample-empty' },
  });
  const titles = [
    'checkout completes',
    'search finds products',
    'cart persists',
  ];
  for (const [index, title] of titles.entries()) {
    const stableKey = createHash('sha256')
      .update(JSON.stringify(['store.spec.ts', [title], 'chromium']))
      .digest('hex');
    const test = await db.testCase.upsert({
      where: { projectId_stableKey: { projectId: project.id, stableKey } },
      update: {},
      create: {
        projectId: project.id,
        fileName: 'store.spec.ts',
        titlePath: [title],
        playwrightProject: 'chromium',
        stableKey,
      },
    });
    for (let day = 0; day < 30; day++) {
      const startedAt = new Date();
      startedAt.setUTCHours(12, 0, 0, 0);
      startedAt.setUTCDate(startedAt.getUTCDate() - day - 1);
      const ciRunId = `seed-${startedAt.toISOString().slice(0, 10)}`;
      const upload = await db.upload.upsert({
        where: {
          projectId_ciRunId_attempt: {
            projectId: project.id,
            ciRunId,
            attempt: 1,
          },
        },
        update: {},
        create: {
          projectId: project.id,
          ciRunId,
          attempt: 1,
          commitSha: createHash('sha1').update(ciRunId).digest('hex'),
          branch: 'main',
          status: 'PROCESSED',
          rawReport: { sample: true },
          createdAt: startedAt,
        },
      });
      const run = await db.testRun.upsert({
        where: { uploadId: upload.id },
        update: {},
        create: {
          projectId: project.id,
          uploadId: upload.id,
          commitSha: upload.commitSha,
          branch: 'main',
          startedAt,
          durationMs: 3500,
        },
      });
      const flaky = day % (index + 3) === 0;
      await db.testResult.upsert({
        where: {
          testCaseId_testRunId: { testCaseId: test.id, testRunId: run.id },
        },
        update: {},
        create: {
          testCaseId: test.id,
          testRunId: run.id,
          outcome: flaky ? 'flaky' : 'passed',
          retries: flaky ? 1 : 0,
          durationMs: 900 + index * 120,
          errorMessage: flaky
            ? 'Sample assertion: expected checkout confirmation to be visible'
            : null,
        },
      });
      const date = new Date(startedAt);
      date.setUTCHours(0, 0, 0, 0);
      await db.dailyTestStat.upsert({
        where: { testCaseId_day: { testCaseId: test.id, day: date } },
        update: {},
        create: {
          testCaseId: test.id,
          day: date,
          executions: 1,
          flakyCount: flaky ? 1 : 0,
          failedCount: 0,
        },
      });
    }
  }
}
seed()
  .finally(() => db.$disconnect())
  .catch(() => {
    process.exitCode = 1;
    console.error('Seed failed. Check database connectivity and migrations.');
  });
