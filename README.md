# Flaky Test Radar

Self-hosted analytics for flaky Playwright tests. Upload a JSON report from CI and see which tests recover on retry, produce contradictory results on the same commit, and need attention over time.

Built for developers and small teams who want to keep their test data on their own infrastructure. The first intended use is dogfooding in the author's public repositories.

## Status

Phase 1 is implemented: asynchronous ingestion, project tokens, a single-admin dashboard, test history, daily trends, and the upload CLI. The CLI is used from a source checkout; it is **not published to npm**. No roadmap features are implemented. See [ROADMAP.md](ROADMAP.md), [issue-ready proposals](docs/ISSUES.md), and the original [specification](docs/SPEC.md).

## Stack and layout

Node.js 24 LTS, pnpm 10, strict TypeScript, NestJS 11, Next.js 16 App Router, PostgreSQL 17, Prisma 6, Redis 7, BullMQ, Zod, Vitest and Playwright. Exact dependency versions are in `pnpm-lock.yaml`.

```text
apps/api                NestJS authentication, ingestion and queries
apps/worker             NestJS standalone BullMQ consumer
apps/web                Next.js dashboard
packages/cli            flaky-radar upload command
packages/report-parser  I/O-free Playwright normalization
packages/shared         schemas, API types and window definitions
packages/database       shared SQL for instability and daily rollups
prisma                  schema, initial migration and fictional seed
examples                sample Playwright suite and GitHub Actions workflow
```

The small database package keeps the worker and query API on the same instability calculation. Controllers only validate inputs and delegate to services.

## Run locally

Prerequisites: Node.js **24**, pnpm **10.32.1**, and Docker Compose. With nvm installed, use `nvm use`. Install pnpm with `corepack enable` or `npm install --global pnpm@10.32.1` if Corepack is unavailable.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

PostgreSQL binds to localhost **5433**, Redis to localhost **6379**. The sample database credentials in Compose are for local development. The seed is repeatable and adds two fictional projects: Sample Store (with results) and Sample Empty. It creates no admin password and no API tokens.

Generate a password hash without putting the password in shell history:

```sh
python3 -c 'import getpass; print(getpass.getpass("Admin password (12+ characters): "))' | pnpm --silent auth:hash
openssl rand -hex 32
```

Put the first command's `scrypt:...` output in `ADMIN_PASSWORD_HASH` and the second output in `SESSION_SECRET` in `.env`. The API refuses to start without configured credentials. Never commit `.env`.

```sh
pnpm build
```

Start these in **three terminals from the repository root**:

```sh
pnpm start:api
pnpm start:worker
pnpm start:web
```

Open **http://localhost:3000** and sign in with the password you chose. The API listens on **http://127.0.0.1:3001/api**; `GET /api/health` is public. The dashboard proxies `/api` to the API, keeping sessions on one origin.

For development, replace the three start commands with `pnpm dev:api`, `pnpm dev:worker` and `pnpm dev:web`. Run `pnpm build:packages` after changing a shared package; the apps consume compiled workspace packages.

To stop local dependencies without deleting data, run `docker compose stop`.

### Environment

| Variable              | Meaning                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string                                                  |
| `REDIS_URL`           | Redis URL; `rediss://` enables TLS                                            |
| `ADMIN_PASSWORD_HASH` | Output from `pnpm --silent auth:hash`                                         |
| `SESSION_SECRET`      | Random session signing key, at least 32 characters                            |
| `PORT`                | API port, default 3001                                                        |
| `API_URL`             | API origin for the dashboard proxy; set before building Next.js               |
| `WEB_ORIGIN`          | Exact dashboard origin used for mutation origin checks                        |
| `NODE_ENV`            | Use `production` with HTTPS for Secure session cookies                        |
| `RADAR_QUEUE_PREFIX`  | Optional Redis queue namespace; default `radar`; must match in API and worker |

The admin cookie is HttpOnly, SameSite=Strict and valid for eight hours. Changing either the password hash or session secret invalidates all sessions. Logout clears the browser cookie. Login attempts are limited to ten per IP per fifteen minutes in each API process. Phase 1 is a single-admin, single-instance setup; multi-user access is deferred.

## Upload from CI

Create a project and a project token in the dashboard. Copy the token when shown; only its SHA-256 hash is stored. Store the token in `FLAKY_RADAR_TOKEN` and your reachable API/dashboard origin in `FLAKY_RADAR_URL`.

Configure Playwright's JSON reporter, for example:

```ts
reporter: [['list'], ['json', { outputFile: 'results.json' }]],
retries: 2,
```

From a built Radar checkout:

```sh
pnpm --filter @flaky-radar/cli exec flaky-radar upload \
  --report /path/to/results.json \
  --api-url "$FLAKY_RADAR_URL" \
  --token "$FLAKY_RADAR_TOKEN" \
  --soft-fail
```

Prefer the environment variables over flags for tokens. The CLI reads `GITHUB_SHA`, `GITHUB_REF_NAME`, `GITHUB_RUN_ID` and `GITHUB_RUN_ATTEMPT`. Outside GitHub Actions, supply `--sha`, `--branch`, `--run-id` and optionally `--attempt`. See `node packages/cli/dist/index.js upload --help`.

A success means the API accepted or already received the upload; it does not mean the worker has finished processing. Failures return nonzero unless `--soft-fail` is present. The CLI validates the report, sends gzip, times out after 30 seconds, rejects redirects and never includes the token or arbitrary server response bodies in its messages. The API accepts at most 10 MB of uncompressed JSON.

