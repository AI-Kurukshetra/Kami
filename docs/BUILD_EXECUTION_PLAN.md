# Build Execution Plan (MVP, Full-Proof)

## Summary
This plan is the implementation contract for building and releasing the MVP with Next.js, Node.js, Supabase, and Vercel. Execute phases in order and do not skip quality gates.

## Phase 1: Foundation and Repo Setup
1. Initialize monorepo structure (`apps/web`, `packages/shared`, `supabase`, `docs/testing`).
2. Configure TypeScript, ESLint, Prettier, and base scripts.
3. Set up Next.js app skeleton and shared design tokens.
4. Define environment variable template for local/preview/production.

Exit criteria:
- Local app runs.
- Lint/test scripts execute.
- Tooling config committed.

## Phase 2: Data and Backend Core
1. Create initial Supabase migrations for MVP entities.
2. Define RLS policies for all user-data tables.
3. Add deterministic seed data for non-production.
4. Implement Node.js/API data access and validation layer.

Exit criteria:
- `supabase db reset` fully provisions schema + seed.
- Unauthorized data access is blocked.
- Core API contracts are stable and documented.

## Phase 3: Frontend MVP Features (Web First)
1. Build primary user flows in Next.js (auth + core entity lifecycle).
2. Apply modern-minimal UI system (Tailwind + shadcn/ui).
3. Ensure responsive behavior (mobile and desktop).
4. Add baseline accessibility support (keyboard, focus, contrast).

Exit criteria:
- Core flows complete.
- UI meets elegant/attractive UX requirement.
- Accessibility baseline passes manual checks.

## Phase 4: Testing and Traceability
1. Populate and execute smoke, regression, and integration test docs.
2. Maintain RTM mapping for all MVP requirements.
3. Cover positive, negative, boundary, and globalization scenarios.
4. Log defects by severity and requirement impact.

Exit criteria:
- All critical/high defects resolved or approved with waiver.
- RTM is complete and current.

## Phase 5: Deployment and Release
1. Configure Vercel project for `apps/web`.
2. Validate PR preview deployments for each change.
3. Run release checklist: lint, tests, smoke, migration checks, seed checks (non-prod).
4. Manually deploy/promote production from verified preview.

Exit criteria:
- Production deployment completed without rollback.
- Post-deploy smoke tests pass.

## Quality Gates (Mandatory)
- No merge with failing lint/tests.
- No production deploy without passing smoke tests.
- No DB changes without migration + seeded verification.
- No requirement changes without QA docs + RTM updates.

## Risk Controls
- Security: keep secrets in environment managers only.
- Data: never auto-seed production.
- UX: block release if critical responsive/accessibility issues exist.
- Ops: use rollback-ready migration strategy for every release.

## Start-Build Checklist
- [ ] Tools installed (Node, Supabase CLI, Vercel CLI)
- [ ] Environment variables configured
- [ ] `npx supabase start` and `npx supabase db reset` successful
- [ ] `npm run dev --workspace apps/web` successful
- [ ] QA docs and RTM baseline created
