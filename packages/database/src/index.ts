import { Prisma } from '@prisma/client';
/** Compare final outcomes across all known runs of a commit, including outside the query window. */
export function markedResults(projectId: string) {
  return Prisma.sql`WITH evidence AS (
    SELECT r."id", r."testCaseId", r."testRunId", r."outcome", t."startedAt", t."commitSha",
      bool_or(r."outcome" IN ('passed', 'flaky')) OVER w AS has_pass,
      bool_or(r."outcome" = 'failed') OVER w AS has_fail
    FROM "TestResult" r JOIN "TestRun" t ON t.id = r."testRunId"
    WHERE t."projectId" = ${projectId}
    WINDOW w AS (PARTITION BY r."testCaseId", t."commitSha")
  ), marked AS (
    SELECT *, ("outcome" = 'flaky' OR (has_pass AND has_fail)) AS "isFlaky"
    FROM evidence WHERE "outcome" <> 'skipped'
  )`;
}
export async function refreshDailyStats(
  tx: Prisma.TransactionClient,
  projectId: string,
  ids: string[],
) {
  if (!ids.length) return;
  await tx.dailyTestStat.deleteMany({ where: { testCaseId: { in: ids } } });
  await tx.$executeRaw`${markedResults(projectId)}
    INSERT INTO "DailyTestStat" ("testCaseId", "day", "executions", "flakyCount", "failedCount")
    SELECT "testCaseId", ("startedAt" AT TIME ZONE 'UTC')::date, count(*)::int,
      count(*) FILTER (WHERE "isFlaky")::int, count(*) FILTER (WHERE "outcome" = 'failed')::int
    FROM marked WHERE "testCaseId" IN (${Prisma.join(ids)})
    GROUP BY "testCaseId", ("startedAt" AT TIME ZONE 'UTC')::date`;
}
