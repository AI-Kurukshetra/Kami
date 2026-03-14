'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';

export function AuthActions() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = tryCreateSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setEmail(data.session?.user.email ?? null);
      })
      .catch(() => {
        setEmail(null);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!email) {
    return (
      <div className="authActions">
        <Link className="buttonLink" href="/auth">
          Sign in / Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="authActions">
      <span className="authPill">{email}</span>
      <Link className="buttonLink secondary" href="/workspace">
        Open Workspace
      </Link>
    </div>
  );
}
