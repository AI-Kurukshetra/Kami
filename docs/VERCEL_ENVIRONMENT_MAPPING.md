# Vercel Environment Mapping (MVP)

## Deployment Model
- Web app root: `apps/web`
- Preview deployments: automatic on pull requests
- Production deployments: manual only after preview signoff

## Environment Matrix

| Variable | Local (`.env.local`) | Vercel Preview | Vercel Production | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Required | Required | Required | Public client URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required | Required | Required | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Required (server only) | Required (server only) | Required (server only) | Never expose in client code |

## Setup Steps
1. Link project to Vercel:
   ```bash
   vercel link
   ```
2. Pull preview env vars locally:
   ```bash
   vercel pull --environment=preview
   ```
3. Validate app with pulled vars:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```

## Safety Rules
- Do not commit `.env.local`.
- Do not set service-role key with `NEXT_PUBLIC_` prefix.
- Rotate keys immediately if exposed.
- Keep preview and production values isolated.
