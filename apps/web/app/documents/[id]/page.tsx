'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import type {
  ApiError,
  Document,
  DocumentAccessRole,
  DocumentActivity,
  DocumentShare,
  DocumentStatus
} from '@kami/shared';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';

type DocumentForm = {
  title: string;
  content: string;
  status: DocumentStatus;
};

type ShareForm = {
  email: string;
  role: 'viewer' | 'editor';
};

type SharesResponse = {
  items: DocumentShare[];
};

type ActivityResponse = {
  items: DocumentActivity[];
};

const initialForm: DocumentForm = {
  title: '',
  content: '',
  status: 'draft'
};

const initialShareForm: ShareForm = {
  email: '',
  role: 'viewer'
};

function getAccessRole(document: Document | null): DocumentAccessRole {
  return document?.accessRole ?? 'owner';
}

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const documentId = params.id;

  const [documentData, setDocumentData] = useState<Document | null>(null);
  const [form, setForm] = useState<DocumentForm>(initialForm);
  const [shareForm, setShareForm] = useState<ShareForm>(initialShareForm);
  const [shares, setShares] = useState<DocumentShare[]>([]);
  const [activities, setActivities] = useState<DocumentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const accessRole = getAccessRole(documentData);
  const canEdit = accessRole === 'owner' || accessRole === 'editor';
  const canDelete = accessRole === 'owner';
  const canShare = accessRole === 'owner';

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

      return fetch(input, {
        ...init,
        headers
      });
    },
    [accessToken]
  );

  const loadShares = useCallback(async () => {
    if (!accessToken || !documentId) {
      return;
    }

    setSharesLoading(true);

    try {
      const response = await authedFetch(`/api/documents/${documentId}/shares`, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Unable to load collaborators');
      }

      const payload = (await response.json()) as SharesResponse;
      setShares(payload.items ?? []);
    } catch {
      setShares([]);
    } finally {
      setSharesLoading(false);
    }
  }, [accessToken, authedFetch, documentId]);

  const loadActivity = useCallback(async () => {
    if (!accessToken || !documentId) {
      return;
    }

    setActivityLoading(true);

    try {
      const response = await authedFetch(`/api/documents/${documentId}/activity`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Unable to load activity');
      }

      const payload = (await response.json()) as ActivityResponse;
      setActivities(payload.items ?? []);
    } catch {
      setActivities([]);
    } finally {
      setActivityLoading(false);
    }
  }, [accessToken, authedFetch, documentId]);

  const loadDocument = useCallback(async () => {
    if (!accessToken || !documentId) {
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await authedFetch(`/api/documents/${documentId}`, { cache: 'no-store' });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to load document');
      }

      const document = (await response.json()) as Document;
      setDocumentData(document);
      setForm({
        title: document.title,
        content: document.content,
        status: document.status
      });

      if ((document.accessRole ?? 'owner') === 'owner') {
        await loadShares();
      } else {
        setShares([]);
      }

      await loadActivity();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load document');
    } finally {
      setLoading(false);
    }
  }, [accessToken, authedFetch, documentId, loadActivity, loadShares]);

  useEffect(() => {
    if (accessToken && documentId) {
      void loadDocument();
    }
  }, [accessToken, documentId, loadDocument]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      setErrorMessage('You only have view access for this document.');
      return;
    }

    setSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to save document');
      }

      const updated = (await response.json()) as Document;
      setDocumentData(updated);
      setMessage('Document saved successfully.');
      await loadActivity();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save document');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!canDelete) {
      setErrorMessage('Only owners can delete documents.');
      return;
    }

    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch(`/api/documents/${documentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to delete document');
      }

      router.push('/documents');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete document');
    }
  }

  async function handleAddShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canShare) {
      setErrorMessage('Only owners can manage collaborators.');
      return;
    }

    setShareSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch(`/api/documents/${documentId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shareForm)
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to add collaborator');
      }

      setShareForm(initialShareForm);
      setMessage('Collaborator saved.');
      await loadShares();
      await loadActivity();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to add collaborator');
    } finally {
      setShareSaving(false);
    }
  }

  async function handleRemoveShare(userId: string) {
    if (!canShare) {
      setErrorMessage('Only owners can manage collaborators.');
      return;
    }

    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch(`/api/documents/${documentId}/shares/${userId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to remove collaborator');
      }

      setMessage('Collaborator removed.');
      await loadShares();
      await loadActivity();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to remove collaborator');
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
        <p className="kicker">Document Detail</p>
        <h1>Document Editor</h1>
        <p className="subtitle">Edit full content and publication status.</p>
        <p className="meta">
          Access role: <span className="rolePill">{accessRole}</span>
        </p>
        <div className="heroActions">
          <Link className="buttonLink secondary" href="/documents">
            Back to Documents
          </Link>
        </div>
      </section>

      <section className="card">
        {loading ? (
          <p>Loading document...</p>
        ) : (
          <form className="form" onSubmit={handleSave}>
            <label>
              Title
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                minLength={2}
                maxLength={120}
                required
                disabled={!canEdit}
              />
            </label>

            <label>
              Content
              <textarea
                rows={12}
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                maxLength={10000}
                required
                disabled={!canEdit}
              />
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as DocumentStatus }))
                }
                disabled={!canEdit}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>

            <div className="inlineActions">
              {canEdit ? (
                <button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              ) : null}
              {canDelete ? (
                <button type="button" className="dangerButton" onClick={() => void handleDelete()}>
                  Delete
                </button>
              ) : null}
            </div>
          </form>
        )}

        {message ? <p className="success">{message}</p> : null}
        {errorMessage ? <p className="error">{errorMessage}</p> : null}
      </section>

      {canShare ? (
        <section className="card">
          <h2>Collaborators</h2>
          <p className="meta">Add a collaborator email and assign access role.</p>

          <form className="form" onSubmit={handleAddShare}>
            <label>
              Collaborator Email
              <input
                value={shareForm.email}
                onChange={(event) =>
                  setShareForm((prev) => ({ ...prev, email: event.target.value.trim() }))
                }
                placeholder="name@example.com"
                required
                type="email"
              />
            </label>

            <label>
              Role
              <select
                value={shareForm.role}
                onChange={(event) =>
                  setShareForm((prev) => ({ ...prev, role: event.target.value as ShareForm['role'] }))
                }
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </label>

            <button type="submit" disabled={shareSaving}>
              {shareSaving ? 'Saving...' : 'Add or update collaborator'}
            </button>
          </form>

          {sharesLoading ? <p>Loading collaborators...</p> : null}
          {!sharesLoading && shares.length === 0 ? <p className="meta">No collaborators added.</p> : null}

          {!sharesLoading && shares.length > 0 ? (
            <ul>
              {shares.map((share) => (
                <li key={share.userId}>
                  <p className="meta">Email: {share.email ?? 'Unknown'}</p>
                  <p className="meta">User ID: {share.userId}</p>
                  <p className="meta">
                    Role: <span className="rolePill">{share.role}</span>
                  </p>
                  <p className="meta">Added: {new Date(share.createdAt).toLocaleString()}</p>
                  <div className="inlineActions">
                    <button
                      type="button"
                      className="dangerButton"
                      onClick={() => void handleRemoveShare(share.userId)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <h2>Activity</h2>
        {activityLoading ? <p>Loading activity...</p> : null}
        {!activityLoading && activities.length === 0 ? (
          <p className="meta">No activity yet.</p>
        ) : null}
        {!activityLoading && activities.length > 0 ? (
          <ul>
            {activities.map((activity) => (
              <li key={activity.id}>
                <p className="meta">
                  Action: <span className="rolePill">{activity.action}</span>
                </p>
                <p className="meta">Actor: {activity.actorEmail ?? activity.actorUserId}</p>
                <p className="meta">At: {new Date(activity.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
