'use client';
import Link from 'next/link';
import { useState } from 'react';
import { TargetIcon, ExitIcon } from '@radix-ui/react-icons';
import { api } from '../lib/api';
export function Shell({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState('');
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      window.location.assign('/login');
    } catch {
      setError('Could not sign out. Try again.');
    }
  }
  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/">
          <TargetIcon width={25} height={25} />
          Flaky Test Radar
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/">Projects</Link>
          <button className="quiet" onClick={logout}>
            <ExitIcon />
            Sign out
          </button>
        </nav>
      </header>
      <main id="main" className="container">
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}
        {children}
      </main>
      <footer className="footer">
        Your tests. Your data.<span>Self-hosted Playwright analytics</span>
      </footer>
    </>
  );
}
export function Loading() {
  return (
    <div className="state" role="status">
      <span className="spinner" />
      Loading test data…
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="state">
      <h2>Could not load this view</h2>
      <p role="alert">{message}</p>
      <button onClick={retry}>Try again</button>
    </div>
  );
}
