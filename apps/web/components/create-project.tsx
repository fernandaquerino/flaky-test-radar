'use client';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
export function CreateProject({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await api('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: data.get('name'),
          slug: data.get('slug'),
        }),
      });
      setOpen(false);
      onCreated();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not create project.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? 'Close form' : 'New project'}
      </button>
      {open && (
        <form className="create-form panel" onSubmit={submit}>
          <h2>Add a repository</h2>
          <label htmlFor="name">Project name</label>
          <input
            id="name"
            name="name"
            placeholder="Storefront"
            required
            maxLength={100}
          />
          <label htmlFor="slug">Project slug</label>
          <input
            id="slug"
            name="slug"
            placeholder="storefront"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={80}
            required
          />
          <p className="hint">Lowercase letters, numbers and hyphens.</p>
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create project'}
          </button>
        </form>
      )}
    </div>
  );
}
