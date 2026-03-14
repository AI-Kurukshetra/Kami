'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';

import { NotificationsLink } from './notifications-link';

export function TopNavLinks() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const supabase = tryCreateSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setIsAuthenticated(Boolean(data.session));
      })
      .catch(() => {
        setIsAuthenticated(false);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <nav className="topNavLinks" aria-label="Primary Navigation">
        <Link href="/">Home</Link>
        <Link href="/auth">Auth</Link>
      </nav>
    );
  }

  return (
    <nav className="topNavLinks" aria-label="Primary Navigation">
      <Link href="/">Home</Link>
      <Link href="/profiles">Profiles</Link>
      <Link href="/documents">Documents</Link>
      <Link href="/classrooms">Classrooms</Link>
      <Link href="/assignments">Assignments</Link>
      <NotificationsLink />
      <Link href="/workspace">Workspace</Link>
    </nav>
  );
}
