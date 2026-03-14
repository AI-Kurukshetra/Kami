'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { ApiError, Classroom } from '@kami/shared';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';

type ClassroomsResponse = {
  items: Classroom[];
};

type ClassroomForm = {
  name: string;
  description: string;
};

const initialForm: ClassroomForm = {
  name: '',
  description: ''
};

export default function ClassroomsPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [form, setForm] = useState<ClassroomForm>(initialForm);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const supabase = tryCreateSupabaseBrowserClient();
    if (!supabase) {
      setErrorMessage('Missing Supabase public environment variables.');
      setAuthLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        const token = data.session?.access_token ?? null;
        setAccessToken(token);
        setAuthLoading(false);
        if (!token) {
          router.replace('/auth');
        }
      })
      .catch(() => {
        setErrorMessage('Unable to connect to Supabase session service.');
        setAuthLoading(false);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      setAccessToken(token);
      if (!token) {
        router.replace('/auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const authedFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      if (!accessToken) {
        throw new Error('Authentication required');
      }
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${accessToken}`);
      return fetch(input, { ...init, headers });
    },
    [accessToken]
  );

  const loadClassrooms = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setLoading(true);
    try {
      const response = await authedFetch('/api/classrooms', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Unable to load classrooms');
      }
      const payload = (await response.json()) as ClassroomsResponse;
      setClassrooms(payload.items ?? []);
    } catch {
      setErrorMessage('Could not load classrooms.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, authedFetch]);

  useEffect(() => {
    if (accessToken) {
      void loadClassrooms();
    }
  }, [accessToken, loadClassrooms]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim()
        })
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to create classroom');
      }

      setForm(initialForm);
      setMessage('Classroom created.');
      await loadClassrooms();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create classroom');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <main className="page">
        <section className="card">
          <p>Checking session...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="hero card">
        <p className="kicker">Classroom Module</p>
        <h1>Classrooms</h1>
        <p className="subtitle">Create and manage classroom spaces for assignments.</p>
        <div className="heroActions">
          <Link className="buttonLink secondary" href="/workspace">
            Back to Workspace
          </Link>
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Create classroom</h2>
          <form className="form" onSubmit={handleCreate}>
            <label>
              Name
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <label>
              Description
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={4}
                maxLength={2000}
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Create classroom'}
            </button>
          </form>
          {message ? <p className="success">{message}</p> : null}
          {errorMessage ? <p className="error">{errorMessage}</p> : null}
        </article>

        <article className="card">
          <h2>My classrooms</h2>
          {loading ? <p>Loading classrooms...</p> : null}
          {!loading && classrooms.length === 0 ? <p>No classrooms yet.</p> : null}
          {!loading && classrooms.length > 0 ? (
            <ul>
              {classrooms.map((item) => (
                <li key={item.id}>
                  <p>{item.name}</p>
                  <p className="meta">{item.description || 'No description'}</p>
                  <p className="meta">Updated: {new Date(item.updatedAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </section>
    </main>
  );
}
