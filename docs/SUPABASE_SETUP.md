# Supabase Setup Requirements (MVP)

This project uses Supabase for database and auth.

## What I Need From You
1. Supabase project URL
- Example: `https://<project-ref>.supabase.co`
- Set as `NEXT_PUBLIC_SUPABASE_URL`

2. Supabase anon key
- Public key for browser auth and API calls
- Set as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Supabase service role key
- Server-only key for backend routes/admin operations
- Set as `SUPABASE_SERVICE_ROLE_KEY`
- Never expose to client code

4. Auth mode confirmation
- For MVP, confirm email/password auth is enabled in Supabase Auth settings
- If email confirmation is ON, sign-in requires verified email

## Local Setup Steps
1. Create local env file:
```bash
cp .env.example .env.local
```
2. Fill values in `.env.local`
3. Start Supabase local stack (optional if using cloud only):
```bash
npx supabase start
npx supabase db reset
```
4. Start app:
```bash
npm run dev
```

## Quick Verification
- Open `/api/health` and confirm 200 response
- Open `/auth` and test sign up/sign in
- Open `/workspace` and verify protected access
- Open `/profiles` and verify profile list/create behavior

## Vercel Setup
Set these variables in Vercel for:
- Preview environment
- Production environment
- `NEXT_PUBLIC_APP_URL` must match your Vercel deployment URL (for auth confirmation redirect)

In Supabase Dashboard:
- Auth -> URL Configuration -> `Site URL`: set to your production Vercel URL
- Auth -> URL Configuration -> `Redirect URLs`: add:
  - `https://<your-production-domain>/auth`
  - `https://<your-preview-domain>/auth` (optional for previews)

Reference: `docs/VERCEL_ENVIRONMENT_MAPPING.md`

## Optional E2E Auth Credentials
For authenticated Playwright smoke tests, provide:
- `E2E_SUPABASE_TEST_EMAIL`
- `E2E_SUPABASE_TEST_PASSWORD`

If these are missing, authenticated e2e tests are auto-skipped.
