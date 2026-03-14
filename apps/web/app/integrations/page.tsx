'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { ApiError, IntegrationProvider, IntegrationSetting, IntegrationStatus } from '@kami/shared';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';

type IntegrationsResponse = {
  items: IntegrationSetting[];
};

type IntegrationForm = {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  configText: string;
};

const initialForm: IntegrationForm = {
  provider: 'google_drive',
  status: 'disconnected',
  configText: '{}'
};

export default function IntegrationsPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<IntegrationSetting[]>([]);
  const [form, setForm] = useState<IntegrationForm>(initialForm);
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

  const loadItems = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setLoading(true);
    try {
      const response = await authedFetch('/api/integrations', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Unable to load integrations');
      }
      const payload = (await response.json()) as IntegrationsResponse;
      setItems(payload.items ?? []);
    } catch {
      setErrorMessage('Could not load integrations.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, authedFetch]);

  useEffect(() => {
    if (accessToken) {
      void loadItems();
    }
  }, [accessToken, loadItems]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setErrorMessage('');

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(form.configText) as Record<string, unknown>;
    } catch {
      setErrorMessage('Config JSON is invalid.');
      setSaving(false);
      return;
    }

    try {
      const response = await authedFetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: form.provider,
          status: form.status,
          config: parsedConfig
        })
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to save integration');
      }

      setMessage('Integration setting saved.');
      await loadItems();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save integration');
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
        <p className="kicker">Integration Module</p>
        <h1>Integrations</h1>
        <p className="subtitle">Manage provider connection metadata for storage and LMS services.</p>
        <div className="heroActions">
          <Link className="buttonLink secondary" href="/workspace">
            Back to Workspace
          </Link>
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Save integration setting</h2>
          <form className="form" onSubmit={handleSave}>
            <label>
              Provider
              <select
                value={form.provider}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, provider: event.target.value as IntegrationProvider }))
                }
              >
                <option value="google_drive">Google Drive</option>
                <option value="dropbox">Dropbox</option>
                <option value="onedrive">OneDrive</option>
                <option value="canvas">Canvas</option>
                <option value="google_classroom">Google Classroom</option>
              </select>
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as IntegrationStatus }))
                }
              >
                <option value="disconnected">Disconnected</option>
                <option value="connected">Connected</option>
              </select>
            </label>

            <label>
              Config JSON
              <textarea
                rows={6}
                value={form.configText}
                onChange={(event) => setForm((prev) => ({ ...prev, configText: event.target.value }))}
              />
            </label>

            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save integration'}
            </button>
          </form>
          {message ? <p className="success">{message}</p> : null}
          {errorMessage ? <p className="error">{errorMessage}</p> : null}
        </article>

        <article className="card">
          <h2>Current settings</h2>
          {loading ? <p>Loading integrations...</p> : null}
          {!loading && items.length === 0 ? <p>No integration settings yet.</p> : null}
          {!loading && items.length > 0 ? (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <p>{item.provider}</p>
                  <p className="meta">Status: {item.status}</p>
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
