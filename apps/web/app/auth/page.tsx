'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ApiError } from '@kami/shared';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';

type Mode = 'signin' | 'signup';

const phonePattern = /^\+?[1-9]\d{9,14}$/;
const namePattern = /^[a-zA-Z][a-zA-Z '\-]*$/;
const specialCharacterPattern = /[^A-Za-z0-9]/;

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
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
    if (!specialCharacterPattern.test(text)) {
      return 'Password must include at least one special character.';
    }
    return '';
  }

  function normalizePhoneNumber(text: string) {
    return text.replace(/[\s()-]/g, '').trim();
  }

  function signupProfileError() {
    const first = firstName.trim();
    const last = lastName.trim();
    const phone = normalizePhoneNumber(phoneNumber);

    if (first.length < 2 || first.length > 60 || !namePattern.test(first)) {
      return 'Enter a valid first name.';
    }
    if (last.length < 2 || last.length > 60 || !namePattern.test(last)) {
      return 'Enter a valid last name.';
    }
    if (!phonePattern.test(phone)) {
      return 'Phone number must be in valid international format (example: +1 555 123 4567).';
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
        const profileValidationError = signupProfileError();
        if (profileValidationError) {
          throw new Error(profileValidationError);
        }

        const validationError = signupPasswordError(password);
        if (validationError) {
          throw new Error(validationError);
        }

        const trimmedFirstName = firstName.trim();
        const trimmedLastName = lastName.trim();
        const trimmedPhoneNumber = normalizePhoneNumber(phoneNumber);
        const trimmedEmail = email.trim();

        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              first_name: trimmedFirstName,
              last_name: trimmedLastName,
              phone_number: trimmedPhoneNumber
            }
          }
        });

        if (error) {
          throw error;
        }

        const accessToken = data.session?.access_token;

        if (accessToken) {
          const profileResponse = await fetch('/api/profiles', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              firstName: trimmedFirstName,
              lastName: trimmedLastName,
              email: trimmedEmail,
              phoneNumber: trimmedPhoneNumber
            })
          });

          if (!profileResponse.ok) {
            const payload = (await profileResponse.json().catch(() => null)) as ApiError | null;

            if (payload?.code !== 'profile_exists') {
              throw new Error(payload?.message || 'Account created, but profile setup failed.');
            }
          }
        }

        setMessage(
          accessToken
            ? 'Account and profile created successfully. You can now sign in.'
            : 'Account created. Check your email if confirmation is required, then sign in to complete setup.'
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

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
          {mode === 'signup' ? (
            <>
              <label>
                First Name
                <input
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Abhishek"
                  minLength={2}
                  maxLength={60}
                  pattern="^[a-zA-Z][a-zA-Z '-]*$"
                  required
                />
              </label>

              <label>
                Last Name
                <input
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Dave"
                  minLength={2}
                  maxLength={60}
                  pattern="^[a-zA-Z][a-zA-Z '-]*$"
                  required
                />
              </label>

              <label>
                Phone Number
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="+1 555 123 4567"
                  pattern="^\\+?[0-9()\\s-]{10,20}$"
                  inputMode="tel"
                  required
                />
              </label>
            </>
          ) : null}

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
              placeholder={mode === 'signup' ? 'At least 8 chars, upper/lower/number/special' : 'Your password'}
              minLength={8}
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
