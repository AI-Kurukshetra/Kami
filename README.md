# Kami MVP

Web-first MVP using Next.js, Node.js patterns, Supabase, and Vercel deployment.

## Stack
- Next.js (App Router) in `apps/web`
- Shared TypeScript package in `packages/shared`
- Supabase migrations and seed data in `supabase`
- Supabase Auth pages: `/auth` and protected `/workspace`
- Public landing page: `/`
- Core modules: `/profiles` settings + password change, `/documents` collaborative documents, `/notifications` inbox
- Document collaboration extras: role-based sharing (`owner/editor/viewer`) and activity timeline

## Quick Start
```bash
npm install
npm run db:start
npm run db:reset
npm run dev
```

Required env values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side API only)

Supabase setup checklist:
- `docs/SUPABASE_SETUP.md`

## Quality Commands
```bash
npm run lint
npm run test
npm run build
npm run typecheck
```

E2E smoke (Playwright):
```bash
npm run test:e2e --workspace apps/web
```
Authenticated e2e scenarios use optional env vars:
- `E2E_SUPABASE_TEST_EMAIL`
- `E2E_SUPABASE_TEST_PASSWORD`

## Deployment
- PRs: Vercel preview deployments
- Production: manual deploy/promotion (`vercel deploy --prod`)
- Deployment references:
  - `docs/VERCEL_ENVIRONMENT_MAPPING.md`
  - `docs/DEPLOYMENT_CHECKLIST.md`
  - `docs/ARCHITECTURE_OVERVIEW.md`
  - `docs/FEATURE_STATUS.md`
  - `docs/API_CONTRACTS.md`

## MVP Data Policy
Always reseed non-production DB during reset/run:
```bash
npx supabase db reset
```
Never auto-seed production.
