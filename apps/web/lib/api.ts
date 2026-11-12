'use client';
import { useEffect, useState } from 'react';
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    cache: 'no-store',
  });
  if (response.status === 401 && !path.startsWith('/auth/login')) {
    window.location.assign('/login');
    throw new Error('Your session expired. Please sign in.');
  }
  if (!response.ok) {
    let message = 'The request failed. Check the server and try again.';
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* A reverse proxy may return HTML. */
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
export function useResource<T>(path: string) {
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
  }>({ loading: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setState({ loading: true });
    api<T>(path, { signal: controller.signal })
      .then((data) => {
        if (active) setState({ data, loading: false });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            error: error instanceof Error ? error.message : 'Request failed.',
            loading: false,
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [path, version]);
  return { ...state, reload: () => setVersion((v) => v + 1) };
}
export const percent = (n: number | null) =>
  n === null ? 'No executions' : `${(n * 100).toFixed(1)}%`;
export const date = (value: string) =>
  new Date(value).toLocaleString('en-GB', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  }) + ' UTC';
