'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  function signupPasswordError(text: string) {
    if (text.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (!/[A-Z]/.test(text)) {
      return 'Password must include at least one uppercase letter.';
    }
    if (!/[a-z]/.test(text)) {
      return 'Password must include at least one lowercase letter.';
    }
    if (!/\d/.test(text)) {
      return 'Password must include at least one number.';
    }
    return '';
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setErrorMessage('');

    try {
      const supabase = tryCreateSupabaseBrowserClient();

      if (!supabase) {
        throw new Error('Missing Supabase public environment variables');
      }

      if (mode === 'signup') {
        const validationError = signupPasswordError(password);
        if (validationError) {
          throw new Error(validationError);
        }

        const { error } = await supabase.auth.signUp({ email, password });

        if (error) {
          throw error;
        }

        setMessage('Account created. Check your email if confirmation is required.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          throw error;
        }

        router.push('/workspace');
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Authentication failed';
      setErrorMessage(text);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page authPage">
      <section className="card authCard">
        <p className="kicker">Kami Auth</p>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        <p className="subtitle">Use your Supabase credentials to access the workspace.</p>

        <form onSubmit={handleSubmit} className="form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 chars, upper/lower/number' : 'Your password'}
              minLength={mode === 'signup' ? 8 : 6}
              required
            />
          </label>

          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        {message ? <p className="success">{message}</p> : null}
        {errorMessage ? <p className="error">{errorMessage}</p> : null}

        <div className="authSwitch">
          <button
            className="ghostButton"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            type="button"
          >
            {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>

        <Link className="inlineLink" href="/">
          Back to home
        </Link>
      </section>
    </main>
  );
}
