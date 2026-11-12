import { PrismaClient } from '@prisma/client';
import { parseReport } from '@flaky-radar/report-parser';
import { refreshDailyStats } from '@flaky-radar/database';
export async function processUpload(db: PrismaClient, id: string) {
  const upload = await db.upload.findUniqueOrThrow({ where: { id } });
  const report = parseReport(upload.rawReport);
  await db.$transaction(
    async (tx) => {
      // Serializes uploads in this project so cross-run evidence and daily rollups stay consistent.
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${upload.projectId} FOR UPDATE`;
      const current = await tx.upload.findUniqueOrThrow({ where: { id } });
      if (current.status === 'PROCESSED') return;
      const run = await tx.testRun.create({
        data: {
          projectId: upload.projectId,
          uploadId: id,
          commitSha: upload.commitSha,
          branch: upload.branch,
          startedAt: report.startedAt,
          durationMs: report.durationMs,
        },
      });
      const ids: string[] = [];
      for (const result of report.results) {
        const {
          stableKey,
          fileName,
          titlePath,
          playwrightProject,
          ...outcome
        } = result;
        const test = await tx.testCase.upsert({
          where: {
            projectId_stableKey: { projectId: upload.projectId, stableKey },
          },
          update: { fileName, titlePath, playwrightProject },
          create: {
            projectId: upload.projectId,
            stableKey,
            fileName,
            titlePath,
            playwrightProject,
          },
        });
        await tx.testResult.create({
          data: { testCaseId: test.id, testRunId: run.id, ...outcome },
        });
        ids.push(test.id);
      }
      await refreshDailyStats(tx, upload.projectId, ids);
      await tx.upload.update({
        where: { id },
        data: { status: 'PROCESSED', error: null },
      });
    },
    { maxWait: 30000, timeout: 120000 },
  );
}
