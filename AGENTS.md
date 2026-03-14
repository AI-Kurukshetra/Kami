# Repository Guidelines

## Project Structure & Module Organization
Primary MVP stack: Next.js (web) + Node.js + Supabase, deployed on Vercel. React Native mobile is low priority (phase 2) and does not block MVP releases.

Recommended layout:
- `apps/web/` Next.js App Router application
- `apps/mobile/` React Native app (later phase)
- `packages/shared/` shared types, schemas, and utilities
- `supabase/` migrations, seeds, and RLS policies
- `docs/` architecture, workflow, and testing docs

## Build, Test, and Development Commands
- `npm install` install dependencies
- `npm run dev --workspace apps/web` run local web app
- `npm run build --workspace apps/web` build production bundle
- `npm run lint && npm run test` quality gates
- `supabase start` run local Supabase stack
- `supabase db reset` apply migrations and run seed data
- `vercel pull --environment=preview` sync preview env vars
- `vercel deploy` create preview deployment
- `vercel deploy --prod` manual production deployment

## Required Skills
- TypeScript and Next.js App Router implementation
- Node.js API/service design and validation patterns
- Supabase schema design, RLS policy design, and migration flow
- Vercel environment/deployment management
- Frontend UI/UX execution with Tailwind CSS + shadcn/ui
- QA documentation maintenance (Smoke/Regression/Integration + RTM)

## Required Tools
- Node.js LTS and npm
- Supabase CLI
- Vercel CLI
- ESLint and Prettier
- Test runner (`vitest` or `jest`) and Playwright for key flows

## Engineering Rules
- Never bypass migrations; all DB changes must be migration-driven.
- Reseed non-production data on every reset/run for MVP using `supabase db reset`.
- Never expose secrets or service-role keys in client code.
- Production deployment is always manual after preview validation.
- Every PR must include test evidence and update QA docs/RTM when requirements change.

## Coding Style & Naming Conventions
Use TypeScript across web/server/shared packages.
- 2-space indentation; semicolons; single quotes
- `PascalCase` components, `camelCase` functions/variables, `kebab-case` route/file names
- Separate UI, domain logic, and data access layers

Frontend quality bar: attractive, elegant, modern-minimal UI with consistent spacing, typography hierarchy, subtle motion, and mobile-first responsiveness.
Default UI baseline: Tailwind CSS + shadcn/ui.

## Testing & QA Standards
Testing documentation is mandatory and lives in `docs/testing/`:
- `SMOKE_TEST_PLAN.md`
- `REGRESSION_TEST_PLAN.md`
- `INTEGRATION_TEST_PLAN.md`
- `RTM.md`

Each requirement must include positive, negative, and boundary coverage. Include globalization checks (English MVP + i18n readiness).

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat:`, `fix:`, `chore:`, etc.).
PRs must include: summary, linked task, screenshots/video for UI changes, Vercel preview URL, DB migration notes, and executed test evidence.

## Security, Environments, and MVP Data Policy
Never commit secrets. Keep keys in `.env.local` (local) and Vercel project settings (preview/production). Do not expose Supabase service-role keys to client code.

MVP rule: reseed non-production data every run/reset (local and CI) using `supabase db reset`. Never auto-seed production.

See detailed workflows in `docs/DEVELOPER_WORKFLOW.md` and `docs/DATABASE_WORKFLOW.md`.
