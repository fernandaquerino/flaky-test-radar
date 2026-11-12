import { z } from 'zod';
export const testQuerySchema = z.object({
  window: z.enum(['7d', '30d']).default('30d'),
  sort: z
    .enum(['flakeRate', 'executions', 'failedCount', 'name'])
    .default('flakeRate'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type TestQuery = z.infer<typeof testQuerySchema>;
export function windowBounds(window: '7d' | '30d', now = new Date()) {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const start = new Date(end.getTime() - (window === '7d' ? 7 : 30) * 86400000);
  return { start, end };
}
export interface DailyPoint {
  day: string;
  executions: number;
  flakyCount: number;
  failedCount: number;
  flakeRate: number | null;
}
export interface TestSummary {
  id: string;
  fileName: string;
  titlePath: string[];
  playwrightProject: string;
  executions: number;
  flakyCount: number;
  failedCount: number;
  flakeRate: number | null;
  lastFlakyAt: string | null;
}
export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  executions: number;
  flakyCount: number;
  flakeRate: number | null;
  uploadsLast7Days: number;
}
export interface TestsResponse {
  project: { id: string; name: string; slug: string };
  items: TestSummary[];
  total: number;
  page: number;
  pageSize: number;
  trend: DailyPoint[];
  uploads: { received: number; failed: number };
}
export interface TestDetail {
  test: {
    id: string;
    fileName: string;
    titlePath: string[];
    playwrightProject: string;
  };
  trend: DailyPoint[];
  results: {
    id: string;
    outcome: string;
    retries: number;
    durationMs: number;
    errorMessage: string | null;
    testRun: { commitSha: string; branch: string; startedAt: string };
  }[];
}
export interface TokenSummary {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}
