# Flaky Test Radar: Specification

> Hand this file to the coding agent as the project brief. Save it in the repository as `docs/SPEC.md`.

## 1. Product

**What it is.** A self-hosted tool that tracks flaky end-to-end tests over time. A CLI uploads the
Playwright JSON report from each CI run, an API stores and aggregates the results, and a dashboard
shows which tests are flaky, how often, and whether it is getting better or worse.

**Who it is for.** Developers and small teams who run Playwright in CI and want to know which tests
to fix or quarantine, without paying for a hosted test analytics product.

**First real user.** The author, wired into the CI of her own public repositories.

**Definition of flaky (Phase 1).**

- A test result is **flaky** when Playwright reports its outcome as `flaky` (it failed, then passed
  on retry in the same run).
- A test is **unstable on a commit** when the same test, on the same commit SHA, has both passing
  and failing final outcomes across different runs.
- **Flake rate** of a test in a window = runs where the test was flaky or unstable ÷ runs where the
  test executed, in that window.

## 2. Architecture

pnpm workspaces monorepo, Node.js 24 LTS, strict TypeScript everywhere.

```
flaky-test-radar/
├── apps/
│   ├── api/        # NestJS: ingestion, query API, BullMQ producer
│   ├── worker/     # NestJS standalone app: BullMQ consumers (parse, aggregate)
│   └── web/        # Next.js App Router dashboard
├── packages/
│   ├── cli/        # `flaky-radar` CLI (published to npm later, see roadmap)
│   ├── report-parser/  # pure functions: Playwright JSON → normalized results
│   └── shared/     # zod schemas and types shared by api, worker, web, cli
├── docker-compose.yml  # postgres + redis for local dev
└── .github/workflows/ci.yml
```

- **Database:** PostgreSQL with Prisma. **Queue:** Redis + BullMQ.
- **Ingestion is asynchronous:** the API validates and stores the raw upload, enqueues a job and
  returns `202 Accepted`. The worker parses and writes normalized rows.
- `packages/report-parser` has no I/O and is the most heavily unit-tested package.

## 3. Data model (Phase 1)

| Model           | Key fields                                                                                                                          | Notes                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Project`       | id, name, slug (unique), createdAt                                                                                                  | One per repository                                                          |
| `ApiToken`      | id, projectId, tokenHash (unique), label, lastUsedAt, revokedAt                                                                     | Store SHA-256 hash only; show plaintext once on creation                    |
| `Upload`        | id, projectId, ciRunId, attempt, commitSha, branch, status (`RECEIVED`, `PROCESSED`, `FAILED`), rawReport (jsonb), error, createdAt | Unique `(projectId, ciRunId, attempt)` makes uploads idempotent             |
| `TestCase`      | id, projectId, fileName, titlePath (text[]), stableKey (unique per project)                                                         | `stableKey` = hash of file + title path + project name in Playwright config |
| `TestRun`       | id, projectId, uploadId, commitSha, branch, startedAt, durationMs                                                                   | One per upload                                                              |
| `TestResult`    | id, testRunId, testCaseId, outcome (`passed`, `failed`, `flaky`, `skipped`), retries, durationMs, errorMessage (truncated to 2 KB)  | Index `(testCaseId, testRunId)`                                             |
| `DailyTestStat` | testCaseId, day, executions, flakyCount, failedCount                                                                                | Unique `(testCaseId, day)`; updated by the worker; powers trend charts      |

## 4. CLI (Phase 1)

```
flaky-radar upload --report ./playwright-report/results.json \
  --api-url $FLAKY_RADAR_URL --token $FLAKY_RADAR_TOKEN
