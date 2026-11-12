'use client';
import { useState, type FormEvent } from 'react';
import { TargetIcon } from '@radix-ui/react-icons';
import { api } from '../../lib/api';
export default function Login() {
  const [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const password = String(new FormData(event.currentTarget).get('password'));
    try {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      window.location.assign('/');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign-in failed.');
      setPending(false);
    }
  }
  return (
    <main id="main" className="login">
      <div className="login-intro">
        <TargetIcon width={42} height={42} />
        <p className="brand-name">Flaky Test Radar</p>
        <h1>
          Make the next
          <br />
          failure meaningful.
        </h1>
        <p>
          Find flaky tests, follow their history, and bring confidence back to
          your CI.
        </p>
        <div className="login-note">Self-hosted. Built for Playwright.</div>
      </div>
      <div className="login-form">
        <form onSubmit={submit}>
          <h2>Welcome back</h2>
          <p>Sign in to your test workspace.</p>
          <label htmlFor="password">Admin password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={1024}
          />
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <button disabled={pending} type="submit">
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="hint">
            Use the administrator password configured for this installation.
          </p>
        </form>
      </div>
    </main>
  );
}
