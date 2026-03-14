'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function WorkspacePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const supabase = tryCreateSupabaseBrowserClient();

    if (!supabase) {
      setErrorMessage('Missing Supabase public environment variables');
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        const sessionEmail = data.session?.user.email ?? null;
        setEmail(sessionEmail);
        setLoading(false);

        if (!sessionEmail) {
          router.replace('/auth');
        }
      })
      .catch(() => {
        setErrorMessage('Unable to connect to Supabase session service');
        setLoading(false);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionEmail = session?.user.email ?? null;
      setEmail(sessionEmail);

      if (!sessionEmail) {
        router.replace('/auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleSignOut() {
    setErrorMessage('');

    try {
      const supabase = tryCreateSupabaseBrowserClient();

      if (!supabase) {
        throw new Error('Missing Supabase public environment variables');
      }
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace('/auth');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to sign out';
      setErrorMessage(text);
    }
  }

  if (loading) {
    return (
      <main className="page authPage">
        <section className="card authCard">
          <p>Checking session...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="hero card">
        <p className="kicker">Protected Workspace</p>
        <h1>Welcome{email ? `, ${email}` : ''}</h1>
        <p className="subtitle">You are authenticated via Supabase Auth.</p>
      </section>

      <section className="card">
        <div className="workspaceActions">
          <Link className="buttonLink secondary" href="/profiles">
            Open Profiles Dashboard
          </Link>
          <Link className="buttonLink secondary" href="/documents">
            Open Documents
          </Link>
          <Link className="buttonLink secondary" href="/notifications">
            Open Notifications
          </Link>
          <button onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>

        {errorMessage ? <p className="error">{errorMessage}</p> : null}
      </section>
    </main>
  );
}
