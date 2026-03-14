import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';

function loadEnvFile(path) {
  const out = {};
  const text = fs.readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

const env = {
  ...process.env,
  ...loadEnvFile('/Users/abhishekdave/Downloads/Kami/.env.local')
};

const BASE_URL = 'https://kami-mvp.vercel.app';
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(JSON.stringify({ fatal: 'Missing Supabase env vars in .env.local' }, null, 2));
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const stamp = Date.now();
const strongPassword = 'SmokeTest1!';
const confirmedEmail = `smoke.confirmed.${stamp}@example.com`;
const unconfirmedEmail = `smoke.unconfirmed.${stamp}@example.com`;

const results = [];
let confirmedUserId = null;
let unconfirmedUserId = null;

function record(name, passed, details = {}) {
  results.push({ name, passed, ...details });
}

try {
  const createConfirmed = await admin.auth.admin.createUser({
    email: confirmedEmail,
    password: strongPassword,
    email_confirm: true,
    user_metadata: {
      first_name: 'Smoke',
      last_name: 'Confirmed',
      phone_number: '+15551234567'
    }
  });

  if (createConfirmed.error || !createConfirmed.data.user?.id) {
    throw new Error(`Failed to create confirmed user: ${createConfirmed.error?.message || 'unknown'}`);
  }
  confirmedUserId = createConfirmed.data.user.id;

  const createUnconfirmed = await admin.auth.admin.createUser({
    email: unconfirmedEmail,
    password: strongPassword,
    email_confirm: false,
    user_metadata: {
      first_name: 'Smoke',
      last_name: 'Unconfirmed',
      phone_number: '+15557654321'
    }
  });

  if (createUnconfirmed.error || !createUnconfirmed.data.user?.id) {
    throw new Error(`Failed to create unconfirmed user: ${createUnconfirmed.error?.message || 'unknown'}`);
  }
  unconfirmedUserId = createUnconfirmed.data.user.id;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  record('Home page loads', page.url().startsWith(BASE_URL), { url: page.url() });
  const learnMoreCount = await page.getByRole('link', { name: 'Learn more' }).count();
  record('Home page has no Learn more link', learnMoreCount === 0, { learnMoreCount });

  await page.goto(`${BASE_URL}/profiles`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/auth/, { timeout: 15000 });
  record('Guest is redirected from /profiles to /auth', /\/auth/.test(page.url()), { finalUrl: page.url() });

  await page.goto(`${BASE_URL}/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(unconfirmedEmail);
  await page.getByLabel('Password').fill(strongPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  const errorVisible = await page.getByText('Please confirm your email before signing in.').isVisible({ timeout: 15000 }).catch(() => false);
  record('Unconfirmed user blocked at sign in', errorVisible, { finalUrl: page.url(), errorSeen: errorVisible });

  await page.goto(`${BASE_URL}/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(confirmedEmail);
  await page.getByLabel('Password').fill(strongPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/workspace/, { timeout: 15000 });
  record('Confirmed user can sign in and reach /workspace', /\/workspace/.test(page.url()), { finalUrl: page.url() });

  await page.goto(`${BASE_URL}/profiles`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('First Name').waitFor({ timeout: 15000 });

  const firstName = await page.getByLabel('First Name').inputValue();
  const lastName = await page.getByLabel('Last Name').inputValue();
  const email = await page.getByLabel('Email Address').inputValue();
  const phone = await page.getByLabel('Phone Number').inputValue();

  const profilePass = firstName === 'Smoke' && lastName === 'Confirmed' && email === confirmedEmail && phone === '+15551234567';
  record('Profile fields prefilled from registration metadata', profilePass, {
    observed: { firstName, lastName, email, phone }
  });

  await context.close();
  await browser.close();

  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthJson = await healthRes.json().catch(() => ({}));
  record('GET /api/health returns 200', healthRes.status === 200, { status: healthRes.status, body: healthJson });
} catch (error) {
  record('Smoke run execution', false, { error: error instanceof Error ? error.message : String(error) });
} finally {
  const cleanup = { profileDelete: null, confirmedDelete: null, unconfirmedDelete: null };

  if (confirmedUserId || unconfirmedUserId) {
    const ownerIds = [confirmedUserId, unconfirmedUserId].filter(Boolean);
    if (ownerIds.length > 0) {
      const delProfile = await admin.from('profiles').delete().in('owner_id', ownerIds);
      cleanup.profileDelete = delProfile.error ? delProfile.error.message : 'ok';
    }
  }

  if (confirmedUserId) {
    const del = await admin.auth.admin.deleteUser(confirmedUserId);
    cleanup.confirmedDelete = del.error ? del.error.message : 'ok';
  }

  if (unconfirmedUserId) {
    const del = await admin.auth.admin.deleteUser(unconfirmedUserId);
    cleanup.unconfirmedDelete = del.error ? del.error.message : 'ok';
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(JSON.stringify({
    baseUrl: BASE_URL,
    executedAt: new Date().toISOString(),
    totals: { passed, failed, total: results.length },
    results,
    cleanup
  }, null, 2));
}
