import { z } from 'zod';
const status = z.enum([
  'passed',
  'failed',
  'timedOut',
  'skipped',
  'interrupted',
]);
const result = z
  .object({
    status,
    retry: z.number().int().nonnegative(),
    duration: z.number().nonnegative(),
    error: z
      .object({ message: z.string().optional(), stack: z.string().optional() })
      .passthrough()
      .optional(),
    errors: z
      .array(z.object({ message: z.string().optional() }).passthrough())
      .optional(),
  })
  .passthrough();
const test = z
  .object({
    projectName: z.string(),
    status: z.enum(['expected', 'unexpected', 'flaky', 'skipped']),
    expectedStatus: status.optional(),
    results: z.array(result),
    repeatEachIndex: z.number().optional(),
  })
  .passthrough();
const spec = z
  .object({ title: z.string(), file: z.string(), tests: z.array(test) })
  .passthrough();
export interface ReportSuite {
  title: string;
  file?: string;
  specs: z.infer<typeof spec>[];
  suites?: ReportSuite[];
}
const suite: z.ZodType<ReportSuite> = z.lazy(() =>
  z.object({
    title: z.string(),
    file: z.string().optional(),
    specs: z.array(spec),
    suites: z.array(suite).optional(),
  }),
);
export const reportSchema = z
  .object({
    config: z.object({}).passthrough(),
    suites: z.array(suite),
    stats: z
      .object({
        startTime: z.string().datetime(),
        duration: z.number().nonnegative(),
      })
      .passthrough(),
    errors: z.array(z.unknown()).optional(),
  })
  .passthrough();
export type PlaywrightReport = z.infer<typeof reportSchema>;
export const uploadSchema = z.object({
  ciRunId: z.string().min(1).max(200),
  attempt: z.number().int().min(1).max(10000),
  commitSha: z.string().regex(/^[a-fA-F0-9]{7,64}$/),
  branch: z.string().min(1).max(250),
  report: reportSchema,
});
export type UploadInput = z.infer<typeof uploadSchema>;
export type Outcome = 'passed' | 'failed' | 'flaky' | 'skipped';
export interface NormalizedResult {
  stableKey: string;
  fileName: string;
  titlePath: string[];
  playwrightProject: string;
  outcome: Outcome;
  retries: number;
  durationMs: number;
  errorMessage: string | null;
}
