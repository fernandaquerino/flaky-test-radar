import { createHash } from 'node:crypto';
import {
  reportSchema,
  type NormalizedResult,
  type ReportSuite,
  type Outcome,
} from '@flaky-radar/shared';
export function stableKey(
  file: string,
  titlePath: string[],
  project: string,
): string {
  return createHash('sha256')
    .update(JSON.stringify([file.replaceAll('\\', '/'), titlePath, project]))
    .digest('hex');
}
export function truncateError(value: string | undefined): string | null {
  if (!value) return null;
  let output = '';
  let bytes = 0;
  for (const char of value) {
    bytes += Buffer.byteLength(char);
    if (bytes > 2048) break;
    output += char;
  }
  return output;
}
export function parseReport(input: unknown) {
  const report = reportSchema.parse(input);
  const rows = new Map<string, NormalizedResult>();
  function walk(suite: ReportSuite, parents: string[], root: boolean) {
    const titles = root ? parents : [...parents, suite.title];
    for (const spec of suite.specs)
      for (const test of spec.tests) {
        const fileName = spec.file.replaceAll('\\', '/');
        const titlePath = [...titles, spec.title];
        const key = stableKey(fileName, titlePath, test.projectName);
        const outcomes: Record<typeof test.status, Outcome> = {
          expected: 'passed',
          unexpected: 'failed',
          flaky: 'flaky',
          skipped: 'skipped',
        };
        const errors = test.results
          .flatMap((r) => [
            r.error?.message ?? r.error?.stack,
            ...(r.errors ?? []).map((e) => e.message),
          ])
          .filter((x): x is string => Boolean(x));
        const row: NormalizedResult = {
          stableKey: key,
          fileName,
          titlePath,
          playwrightProject: test.projectName,
          outcome: outcomes[test.status],
          retries: Math.max(0, ...test.results.map((r) => r.retry)),
          durationMs: Math.round(
            test.results.reduce((n, r) => n + r.duration, 0),
          ),
          errorMessage: truncateError(errors.join('\n')),
        };
        // repeatEach has one identity per upload; combine repeats without double-counting runs.
        const previous = rows.get(key);
        if (previous) {
          const executed = [previous.outcome, row.outcome].filter(
            (o) => o !== 'skipped',
          );
          row.outcome =
            executed.includes('flaky') ||
            (executed.includes('passed') && executed.includes('failed'))
              ? 'flaky'
              : (executed[0] ?? 'skipped');
          row.retries += previous.retries;
          row.durationMs += previous.durationMs;
          row.errorMessage ??= previous.errorMessage;
        }
        rows.set(key, row);
      }
    for (const child of suite.suites ?? []) walk(child, titles, false);
  }
  for (const suite of report.suites) walk(suite, [], true);
  return {
    startedAt: new Date(report.stats.startTime),
    durationMs: Math.round(report.stats.duration),
    results: [...rows.values()],
  };
}
