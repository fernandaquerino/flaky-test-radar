# Proposed GitHub issues

These are issue drafts, not implemented features or published GitHub issues.

<a id="issue-1"></a>

## 1. Quarantine list and CLI grep output

**Problem:** Teams need a temporary way to keep known flaky tests from blocking CI without losing visibility.

**Scope:** Add project-scoped quarantine state, dashboard controls and `flaky-radar quarantine --format grep`.

**Acceptance criteria:** Quarantined tests are visible and reversible; generated patterns escape regex characters and work with Playwright `--grep-invert`; token/project isolation is tested.

<a id="issue-2"></a>

## 2. Publish the CLI with provenance and a GitHub Action wrapper

**Problem:** Building a checkout in every consuming repository makes adoption cumbersome.

**Scope:** Publish a versioned npm CLI with provenance and a thin composite action.

**Acceptance criteria:** A tagged release publishes a verifiable package; the action pins a version and forwards upload options; clean-runner installation and soft-failure behavior are tested.

<a id="issue-3"></a>

## 3. GitHub OAuth and per-project memberships

**Problem:** A shared admin password cannot represent team access or least privilege.

**Scope:** Add GitHub OAuth sign-in, user records, project membership and roles; plan migration from single-admin sessions.

**Acceptance criteria:** Owners can invite and remove members; unauthorized cross-project requests fail; revoked memberships lose access; OAuth state and session flows are covered.

<a id="issue-4"></a>

## 4. Slack and email flake-rate alerts

**Problem:** Teams currently need to inspect the dashboard to notice regressions.

**Scope:** Add per-project thresholds, notification destinations, evaluation cadence and deduplication.

**Acceptance criteria:** A threshold crossing sends one notification with project, test, window and rate; sustained breaches do not spam; recovery/re-crossing and delivery retries are tested.

<a id="issue-5"></a>

## 5. Redact secrets from stored test errors

**Problem:** Assertion messages may expose credentials, email addresses or credential-bearing URLs.

**Scope:** Design configurable redaction before persistence; define handling for raw reports and previously stored data.

**Acceptance criteria:** Representative tokens, emails and URL credentials are removed without destroying useful context; raw and normalized storage behavior is documented; migration/backfill and false-positive tests exist.

<a id="issue-6"></a>

## 6. JUnit XML ingestion

**Problem:** Repositories using Jest, Vitest or Cypress cannot use the Playwright-only parser.

**Scope:** Add a format discriminator and a hardened JUnit XML parser that produces the normalized model.

**Acceptance criteria:** Fixtures from each supported producer ingest correctly; malformed XML and external entities are rejected; ambiguous retry/skip semantics are documented and tested.

<a id="issue-7"></a>

## 7. Test ownership through CODEOWNERS

**Problem:** It is difficult to know which team should fix a flaky test.

**Scope:** Resolve test paths against repository CODEOWNERS and display owners in list/detail views.

**Acceptance criteria:** Matching follows documented precedence and path rules; missing ownership has a clear state; changed mappings can be refreshed without changing test identity.

<a id="issue-8"></a>

## 8. Recency-weighted flakiness score

**Problem:** An unweighted rate can hide recent regressions behind a long stable history.

**Scope:** Introduce a configurable exponential-decay score alongside the existing rate.

**Acceptance criteria:** Recent failures weigh more than old ones; half-life and denominator semantics are documented; deterministic fixtures verify decay and preserve the existing rate.

<a id="issue-9"></a>

## 9. Compare main and feature-branch flake rates

**Problem:** Teams cannot tell whether instability is branch-specific.

**Scope:** Add branch filters and a comparison view with matching test identities and windows.

**Acceptance criteria:** Main and selected branch show rates and execution counts; missing data is distinguished from zero; tests prevent cross-branch denominator leakage.

<a id="issue-10"></a>

## 10. Detect duration regressions using p95

**Problem:** Slow tests can degrade CI even when they pass consistently.

**Scope:** Store/query p95 duration per test and compare a recent window with a baseline.

**Acceptance criteria:** The view identifies regressions with sample sizes and window labels; percentile math and low-sample behavior are tested; skipped tests follow documented rules.

<a id="issue-11"></a>

## 11. Raw report retention and cleanup

**Problem:** JSON uploads accumulate indefinitely and can dominate storage.

**Scope:** Add configurable retention plus a batched cleanup job that preserves normalized history.

**Acceptance criteria:** Expired raw reports are removed in bounded batches; recent reports remain; retries are idempotent; normalized results and query metrics remain intact.

<a id="issue-12"></a>

## 12. Scale TestResult storage and validate one million results

**Problem:** Current raw-result queries and per-test rollup rebuilding target small installations.

**Scope:** Benchmark one million synthetic results, measure bottlenecks, then choose partitioning or incremental rollups.

**Acceptance criteria:** A reproducible load test reports ingestion throughput and query latency; migration and rollback are documented; before/after metrics and exact rate equivalence are verified.

<a id="issue-13"></a>

## 13. Public read-only flake-rate badge

**Problem:** Repository readers lack a compact signal of test reliability.

**Scope:** Add an opt-in `/badge/:slug.svg` endpoint with a current window rate and cache policy.

**Acceptance criteria:** SVG renders correctly for healthy, flaky and no-data projects; disabled/private projects do not leak metrics; output is escaped and cache behavior is tested.

<a id="issue-14"></a>

## 14. OpenTelemetry across API and worker

**Problem:** Queue delays and processing failures are hard to follow across processes.

**Scope:** Propagate trace context through BullMQ and instrument upload, parse, transaction and query operations.

**Acceptance criteria:** One trace links ingestion to processing; spans expose timings without report contents or tokens; export is configurable and disabled safely when unconfigured.

<a id="issue-15"></a>

## 15. Deployment guide and one-click Docker image

**Problem:** Self-hosting currently requires assembling and supervising three Node processes.

**Scope:** Provide a production container strategy, Fly.io or Render guide, HTTPS configuration and migration procedure.

**Acceptance criteria:** A clean account can deploy using the guide; health checks, secrets, persistent storage and worker lifecycle work; upgrade/rollback and backup/restore are documented.
