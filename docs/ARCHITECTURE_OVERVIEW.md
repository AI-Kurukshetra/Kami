# Architecture Overview (MVP)

## Stack
- Web: Next.js App Router (`apps/web`)
- Backend: Next.js route handlers (Node.js runtime pattern)
- Database/Auth: Supabase (Postgres + Auth + RLS)
- Shared contracts: `packages/shared`
- Deploy target: Vercel (web app)

## Core Domains
- Profiles (`/`, `/api/profiles`): owned profile CRUD.
- Documents (`/documents`, `/api/documents`): owner/editor/viewer collaboration.
- Sharing (`/api/documents/[id]/shares`): owner-managed collaborator access.
- Activity (`/api/documents/[id]/activity`): timeline of create/update/share actions.
- Notifications (`/notifications`, `/api/notifications`): user inbox for share changes.

## Auth and Access Workflow
1. Client authenticates with Supabase Auth (`/auth`).
2. Browser sends Bearer access token to protected APIs.
3. API resolves request user via `getRequestUserId`.
4. API enforces access role (`owner|editor|viewer`) before DB mutations.
5. RLS policies protect direct table access at DB layer.

## Data Workflow
1. Schema changes are migration-first in `supabase/migrations`.
2. Local/non-prod reset always uses `npx supabase db reset`.
3. `supabase/seed.sql` ensures deterministic MVP baseline data.
4. API writes trigger activity and notification side-effects.

## Collaboration Workflow
1. Owner creates document.
2. Owner shares by collaborator email (resolved to Auth user id).
3. Editor can update content/status.
4. Viewer is read-only.
5. Share/unshare generates activity entries and user notifications.

## Deployment Workflow (Vercel)
1. Configure env vars in Vercel (Preview + Production).
2. Validate preview deployment first.
3. Promote/deploy production manually.
4. Run post-deploy smoke checks on auth, documents, and notifications.
