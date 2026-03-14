'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';

type NotificationsResponse = {
  unreadCount: number;
};

export function NotificationsLink() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [suppressPolling, setSuppressPolling] = useState(false);

  useEffect(() => {
    const supabaseClient = tryCreateSupabaseBrowserClient();

    if (!supabaseClient) {
      return;
    }

    let isMounted = true;

    async function refresh(sessionToken: string | null) {
      if (!sessionToken || !isMounted || suppressPolling) {
        if (!sessionToken) {
          setUnreadCount(0);
        }
        return;
      }

      const response = await fetch('/api/notifications', {
        headers: {
          Authorization: `Bearer ${sessionToken}`
        },
        cache: 'no-store'
      }).catch(() => null);

      if (!response || !isMounted) {
        return;
      }

      if (!response.ok) {
        // Prevent repeated 5xx spam in nav polling when backend/config is unavailable.
        if (response.status >= 500) {
          setSuppressPolling(true);
        }
        return;
      }

      const payload = (await response.json()) as NotificationsResponse;
      setUnreadCount(payload.unreadCount ?? 0);
    }

    function refreshCurrentSession() {
      supabaseClient!.auth
        .getSession()
        .then(({ data }) => {
          void refresh(data.session?.access_token ?? null);
        })
        .catch(() => {
          setUnreadCount(0);
        });
    }

    refreshCurrentSession();

    const {
      data: { subscription }
    } = supabaseClient!.auth.onAuthStateChange((_event, session) => {
      void refresh(session?.access_token ?? null);
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshCurrentSession();
      }
    };

    window.addEventListener('focus', refreshCurrentSession);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', refreshCurrentSession);
      document.removeEventListener('visibilitychange', handleVisibility);
      subscription.unsubscribe();
    };
  }, [suppressPolling]);

  return (
    <Link href="/notifications" className="navLinkWithBadge">
      Notifications
      {unreadCount > 0 ? <span className="navBadge">{unreadCount}</span> : null}
    </Link>
  );
}
