import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { markedResults } from '@flaky-radar/database';
import { windowBounds, type TestQuery } from '@flaky-radar/shared';
import { Database } from '../database';
import { ProjectsService } from '../projects/projects.service';
import { fail } from '../errors';
import { trend } from './trend';
export interface MetricRow {
  id: string;
  fileName: string;
  titlePath: string[];
  playwrightProject: string;
  executions: number;
  flakyCount: number;
  failedCount: number;
  flakeRate: number | null;
  lastFlakyAt: Date | null;
}
@Injectable()
export class QueriesService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}
  async listProjects(now = new Date()) {
    const { start, end } = windowBounds('30d', now),
      week = windowBounds('7d', now);
    const projects = await this.db.project.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      projects.map(async (project) => {
        const [stats, uploadsLast7Days] = await Promise.all([
          this.db.dailyTestStat.aggregate({
            where: {
              testCase: { projectId: project.id },
              day: { gte: start, lt: end },
            },
            _sum: { executions: true, flakyCount: true },
          }),
          this.db.upload.count({
            where: {
              projectId: project.id,
              createdAt: { gte: week.start, lt: week.end },
            },
          }),
        ]);
        const executions = stats._sum.executions ?? 0,
          flakyCount = stats._sum.flakyCount ?? 0;
        return {
          ...project,
          executions,
          flakyCount,
          flakeRate: executions ? flakyCount / executions : null,
          uploadsLast7Days,
        };
      }),
    );
  }
  async tests(slug: string, query: TestQuery, now = new Date()) {
    const project = await this.projects.find(slug);
    const { start, end } = windowBounds(query.window, now);
    const columns = {
      flakeRate: Prisma.sql`"flakeRate"`,
      executions: Prisma.sql`"executions"`,
      failedCount: Prisma.sql`"failedCount"`,
      name: Prisma.sql`"titlePath"`,
    };
    const direction =
      query.direction === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const [items, total, points, received, failed] = await Promise.all([
      this.db.$queryRaw<MetricRow[]>`${markedResults(project.id)}, totals AS (
        SELECT "testCaseId", count(*) FILTER (WHERE "startedAt" >= ${start} AND "startedAt" < ${end})::int AS executions,
        count(*) FILTER (WHERE "isFlaky" AND "startedAt" >= ${start} AND "startedAt" < ${end})::int AS "flakyCount",
        count(*) FILTER (WHERE "outcome" = 'failed' AND "startedAt" >= ${start} AND "startedAt" < ${end})::int AS "failedCount",
        max("startedAt") FILTER (WHERE "isFlaky") AS "lastFlakyAt" FROM marked GROUP BY "testCaseId"
      ) SELECT c.id,c."fileName",c."titlePath",c."playwrightProject",coalesce(t.executions,0)::int AS executions,coalesce(t."flakyCount",0)::int AS "flakyCount",coalesce(t."failedCount",0)::int AS "failedCount",t."flakyCount"::float / nullif(t.executions,0) AS "flakeRate",t."lastFlakyAt"
      FROM "TestCase" c LEFT JOIN totals t ON c.id = t."testCaseId" WHERE c."projectId" = ${project.id}
      ORDER BY ${columns[query.sort]} ${direction} NULLS LAST, c.id ASC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      this.db.testCase.count({ where: { projectId: project.id } }),
      trend(this.db, project.id, undefined, now),
      this.db.upload.count({
        where: { projectId: project.id, status: 'RECEIVED' },
      }),
      this.db.upload.count({
        where: { projectId: project.id, status: 'FAILED' },
      }),
    ]);
    return {
      project,
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      trend: points,
      uploads: { received, failed },
    };
  }
  async detail(slug: string, id: string) {
    const project = await this.projects.find(slug);
    const test = await this.db.testCase.findFirst({
      where: { id, projectId: project.id },
    });
    if (!test) fail(404, 'TEST_NOT_FOUND', 'Test not found in this project.');
    const [points, results] = await Promise.all([
      trend(this.db, project.id, id),
      this.db.testResult.findMany({
        where: { testCaseId: id },
        orderBy: [{ testRun: { startedAt: 'desc' } }, { id: 'asc' }],
        take: 50,
        include: {
          testRun: {
            select: { commitSha: true, branch: true, startedAt: true },
          },
        },
      }),
    ]);
    return { test, trend: points, results };
  }
}
