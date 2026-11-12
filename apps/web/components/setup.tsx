'use client';
import { useState, type FormEvent } from 'react';
import type { TokenSummary } from '@flaky-radar/shared';
import { api, useResource, date } from '../lib/api';
import { ErrorState, Loading } from './shell';
export function Setup({ slug }: { slug: string }) {
  const resource = useResource<TokenSummary[]>(`/projects/${slug}/tokens`);
  const [secret, setSecret] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ token: string }>(`/projects/${slug}/tokens`, {
        method: 'POST',
        body: JSON.stringify({ label: new FormData(form).get('label') }),
      });
      setSecret(result.token);
      form.reset();
      resource.reload();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Token creation failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${slug}/tokens/${id}`, { method: 'DELETE' });
      resource.reload();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not revoke token.',
      );
    } finally {
      setBusy(false);
    }
  }
  const snippet = `- name: Upload test results
  if: always()
  env:
    FLAKY_RADAR_URL: \${{ secrets.FLAKY_RADAR_URL }}
    FLAKY_RADAR_TOKEN: \${{ secrets.FLAKY_RADAR_TOKEN }}
  run: |
    node .radar/packages/cli/dist/index.js upload \
      --report results.json --soft-fail`;
  return (
    <section className="setup panel" id="setup">
      <h2>Connect your CI</h2>
      <p>
        Run Playwright with its JSON reporter, then upload the report after
        every run.
      </p>
      <div className="setup-grid">
        <div>
          <h3>GitHub Actions</h3>
          <p className="hint">
            Build the CLI from a pinned checkout in <code>.radar</code>. Set
            repository secrets for your API URL and project token. The complete
            workflow is in <code>examples/github-actions.yml</code>.
          </p>
          <pre>
            <code>{snippet}</code>
          </pre>
        </div>
        <div>
          <h3>Project tokens</h3>
          <form onSubmit={create} className="token-form">
            <label htmlFor="label">Token label</label>
            <div className="inline-form">
              <input
                id="label"
                name="label"
                placeholder="GitHub Actions"
                required
                maxLength={80}
              />
              <button disabled={busy}>Create token</button>
            </div>
          </form>
          {secret && (
            <div className="secret" role="status">
              <strong>Copy this token now. It is shown only once.</strong>
              <code>{secret}</code>
              <button className="quiet" onClick={() => setSecret('')}>
                I saved my token
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          {resource.loading ? (
            <Loading />
          ) : resource.error ? (
            <ErrorState message={resource.error} retry={resource.reload} />
          ) : resource.data?.length ? (
            <ul className="tokens">
              {resource.data.map((t) => (
                <li key={t.id}>
                  <div>
                    <strong>{t.label}</strong>
                    <span>
                      {t.revokedAt
                        ? 'Revoked'
                        : t.lastUsedAt
                          ? `Last used ${date(t.lastUsedAt)}`
                          : 'Not used yet'}
                    </span>
                  </div>
                  {!t.revokedAt && (
                    <button
                      className="danger quiet"
                      disabled={busy}
                      onClick={() => revoke(t.id)}
                      aria-label={`Revoke ${t.label}`}
                    >
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">
              No tokens yet. Create one for your CI workflow.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