Use [examples/github-actions.yml](examples/github-actions.yml) for a complete workflow that builds the unpublished CLI from a pinned checkout. Set its `FLAKY_RADAR_URL` and `FLAKY_RADAR_TOKEN` repository secrets. The service must be reachable by your runner; localhost on a GitHub-hosted runner is not your laptop.

### Shards and repeated tests

For one logical CI run, use Playwright's blob reporter on each shard and `playwright merge-reports --reporter=json` after collecting the blobs, then upload the merged JSON once. Alternatively give each shard a distinct `--run-id` (for example `"${GITHUB_RUN_ID}-shard-1"`); each shard then counts as a separate run for the tests it contains. Uploading different shard bodies with the same run ID and attempt intentionally returns the first upload.

`repeatEach` entries with the same file, title path and Playwright project are collapsed to one test execution per upload. Any Playwright `flaky` outcome wins, otherwise a failure wins, otherwise a pass wins. Durations and retries are summed. Mixed passing and failing repetitions alone do not manufacture a Playwright retry flake.

## Metrics and processing

- **Flaky:** Playwright reports `flaky`, meaning a retry recovered.
- **Unstable on a commit:** the same test has passing and failing final outcomes across different runs of the same SHA. A `flaky` final outcome is passing evidence; skipped results are neither passing nor failing evidence. Expected failures count as passing when Playwright reports `expected`.
- **Flake rate:** executions marked flaky or unstable divided by executed runs. A run that meets both conditions counts once. Skips do not enter the denominator; no executions produces `null`, shown as “No executions”.
- **Windows:** 7 or 30 UTC calendar days, including today. The start is inclusive and the next UTC midnight is exclusive. Instability evidence can come from any stored run of the commit, even outside the selected window. Trend charts always show 30 days and distinguish no executions from a zero rate.
- **Identity:** SHA-256 of the normalized relative file path, complete describe/test title path and Playwright project name. Renaming any of these starts a new identity.

The API persists the raw report before enqueueing a job keyed by upload ID. A `(projectId, ciRunId, attempt)` uniqueness constraint makes concurrent retries idempotent. A 15-second recovery sweep re-enqueues `RECEIVED` uploads if enqueueing was interrupted. A queue outage returns `503 QUEUE_UNAVAILABLE`; retry the same identity safely.

The worker retries processing up to five times with exponential backoff. Processing and daily aggregates share one transaction; a per-project database lock serializes conflicting updates. Reprocessing a completed upload does nothing. New contradictory evidence recalculates affected test histories, including previous days. Exhausted jobs are marked `FAILED` with a safe diagnostic. Investigate the report/server, then submit a corrected upload with a new attempt number. The original raw report remains available to the administrator in PostgreSQL.

Raw reports and stored assertion messages can contain sensitive test data. Phase 1 truncates normalized errors to 2 KB at a UTF-8 boundary; automatic secret redaction and retention are future work. Use fictional data in examples and control access to your installation and database. API health is liveness, not a PostgreSQL/Redis readiness probe.

## API

All paths below are relative to `/api`. Errors use `{ code, message }`.

| Method    | Path                            | Authentication                                |
| --------- | ------------------------------- | --------------------------------------------- |
| POST      | `/auth/login`                   | Password JSON; sets session cookie            |
| POST      | `/auth/logout`                  | Clears session cookie                         |
| GET       | `/auth/session`                 | Admin session                                 |
| GET       | `/health`                       | Public liveness                               |
| POST      | `/uploads`                      | Bearer project token; 202 new / 200 duplicate |
| GET, POST | `/projects`                     | Admin session                                 |
| GET, POST | `/projects/:slug/tokens`        | Admin session; creation reveals token once    |
| DELETE    | `/projects/:slug/tokens/:id`    | Admin session; revokes a token                |
| GET       | `/projects/:slug/tests`         | Admin session                                 |
| GET       | `/projects/:slug/tests/:testId` | Admin session                                 |

Test list options: `window=7d|30d`, `sort=flakeRate|executions|failedCount|name`, `direction=asc|desc`, `page` (1-based), `pageSize` (1–100, default 20). Stable ID tie-breaking prevents unstable ordering. Test details contain the 30-day daily trend and the latest 50 final results, including SHA, branch, retries, duration and truncated error.

## Run checks and tests

Use a development/test database. Integration tests create and delete their own UUID-named projects; they do not reset the database. PostgreSQL and Redis must be running and migrations applied.

```sh
pnpm db:generate
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm check` runs ESLint/Prettier, strict typechecking (including test scripts), Vitest and production builds. The current suite has **37 unit/integration tests**, including **20 parser tests**, plus **8 browser E2E tests** across desktop and mobile Chromium. E2E starts the built API, worker and dashboard, uploads through the actual CLI, and checks login, empty state, token lifecycle, real results and error recovery. It owns ports 3000/3001 and uses an isolated Redis namespace; stop existing app processes first. Test credentials in the E2E harness are deliberately synthetic and are not used by normal start commands.

`pnpm fixtures` regenerates the committed Playwright JSON fixtures from `examples/sample-tests`. Some sample tests intentionally fail or recover on retry. The generator expects these outcomes, scrubs the checkout's absolute path and generates two shards as well as the full report. It needs no browser because the sample tests only use assertions.

The GitHub Actions workflow runs the same checks with real PostgreSQL and Redis and retains the Playwright report on failure.

## License

[MIT](LICENSE). Copyright (c) 2026 fernandaquerino.
