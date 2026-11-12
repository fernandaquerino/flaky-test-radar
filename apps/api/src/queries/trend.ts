import type { PrismaClient } from '@prisma/client';
import { windowBounds, type DailyPoint } from '@flaky-radar/shared';
export async function trend(
  db: PrismaClient,
  projectId: string,
  testCaseId?: string,
  now = new Date(),
): Promise<DailyPoint[]> {
  const { start, end } = windowBounds('30d', now);
  const rows = await db.dailyTestStat.groupBy({
    by: ['day'],
    where: {
      testCase: { projectId },
      ...(testCaseId ? { testCaseId } : {}),
      day: { gte: start, lt: end },
    },
    _sum: { executions: true, flakyCount: true, failedCount: true },
    orderBy: { day: 'asc' },
  });
  const indexed = new Map(
    rows.map((row) => [row.day.toISOString().slice(0, 10), row._sum]),
  );
  return Array.from({ length: 30 }, (_, i) => {
    const day = new Date(start.getTime() + i * 86400000)
      .toISOString()
      .slice(0, 10);
    const row = indexed.get(day);
    const executions = row?.executions ?? 0,
      flakyCount = row?.flakyCount ?? 0;
    return {
      day,
      executions,
      flakyCount,
      failedCount: row?.failedCount ?? 0,
      flakeRate: executions ? flakyCount / executions : null,
    };
  });
}
