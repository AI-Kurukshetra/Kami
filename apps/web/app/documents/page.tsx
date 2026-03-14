'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ApiError, Document, DocumentAccessRole, DocumentStatus } from '@kami/shared';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';

type DocumentsResponse = {
  items: Document[];
};

type DocumentForm = {
  title: string;
  content: string;
  status: DocumentStatus;
};

const initialForm: DocumentForm = {
  title: '',
  content: '',
  status: 'draft'
};

function getAccessRole(document: Document): DocumentAccessRole {
  return document.accessRole ?? 'owner';
}

function canEdit(document: Document) {
  const role = getAccessRole(document);
  return role === 'owner' || role === 'editor';
}

function canDelete(document: Document) {
  return getAccessRole(document) === 'owner';
}

export default function DocumentsPage() {
  const router = useRouter();

  const [form, setForm] = useState<DocumentForm>(initialForm);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<DocumentStatus>('draft');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DocumentStatus>('all');
  const [authLoading, setAuthLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

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

  const loadDocuments = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await authedFetch('/api/documents', { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Unable to load documents');
      }

      const payload = (await response.json()) as DocumentsResponse;
      setDocuments(payload.items ?? []);
    } catch {
      setErrorMessage('Could not load documents.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, authedFetch]);

  useEffect(() => {
    if (accessToken) {
      void loadDocuments();
    }
  }, [accessToken, loadDocuments]);

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to create document');
      }

      setForm(initialForm);
      setMessage('Document created.');
      await loadDocuments();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create document');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function importDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');

    if (!importFile) {
      setErrorMessage('Select a file to import.');
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('status', importStatus);

      const response = await authedFetch('/api/documents/import', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to import document');
      }

      setImportFile(null);
      setImportStatus('draft');
      setMessage('Document imported successfully.');
      await loadDocuments();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to import document');
    } finally {
      setIsImporting(false);
    }
  }

  function startEdit(document: Document) {
    if (!canEdit(document)) {
      setErrorMessage('You only have view access for this document.');
      return;
    }

    setEditingId(document.id);
    setForm({
      title: document.title,
      content: document.content,
      status: document.status
    });
    setMessage('');
    setErrorMessage('');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
  }

  async function saveEdit(documentId: string) {
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
        throw new Error(error.message || 'Unable to update document');
      }

      setMessage('Document updated.');
      cancelEdit();
      await loadDocuments();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update document');
    }
  }

  async function deleteDocument(documentId: string) {
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

      setMessage('Document deleted.');
      await loadDocuments();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete document');
    }
  }

  const filteredDocuments = documents.filter((document) => {
    const byStatus = statusFilter === 'all' || document.status === statusFilter;
    const byQuery =
      searchQuery.trim().length === 0 ||
      document.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      document.content.toLowerCase().includes(searchQuery.toLowerCase());

    return byStatus && byQuery;
  });

  const stats = {
    total: documents.length,
    owned: documents.filter((document) => getAccessRole(document) === 'owner').length,
    editable: documents.filter((document) => {
      const role = getAccessRole(document);
      return role === 'owner' || role === 'editor';
    }).length,
    viewers: documents.filter((document) => getAccessRole(document) === 'viewer').length
  };

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
        <p className="kicker">Document Module</p>
        <h1>Document Workspace</h1>
        <p className="subtitle">Manage your draft and published documents in Supabase.</p>
        <div className="heroActions">
          <Link className="buttonLink secondary" href="/profiles">
            Back to Profiles
          </Link>
        </div>
      </section>

      <section className="statGrid">
        <article className="card statCard">
          <p className="meta">Total</p>
          <h2>{stats.total}</h2>
        </article>
        <article className="card statCard">
          <p className="meta">Owned</p>
          <h2>{stats.owned}</h2>
        </article>
        <article className="card statCard">
          <p className="meta">Editable</p>
          <h2>{stats.editable}</h2>
        </article>
        <article className="card statCard">
          <p className="meta">View only</p>
          <h2>{stats.viewers}</h2>
        </article>
      </section>

      <section className="grid">
        <article className="card">
          <h2>{editingId ? 'Edit document' : 'Create document'}</h2>
          <form onSubmit={createDocument} className="form">
            <label>
              Title
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                minLength={2}
                maxLength={120}
                required
              />
            </label>

            <label>
              Content
              <textarea
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                maxLength={10000}
                rows={6}
                required
              />
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as DocumentStatus }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>

            {editingId ? (
              <div className="inlineActions">
                <button type="button" onClick={() => void saveEdit(editingId)}>
                  Save changes
                </button>
                <button type="button" className="secondaryButton" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            ) : (
              <button disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Saving...' : 'Create document'}
              </button>
            )}
          </form>

          {message ? <p className="success">{message}</p> : null}
          {errorMessage ? <p className="error">{errorMessage}</p> : null}
        </article>

        <article className="card">
          <h2>Import file to document</h2>
          <p className="meta">Upload a supported file and create a document automatically.</p>
          <form onSubmit={importDocument} className="form">
            <label>
              File
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setImportFile(nextFile);
                }}
                required
              />
            </label>

            <label>
              Initial Status
              <select
                value={importStatus}
                onChange={(event) => setImportStatus(event.target.value as DocumentStatus)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>

            <button disabled={isImporting} type="submit">
              {isImporting ? 'Importing...' : 'Import file'}
            </button>
          </form>
        </article>

        <article className="card">
          <h2>Recent documents</h2>
          <div className="filterRow">
            <input
              placeholder="Search by title/content"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | DocumentStatus)}
            >
              <option value="all">All status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          {isLoading ? <p>Loading documents...</p> : null}

          {!isLoading && documents.length === 0 ? <p>No documents yet.</p> : null}

          {!isLoading && documents.length > 0 && filteredDocuments.length === 0 ? (
            <p className="meta">No documents match your filters.</p>
          ) : null}

          {!isLoading && filteredDocuments.length > 0 ? (
            <ul>
              {filteredDocuments.map((document) => (
                <li key={document.id}>
                  <Link className="nameLink" href={`/documents/${document.id}`}>
                    {document.title}
                  </Link>
                  <p className="meta">
                    Access:
                    <span className="rolePill">{getAccessRole(document)}</span>
                  </p>
                  <p className="meta">Status: {document.status}</p>
                  <p className="meta">Updated: {new Date(document.updatedAt).toLocaleString()}</p>
                  <p className="meta">{document.content.slice(0, 140)}</p>
                  <div className="inlineActions">
                    {canEdit(document) ? (
                      <button type="button" onClick={() => startEdit(document)}>
                        Edit
                      </button>
                    ) : null}
                    {canDelete(document) ? (
                      <button
                        type="button"
                        className="dangerButton"
                        onClick={() => void deleteDocument(document.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </section>
    </main>
  );
}
