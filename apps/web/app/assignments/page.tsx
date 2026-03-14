'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { ApiError, Assignment, AssignmentStatus, Classroom } from '@kami/shared';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';

type AssignmentsResponse = {
  items: Assignment[];
};

type ClassroomsResponse = {
  items: Classroom[];
};

type AssignmentForm = {
  classroomId: string;
  title: string;
  description: string;
  status: AssignmentStatus;
  dueAt: string;
};

const initialForm: AssignmentForm = {
  classroomId: '',
  title: '',
  description: '',
  status: 'draft',
  dueAt: ''
};

export default function AssignmentsPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [form, setForm] = useState<AssignmentForm>(initialForm);
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

  const loadData = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    try {
      const [classroomsResponse, assignmentsResponse] = await Promise.all([
        authedFetch('/api/classrooms', { cache: 'no-store' }),
        authedFetch('/api/assignments', { cache: 'no-store' })
      ]);

      if (!classroomsResponse.ok || !assignmentsResponse.ok) {
        throw new Error('Unable to load assignments data');
      }

      const classroomPayload = (await classroomsResponse.json()) as ClassroomsResponse;
      const assignmentPayload = (await assignmentsResponse.json()) as AssignmentsResponse;

      setClassrooms(classroomPayload.items ?? []);
      setAssignments(assignmentPayload.items ?? []);
    } catch {
      setErrorMessage('Could not load assignments.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, authedFetch]);

  useEffect(() => {
    if (accessToken) {
      void loadData();
    }
  }, [accessToken, loadData]);

  const selectedClassroomName = useMemo(
    () => classrooms.find((item) => item.id === form.classroomId)?.name ?? '',
    [classrooms, form.classroomId]
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomId: form.classroomId,
          title: form.title.trim(),
          description: form.description.trim(),
          status: form.status,
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null
        })
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to create assignment');
      }

      setMessage('Assignment created.');
      setForm(initialForm);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create assignment');
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
        <p className="kicker">Assignment Module</p>
        <h1>Assignments</h1>
        <p className="subtitle">Create and publish assignments linked to your classrooms.</p>
        <div className="heroActions">
          <Link className="buttonLink secondary" href="/classrooms">
            Open Classrooms
          </Link>
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Create assignment</h2>
          <form className="form" onSubmit={handleCreate}>
            <label>
              Classroom
              <select
                value={form.classroomId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, classroomId: event.target.value }))
                }
                required
              >
                <option value="">Select classroom</option>
                {classrooms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                minLength={2}
                maxLength={160}
                required
              />
            </label>
            <label>
              Description
              <textarea
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                maxLength={5000}
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as AssignmentStatus }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label>
              Due At
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(event) => setForm((prev) => ({ ...prev, dueAt: event.target.value }))}
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Create assignment'}
            </button>
          </form>
          {selectedClassroomName ? <p className="meta">Target classroom: {selectedClassroomName}</p> : null}
          {message ? <p className="success">{message}</p> : null}
          {errorMessage ? <p className="error">{errorMessage}</p> : null}
        </article>

        <article className="card">
          <h2>Recent assignments</h2>
          {loading ? <p>Loading assignments...</p> : null}
          {!loading && assignments.length === 0 ? <p>No assignments yet.</p> : null}
          {!loading && assignments.length > 0 ? (
            <ul>
              {assignments.map((item) => (
                <li key={item.id}>
                  <p>{item.title}</p>
                  <p className="meta">Status: {item.status}</p>
                  <p className="meta">Classroom ID: {item.classroomId}</p>
                  <p className="meta">Due: {item.dueAt ? new Date(item.dueAt).toLocaleString() : 'Not set'}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </section>
    </main>
  );
}
