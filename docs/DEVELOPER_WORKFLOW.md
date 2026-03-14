# Developer Workflow (MVP)

## 0) Required Skills, Rules, and Tools
Required skills:
- Next.js + TypeScript implementation
- Node.js backend/service logic
- Supabase migrations and RLS
- Vercel deployment operations
- UI/UX execution with Tailwind + shadcn/ui

Required tools:
- Node.js LTS, npm
- Supabase CLI
- Vercel CLI
- ESLint, Prettier, test runner, Playwright

Non-negotiable rules:
- Use migration-first DB changes only
- Reseed non-production DB on each reset/run
- Keep production deploy manual
- Do not commit or expose secrets
- Keep test docs and RTM in sync with requirement changes

## 1) Local Setup
1. Install Node.js LTS and Supabase CLI.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start local Supabase services:
   ```bash
   npx supabase start
   ```
4. Reset DB and apply seed data:
   ```bash
   npx supabase db reset
   ```
5. Start web app:
   ```bash
   npm run dev --workspace apps/web
   ```

## 2) Branch and PR Flow
1. Create feature branch from `main`.
2. Implement changes with TypeScript + lint standards.
3. Run quality checks:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run test:e2e --workspace apps/web
   ```
4. Push branch and open PR.
5. Validate Vercel preview deployment for the PR.
6. Attach in PR:
- Preview URL
- UI screenshots/video (if frontend changed)
- Migration notes (if DB changed)
- Test evidence

## 3) Deployment Flow (Vercel)
- Preview: auto-created from PRs.
- Production: manual deployment/promotion only after preview signoff.

Common commands:
```bash
vercel pull --environment=preview
vercel deploy
vercel deploy --prod
```

Reference docs:
- `docs/VERCEL_ENVIRONMENT_MAPPING.md`
- `docs/DEPLOYMENT_CHECKLIST.md`

## 4) Frontend UX Acceptance Criteria
Each frontend PR must satisfy:
- Attractive and elegant UI consistent with modern-minimal direction
- Responsive on mobile and desktop breakpoints
- Keyboard navigability
- Visible focus states
- Accessible contrast for text and controls

## 5) Definition of Done
A change is done only if:
- Lint and tests pass
- Relevant test docs/RTM are updated when behavior or requirements change
- Preview deployment verified
- PR checklist is complete
