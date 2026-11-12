import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, test, vi } from 'vitest';
import { metadata, run } from './upload';
const env = {
  GITHUB_RUN_ID: '12',
  GITHUB_RUN_ATTEMPT: '2',
  GITHUB_SHA: 'a'.repeat(40),
  GITHUB_REF_NAME: 'main',
  FLAKY_RADAR_URL: 'https://radar.example/api',
  FLAKY_RADAR_TOKEN: 'secret-do-not-print',
};
const read = async () =>
  readFileSync('packages/report-parser/fixtures/report.json', 'utf8');
test('detects GitHub metadata and honors overrides', () => {
  expect(metadata({}, env)).toMatchObject({
    ciRunId: '12',
    attempt: 2,
    branch: 'main',
  });
  expect(
    metadata(
      {
        'run-id': 'custom',
        attempt: '3',
        branch: 'feature',
        sha: 'b'.repeat(40),
      },
      env,
    ),
  ).toMatchObject({
    ciRunId: 'custom',
    attempt: 3,
    branch: 'feature',
    commitSha: 'b'.repeat(40),
  });
});
test('validates and gzips an authenticated upload', async () => {
  const fetcher = vi.fn<typeof fetch>(async (url, options) => {
    expect(String(url)).toBe('https://radar.example/api/uploads');
    const body = JSON.parse(gunzipSync(options?.body as Buffer).toString()) as {
      ciRunId: string;
    };
    expect(body.ciRunId).toBe('12');
    expect(options?.redirect).toBe('error');
    return new Response('{}', { status: 202 });
  });
  expect(
    await run(['upload', '--report', 'fixture'], {
      env,
      read,
      fetch: fetcher,
      log: vi.fn(),
    }),
  ).toBe(0);
  expect(fetcher).toHaveBeenCalledOnce();
});
test('network errors and server bodies never disclose tokens', async () => {
  const error = vi.fn();
  const fetcher = vi.fn<typeof fetch>(async () => {
    throw new Error(env.FLAKY_RADAR_TOKEN);
  });
  expect(
    await run(['upload', '--report', 'fixture'], {
      env,
      read,
      fetch: fetcher,
      error,
    }),
  ).toBe(1);
  expect(
    await run(['upload', '--report', 'fixture', '--soft-fail'], {
      env,
      read,
      fetch: fetcher,
      error,
    }),
  ).toBe(0);
  expect(JSON.stringify(error.mock.calls)).not.toContain(env.FLAKY_RADAR_TOKEN);
});
test('malformed reports and missing environment fail before sending; soft fail covers argument errors', async () => {
  const fetcher = vi.fn<typeof fetch>();
  const error = vi.fn();
  expect(
    await run(['upload', '--report', 'fixture'], {
      env,
      read: async () => '{}',
      fetch: fetcher,
      error,
    }),
  ).toBe(1);
  expect(
    await run(['upload', '--report', 'fixture'], {
      env: {},
      read,
      fetch: fetcher,
      error,
    }),
  ).toBe(1);
  expect(await run(['--unknown', '--soft-fail'], { error })).toBe(0);
  expect(fetcher).not.toHaveBeenCalled();
});
test('handles duplicate, auth, oversized and unavailable responses', async () => {
  for (const status of [200, 401, 413, 503]) {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(env.FLAKY_RADAR_TOKEN, { status }),
    );
    const log = vi.fn(),
      error = vi.fn();
    expect(
      await run(['upload', '--report', 'fixture'], {
        env,
        read,
        fetch: fetcher,
        log,
        error,
      }),
    ).toBe(status === 200 ? 0 : 1);
    expect(
      JSON.stringify([...log.mock.calls, ...error.mock.calls]),
    ).not.toContain(env.FLAKY_RADAR_TOKEN);
  }
});
