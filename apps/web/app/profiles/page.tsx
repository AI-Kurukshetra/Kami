'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { ApiError, Profile } from '@kami/shared';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';

type ProfilesResponse = {
  items: Profile[];
};

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
};

type PasswordForm = {
  newPassword: string;
  confirmPassword: string;
};

const initialProfileForm: ProfileForm = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: ''
};

const initialPasswordForm: PasswordForm = {
  newPassword: '',
  confirmPassword: ''
};

const phonePattern = /^\+?[1-9]\d{9,14}$/;
const namePattern = /^[a-zA-Z][a-zA-Z '\-]*$/;
const specialCharacterPattern = /[^A-Za-z0-9]/;

function normalizePhoneNumber(text: string) {
  return text.replace(/[\s()-]/g, '').trim();
}

export default function ProfilesPage() {
  const router = useRouter();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(initialProfileForm);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(initialPasswordForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityError, setSecurityError] = useState('');
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

  const loadProfile = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await authedFetch('/api/profiles', { cache: 'no-store' });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to load profile');
      }

      const payload = (await response.json()) as ProfilesResponse;
      const current = payload.items?.[0];

      if (current) {
        setProfileId(current.id);
        setForm({
          firstName: current.firstName,
          lastName: current.lastName,
          email: current.email,
          phoneNumber: current.phoneNumber
        });
      } else {
        setProfileId(null);
        setForm(initialProfileForm);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, authedFetch]);

  useEffect(() => {
    if (accessToken) {
      void loadProfile();
    }
  }, [accessToken, loadProfile]);

  const profileValidationError = useMemo(() => {
    if (!namePattern.test(form.firstName.trim())) {
      return 'Enter a valid first name.';
    }

    if (!namePattern.test(form.lastName.trim())) {
      return 'Enter a valid last name.';
    }

    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return 'Enter a valid email address.';
    }

    if (!phonePattern.test(normalizePhoneNumber(form.phoneNumber))) {
      return 'Phone number must be in valid international format (example: +1 555 123 4567).';
    }

    return '';
  }, [form]);

  const passwordValidationError = useMemo(() => {
    if (passwordForm.newPassword.length < 8) {
      return 'Password must be at least 8 characters.';
    }

    if (!/[A-Z]/.test(passwordForm.newPassword)) {
      return 'Password must include at least one uppercase letter.';
    }

    if (!/[a-z]/.test(passwordForm.newPassword)) {
      return 'Password must include at least one lowercase letter.';
    }

    if (!/\d/.test(passwordForm.newPassword)) {
      return 'Password must include at least one number.';
    }

    if (!specialCharacterPattern.test(passwordForm.newPassword)) {
      return 'Password must include at least one special character.';
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return 'Passwords do not match.';
    }

    return '';
  }, [passwordForm]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');

    if (profileValidationError) {
      setErrorMessage(profileValidationError);
      return;
    }

    setIsSaving(true);

    try {
      const body = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phoneNumber: normalizePhoneNumber(form.phoneNumber)
      };

      if (profileId) {
        const response = await authedFetch(`/api/profiles/${profileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const error = (await response.json()) as ApiError;
          throw new Error(error.message || 'Unable to update profile');
        }

        setMessage('Profile updated successfully.');
      } else {
        const response = await authedFetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const error = (await response.json()) as ApiError;
          throw new Error(error.message || 'Unable to create profile');
        }

        setMessage('Profile created successfully.');
      }

      await loadProfile();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save profile');
    } finally {
      setIsSaving(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSecurityMessage('');
    setSecurityError('');

    if (passwordValidationError) {
      setSecurityError(passwordValidationError);
      return;
    }

    const supabase = tryCreateSupabaseBrowserClient();

    if (!supabase) {
      setSecurityError('Missing Supabase public environment variables.');
      return;
    }

    setIsPasswordSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) {
        throw error;
      }

      setPasswordForm(initialPasswordForm);
      setSecurityMessage('Password updated successfully.');
    } catch (error) {
      setSecurityError(error instanceof Error ? error.message : 'Unable to change password');
    } finally {
      setIsPasswordSaving(false);
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
        <p className="kicker">Account</p>
        <h1>Profile Settings</h1>
        <p className="subtitle">Manage your profile details and account security.</p>
        <div className="heroActions">
          <Link className="buttonLink secondary" href="/workspace">
            Back to Workspace
          </Link>
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Profile Details</h2>

          {isLoading ? <p>Loading profile...</p> : null}

          {!isLoading ? (
            <form onSubmit={saveProfile} className="form">
              <div className="profileFieldGrid">
                <label>
                  First Name
                  <input
                    value={form.firstName}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                    minLength={2}
                    maxLength={60}
                    pattern="[A-Za-z][A-Za-z '\\-]*"
                    required
                  />
                </label>

                <label>
                  Last Name
                  <input
                    value={form.lastName}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                    minLength={2}
                    maxLength={60}
                    pattern="[A-Za-z][A-Za-z '\\-]*"
                    required
                  />
                </label>

                <label>
                  Email Address
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    required
                  />
                </label>

                <label>
                  Phone Number
                  <input
                    type="tel"
                    value={form.phoneNumber}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))
                    }
                    placeholder="+1 555 123 4567"
                    pattern="\\+?[0-9()\\s-]{10,20}"
                    inputMode="tel"
                    required
                  />
                </label>
              </div>

              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : profileId ? 'Update Profile' : 'Create Profile'}
              </button>
            </form>
          ) : null}

          {message ? <p className="success">{message}</p> : null}
          {errorMessage ? <p className="error">{errorMessage}</p> : null}
        </article>

        <article className="card">
          <h2>Security</h2>
          <p className="meta">Change your login password after authentication.</p>

          <form onSubmit={changePassword} className="form">
            <label>
              New Password
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                }
                minLength={8}
                required
              />
            </label>

            <label>
              Confirm New Password
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                }
                minLength={8}
                required
              />
            </label>

            <button type="submit" disabled={isPasswordSaving}>
              {isPasswordSaving ? 'Updating...' : 'Change Password'}
            </button>
          </form>

          {securityMessage ? <p className="success">{securityMessage}</p> : null}
          {securityError ? <p className="error">{securityError}</p> : null}
        </article>
      </section>
    </main>
  );
}
