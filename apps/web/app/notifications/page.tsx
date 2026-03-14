'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ApiError, UserNotification } from '@kami/shared';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';

type NotificationsResponse = {
  items: UserNotification[];
  unreadCount: number;
};

export default function NotificationsPage() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
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

  const loadNotifications = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await authedFetch('/api/notifications', { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Unable to load notifications');
      }

      const payload = (await response.json()) as NotificationsResponse;
      setNotifications(payload.items ?? []);
      setUnreadCount(payload.unreadCount ?? 0);
    } catch {
      setErrorMessage('Could not load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, authedFetch]);

  useEffect(() => {
    if (accessToken) {
      void loadNotifications();
    }
  }, [accessToken, loadNotifications]);

  async function markAsRead(notificationId: string) {
    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH'
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to mark notification as read');
      }

      await loadNotifications();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to mark notification as read'
      );
    }
  }

  async function markAllAsRead() {
    setIsMarkingAll(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch('/api/notifications/read-all', {
        method: 'POST'
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to mark all notifications as read');
      }

      setMessage('All notifications marked as read.');
      await loadNotifications();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to mark all notifications as read'
      );
    } finally {
      setIsMarkingAll(false);
    }
  }

  function getDocumentId(metadata: Record<string, unknown>) {
    const candidate = metadata.documentId;
    return typeof candidate === 'string' ? candidate : null;
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
        <p className="kicker">Notifications</p>
        <h1>Activity Inbox</h1>
        <p className="subtitle">Unread: {unreadCount}</p>
        <div className="heroActions">
          <Link className="buttonLink secondary" href="/documents">
            Back to Documents
          </Link>
          <button type="button" onClick={() => void markAllAsRead()} disabled={isMarkingAll || unreadCount === 0}>
            {isMarkingAll ? 'Please wait...' : 'Mark all as read'}
          </button>
        </div>
      </section>

      <section className="card">
        {isLoading ? <p>Loading notifications...</p> : null}
        {!isLoading && notifications.length === 0 ? <p>No notifications yet.</p> : null}

        {!isLoading && notifications.length > 0 ? (
          <ul>
            {notifications.map((item) => (
              <li key={item.id} className={item.readAt ? 'notificationItem' : 'notificationItem unreadItem'}>
                <p className="name">{item.title}</p>
                <p className="meta">{item.body}</p>
                <p className="meta">Type: {item.type}</p>
                <p className="meta">At: {new Date(item.createdAt).toLocaleString()}</p>
                {getDocumentId(item.metadata) ? (
                  <Link
                    className="inlineLink"
                    href={`/documents/${getDocumentId(item.metadata)}`}
                  >
                    Open document
                  </Link>
                ) : null}
                {!item.readAt ? (
                  <div className="inlineActions">
                    <button type="button" onClick={() => void markAsRead(item.id)}>
                      Mark read
                    </button>
                  </div>
                ) : (
                  <p className="meta">Read</p>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {message ? <p className="success">{message}</p> : null}
        {errorMessage ? <p className="error">{errorMessage}</p> : null}
      </section>
    </main>
  );
}
