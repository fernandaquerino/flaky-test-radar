import { expect, test } from 'vitest';
import { parseReport, stableKey, truncateError } from './index';
import type { PlaywrightReport } from '@flaky-radar/shared';
function sample(): PlaywrightReport {
  return {
    config: {},
    stats: { startTime: '2026-01-01T00:00:00.000Z', duration: 12.5 },
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
                status: 'expected',
                results: [{ status: 'passed', retry: 0, duration: 12.5 }],
              },
            ],
          },
        ],
      },
    ],
  };
}
function first(report: PlaywrightReport) {
  return report.suites[0]!.specs[0]!.tests[0]!;
}
test('empty reports normalize to zero results', () => {
  const r = sample();
  r.suites = [];
  expect(parseReport(r).results).toEqual([]);
});
test('does not mutate report input', () => {
  const r = sample(),
    before = structuredClone(r);
  parseReport(r);
  expect(r).toEqual(before);
});
test('rounds timing and keeps report start time', () => {
  expect(parseReport(sample())).toMatchObject({
    durationMs: 13,
    startedAt: new Date('2026-01-01T00:00:00Z'),
  });
});
test('sums retry durations and uses reported retry index', () => {
  const r = sample();
  first(r).status = 'flaky';
  first(r).results = [
    { status: 'failed', retry: 0, duration: 40 },
    { status: 'passed', retry: 2, duration: 60 },
  ];
  expect(parseReport(r).results[0]).toMatchObject({
    retries: 2,
    durationMs: 100,
    outcome: 'flaky',
  });
});
test.each(['timedOut', 'interrupted'] as const)(
  '%s is a final failure when Playwright says unexpected',
  (status) => {
    const r = sample();
    first(r).status = 'unexpected';
    first(r).results[0]!.status = status;
    expect(parseReport(r).results[0]?.outcome).toBe('failed');
  },
);
test('skipped tests without attempts are represented without retries', () => {
  const r = sample();
  first(r).status = 'skipped';
  first(r).results = [];
  expect(parseReport(r).results[0]).toMatchObject({
    outcome: 'skipped',
    retries: 0,
    durationMs: 0,
    errorMessage: null,
  });
});
test('nested describes preserve the complete title path', () => {
  const r = sample(),
    specs = r.suites[0]!.specs;
  r.suites[0]!.specs = [];
  r.suites[0]!.suites = [
    { title: 'checkout', specs: [], suites: [{ title: 'signed in', specs }] },
  ];
  expect(parseReport(r).results[0]?.titlePath).toEqual([
    'checkout',
    'signed in',
    'works',
  ]);
});
test('project variants create separate logical tests', () => {
  const r = sample(),
    copy = structuredClone(first(r));
  copy.projectName = 'firefox';
  r.suites[0]!.specs[0]!.tests.push(copy);
  expect(new Set(parseReport(r).results.map((x) => x.stableKey)).size).toBe(2);
});
test('uses error arrays when the primary error has no message', () => {
  const r = sample();
  first(r).results[0]!.errors = [{ message: 'sample failure' }];
  expect(parseReport(r).results[0]?.errorMessage).toBe('sample failure');
});
test('keeps expected failures passing according to Playwright outcome', () => {
  const r = sample();
  first(r).expectedStatus = 'failed';
  first(r).results[0]!.status = 'failed';
  expect(parseReport(r).results[0]?.outcome).toBe('passed');
});
test('repeats count once and do not invent retry flakes for mixed outcomes', () => {
  const r = sample(),
    copy = structuredClone(first(r));
  copy.status = 'unexpected';
  copy.results[0]!.status = 'failed';
  r.suites[0]!.specs[0]!.tests.push(copy);
  const parsed = parseReport(r);
  expect(parsed.results).toHaveLength(1);
  expect(parsed.results[0]).toMatchObject({
    outcome: 'failed',
    durationMs: 26,
  });
});
test('malformed nested statuses and timestamps are rejected', () => {
  const r = sample();
  expect(() =>
    parseReport({ ...r, stats: { ...r.stats, startTime: 'yesterday' } }),
  ).toThrow();
  expect(() =>
    parseReport({
      ...r,
      suites: [
        {
          title: 'x',
          specs: [
            {
              title: 'x',
              file: 'x',
              tests: [{ projectName: 'x', status: 'unknown', results: [] }],
            },
          ],
        },
      ],
    }),
  ).toThrow();
});
test('error bounds cover ASCII and empty strings', () => {
  expect(truncateError('a'.repeat(3000))).toHaveLength(2048);
  expect(truncateError('')).toBeNull();
});
test('file names and unambiguous project names are part of stable identity', () => {
  expect(stableKey('one', ['same'], 'x')).not.toBe(
    stableKey('two', ['same'], 'x'),
  );
  expect(stableKey('a', ['b', 'c'], 'd')).not.toBe(
    stableKey('a', ['b'], 'c d'),
  );
});