```

- Reads git metadata from CI env vars (GitHub Actions first: `GITHUB_SHA`, `GITHUB_REF_NAME`,
  `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`), with flags to override.
- Validates the report shape before sending; gzip the body.
- Exit code 0 on success, non-zero with a clear message on failure. A `--soft-fail` flag never fails
  the CI job.
- Never prints the token.

## 5. API (Phase 1)

Base path `/api`. Validation with `class-validator` or zod; errors as `{ code, message }` with stable
codes such as `UPLOAD_ALREADY_RECEIVED`, `INVALID_REPORT`, `TOKEN_REVOKED`.

| Method   | Path                                                  | Auth                   | Description                                                                                            |
| -------- | ----------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `POST`   | `/uploads`                                            | Project token (Bearer) | Store raw report, enqueue job, `202`. Same `(ciRunId, attempt)` again → `200` with the existing upload |
| `GET`    | `/projects`                                           | Admin session          | List projects with 30-day flake rate                                                                   |
| `POST`   | `/projects`                                           | Admin session          | Create project                                                                                         |
| `POST`   | `/projects/:slug/tokens`                              | Admin session          | Create token, return plaintext once                                                                    |
| `DELETE` | `/projects/:slug/tokens/:id`                          | Admin session          | Revoke token                                                                                           |
| `GET`    | `/projects/:slug/tests?window=7d\|30d&sort=flakeRate` | Admin session          | Paginated test list with flake rate, executions, last flaky at                                         |
| `GET`    | `/projects/:slug/tests/:testId`                       | Admin session          | Test detail: daily trend, last 50 results with commit and error                                        |
| `GET`    | `/health`                                             | None                   | Liveness                                                                                               |

**Admin session (Phase 1):** a single admin user whose password hash comes from `ADMIN_PASSWORD_HASH`
in the environment, with an HttpOnly session cookie. Multi-user auth is on the roadmap.

## 6. Dashboard (Phase 1)

- Login page.
- Projects list: name, flake rate (30 days), uploads in the last 7 days.
- Project page: flakiest tests table (sortable, paginated), flake-rate trend chart (daily, 30 days),
  setup panel showing the CI snippet and token management.
- Test page: trend chart, result history with commit SHA, branch and truncated error.
- Loading, empty ("no uploads yet, here is how to set up CI"), and error states everywhere.
- Accessible: semantic tables, keyboard navigation, charts with a text summary.

## 7. Dogfooding

Provide `examples/github-actions.yml` that runs Playwright with the JSON reporter and calls the CLI
with `--soft-fail`. The author will add it to her own repositories.

## 8. Phase 1 build order (commit after each step)

1. Repo hygiene: LICENSE, README skeleton, `.gitignore`, `.env.example`, pnpm workspace, TS/ESLint/Prettier config, CI workflow.
2. `docker-compose.yml` with Postgres and Redis; Prisma schema and first migration; seed with made-up projects and tests.
3. `packages/report-parser` with fixtures from real Playwright JSON output (generate them from a small sample test suite in `examples/`), plus unit tests for flaky, failed, skipped, retries and sharded reports.
4. API: tokens, idempotent `POST /uploads`, BullMQ producer, health check; integration tests against real Postgres.
5. Worker: parse job, upsert test cases, write results, update `DailyTestStat`; tests for re-processing the same upload twice.
6. Query endpoints with pagination and the flake-rate calculation; tests for the window math.
7. CLI `upload` command with tests for env detection and error handling.
8. Dashboard pages and states.
9. Playwright E2E for the dashboard (login, empty state, project with data).
10. README complete, ROADMAP.md, `docs/ISSUES.md`.

**Stop after step 10.** Do not implement roadmap items.

## 9. Roadmap (write to ROADMAP.md and docs/ISSUES.md, do not implement)

Each item in `docs/ISSUES.md` needs a title, a problem statement, scope and acceptance criteria, so
it can be turned into a GitHub issue.

1. Quarantine list: mark tests as quarantined; `flaky-radar quarantine --format grep` outputs a pattern for `--grep-invert`.
2. Publish the CLI to npm with provenance and a GitHub Action wrapper.
3. Multi-user auth with GitHub OAuth and per-project membership.
4. Slack and email alerts when a test crosses a flake-rate threshold.
5. Secret redaction in stored error messages (tokens, emails, URLs with credentials).
6. JUnit XML support (Jest, Vitest, Cypress).
7. Owners per test via CODEOWNERS mapping.
8. Flakiness score that weights recent runs more (exponential decay).
9. Compare branches: flake rate on main vs feature branch.
10. Duration regression detection (p95 per test).
11. Raw report retention policy and cleanup job.
12. Partitioning or rollups for `TestResult` at high volume; load test with 1M results.
13. Public read-only badge (`/badge/:slug.svg`) with the current flake rate.
14. OpenTelemetry tracing across API and worker.
15. Deploy guide (Fly.io or Render) and a one-click Docker image.

## 10. Repository rules (apply to all work)

- **License:** MIT, `Copyright (c) 2026 fernandaquerino`, in `LICENSE` at the root.
- **README:** what it does, who it is for, stack, how to run locally, how to run tests, status, link to ROADMAP.md.
- **Secrets:** never commit secrets. Only `.env.example` with placeholders; `.env*` (except `.env.example`) in `.gitignore`.
- **Data:** only made-up sample data. No real personal or customer data.
- **Git:** commit after each completed step with Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Do not squash, rewrite history, backdate commits or force-push. Use the git identity already configured on the machine.
- **Quality gates before each commit:** lint, typecheck, tests and build pass. Report only commands that were actually run.
- **Scope:** small, focused files; no business logic in controllers; no `any` or `@ts-ignore` without a written reason.
