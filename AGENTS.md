# Repository Guidelines

## Project Structure & Module Organization
Kami MVP uses Next.js + Node.js + Supabase, deployed on Vercel. React Native is post-MVP.
- `apps/web/`: Next.js App Router UI and API routes
- `packages/shared/`: shared TypeScript types/contracts
- `supabase/`: migrations, seed data, SQL policies
- `docs/`: architecture, workflows, QA artifacts
- `apps/mobile/`: reserved for low-priority mobile phase

## Build, Test, and Development Commands
- `npm install`: install workspace dependencies
- `npm run dev --workspace apps/web`: run local web app
- `npm run lint`: run ESLint checks
- `npm run typecheck`: run TypeScript checks
- `npm run test`: run integration/smoke tests (Vitest)
- `npm run build`: production build for web app
- `npx supabase db reset`: apply migrations and reseed non-prod data

## Coding Style & Naming Conventions
Use TypeScript across web, API, and shared packages.
- 2-space indentation, semicolons, single quotes
- `PascalCase` for React components
- `camelCase` for variables/functions
- `kebab-case` for route folders/files
Keep API validation strict with `zod`, and keep data access in route/server layers only.

## Frontend Quality Standards
UI must be product-focused, attractive, and mobile responsive.
- Support light and dark mode
- Maintain consistent spacing, typography hierarchy, and accessible contrast
- Logged-out users: Home + Auth only
- Logged-in users: access Profiles, Documents, Notifications, Workspace

## Database, Security & Environment Rules
Use migration-first database changes; do not patch schema manually in production.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code
- Keep secrets in `.env.local` and Vercel project envs only
- Reseed every non-production reset for MVP consistency

## Testing & QA Expectations
After development completion, maintain detailed QA docs in `docs/testing/`:
- Smoke, Regression, Integration test plans
- RTM (requirement traceability matrix)
Cover positive, negative, and boundary cases, plus globalization/i18n-readiness checks.

## Commit & Pull Request Guidelines
Follow Conventional Commits (e.g., `feat:`, `fix:`, `chore:`). PRs must include scope summary, linked task, migration notes, screenshots for UI changes, and executed test evidence.
