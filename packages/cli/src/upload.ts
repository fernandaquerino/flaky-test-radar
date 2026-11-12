import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { uploadSchema } from '@flaky-radar/shared';
export interface Dependencies {
  env: NodeJS.ProcessEnv;
  read: (path: string) => Promise<string>;
  fetch: typeof fetch;
  log: (text: string) => void;
  error: (text: string) => void;
}
export function metadata(
  flags: Record<string, string | boolean | undefined>,
  env: NodeJS.ProcessEnv,
) {
  return {
    ciRunId: flags['run-id'] ?? env.GITHUB_RUN_ID,
    attempt: Number(flags.attempt ?? env.GITHUB_RUN_ATTEMPT ?? 1),
    commitSha: flags.sha ?? env.GITHUB_SHA,
    branch: flags.branch ?? env.GITHUB_REF_NAME,
  };
}
const HELP = `flaky-radar upload --report <results.json> [options]
  --api-url <url>   API base URL (or FLAKY_RADAR_URL)
  --token <token>   Project token (prefer FLAKY_RADAR_TOKEN)
  --run-id <id>     Override GITHUB_RUN_ID
  --attempt <n>    Override GITHUB_RUN_ATTEMPT (default 1)
  --sha <sha>      Override GITHUB_SHA
  --branch <name>  Override GITHUB_REF_NAME
  --soft-fail      Always exit 0, reporting upload failures
  --help           Show this help`;
export async function run(
  args: string[],
  overrides: Partial<Dependencies> = {},
): Promise<number> {
  const dep: Dependencies = {
    env: process.env,
    read: (path) => readFile(path, 'utf8'),
    fetch: globalThis.fetch,
    log: console.log,
    error: console.error,
    ...overrides,
  };
  const soft = args.includes('--soft-fail');
  let message = 'Invalid arguments. Run flaky-radar upload --help.';
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      options: {
        report: { type: 'string' },
        'api-url': { type: 'string' },
        token: { type: 'string' },
        'run-id': { type: 'string' },
        attempt: { type: 'string' },
        sha: { type: 'string' },
        branch: { type: 'string' },
        'soft-fail': { type: 'boolean' },
        help: { type: 'boolean' },
      },
    });
    if (values.help) {
      dep.log(HELP);
      return 0;
    }
    if (positionals.length !== 1 || positionals[0] !== 'upload')
      throw new Error();
    message =
      'Provide --report, FLAKY_RADAR_URL and FLAKY_RADAR_TOKEN (or their flags).';
    const apiUrl = values['api-url'] ?? dep.env.FLAKY_RADAR_URL;
    const token = values.token ?? dep.env.FLAKY_RADAR_TOKEN;
    if (!values.report || !apiUrl || !token) throw new Error();
    message =
      'Invalid API URL. Use an http:// or https:// URL without credentials, query or fragment.';
    const url = new URL(apiUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    url.pathname = `${url.pathname.replace(/\/$/, '').replace(/\/api$/, '')}/api/uploads`;
    message = 'Cannot read the report file. Check --report.';
    const raw = await dep.read(values.report);
    message =
      'INVALID_REPORT: expected a Playwright JSON report and valid run ID, attempt, SHA and branch. Supply CI variables or override flags.';
    const payload = uploadSchema.parse({
      ...metadata(values, dep.env),
      report: JSON.parse(raw) as unknown,
    });
    message =
      'Upload could not reach the API. Check the URL, network and server; retry with the same run ID.';
    const response = await dep.fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
      },
      body: gzipSync(JSON.stringify(payload)),
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    message =
      response.status === 401
        ? 'Authentication failed. Check whether the project token is valid or revoked.'
        : response.status === 413
          ? 'Report exceeds the API upload size limit (10 MB uncompressed).'
          : response.status === 503
            ? 'Queue unavailable. Retry with the same run ID and attempt; the upload may already be stored.'
            : `Upload rejected (HTTP ${response.status}). Check the report and server configuration.`;
    if (response.status !== 200 && response.status !== 202) throw new Error();
    dep.log(
      response.status === 200
        ? 'Upload already received.'
        : 'Upload accepted for processing.',
    );
    return 0;
  } catch {
    dep.error(
      `flaky-radar: ${message}${soft ? ' Continuing because --soft-fail is enabled.' : ''}`,
    );
    return soft ? 0 : 1;
  }
}
