import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parseReport, stableKey, truncateError } from './index';
const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(`packages/report-parser/fixtures/${name}.json`, 'utf8'),
  );
describe('real Playwright output', () => {
  test('normalizes all outcomes, project identity, titles and retry duration', () => {
    const { results } = parseReport(fixture('report'));
    expect(results).toHaveLength(5);
    const flaky = results.find((r) => r.outcome === 'flaky');
    expect(flaky).toMatchObject({
      retries: 1,
      titlePath: ['sample checkout', 'flaky on first attempt'],
      playwrightProject: 'chromium',
    });
    expect(flaky?.errorMessage).toContain('expect');
    expect(
      results.find((r) => r.titlePath.includes('expected failure'))?.outcome,
    ).toBe('passed');
    expect(results.find((r) => r.outcome === 'failed')?.retries).toBe(1);
    expect(results.find((r) => r.outcome === 'skipped')?.retries).toBe(0);
  });
  test('shards preserve identities and partition the full report', () => {
    const all = parseReport(fixture('report'))
      .results.map((r) => r.stableKey)
      .sort();
    const shards = ['shard-1', 'shard-2']
      .flatMap((n) => parseReport(fixture(n)).results.map((r) => r.stableKey))
      .sort();
    expect(shards).toEqual(all);
  });
  test('rejects malformed reports', () => {
    expect(() => parseReport({ suites: [] })).toThrow();
  });
  test('separates projects and unambiguous title paths', () => {
    expect(stableKey('x', ['a', 'b'], 'chromium')).not.toBe(
      stableKey('x', ['a b'], 'chromium'),
    );
    expect(stableKey('x', ['a'], 'chromium')).not.toBe(
      stableKey('x', ['a'], 'firefox'),
    );
    expect(stableKey('a\\b', ['x'], '')).toBe(stableKey('a/b', ['x'], ''));
  });
  test('truncates errors at a UTF-8 boundary within 2 KB', () => {
    const value = truncateError('🌍'.repeat(1000));
    expect(Buffer.byteLength(value ?? '')).toBe(2048);
    expect(value).not.toContain('�');
    expect(truncateError(undefined)).toBeNull();
  });
});
