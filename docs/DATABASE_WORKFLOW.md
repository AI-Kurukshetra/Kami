# Database Workflow (Supabase, MVP)

## 1) Migration Rules
- All schema changes must be migration-driven.
- Never change production schema manually.
- Commit migration files with related application code changes.

Typical flow:
```bash
npx supabase migration new <name>
npx supabase db reset
```

## 2) Seed Data Policy (Mandatory for MVP)
Non-production environments must be reseeded every reset/run:
- Local development: always run `npx supabase db reset`
- CI test runs: reset + seed before test execution
- Preview environments: use controlled non-production seed strategy when needed

Production policy:
- No automatic seeding in production
- Production data updates must be explicit and approved

## 3) RLS and Security
- Keep Row Level Security enabled for user-data tables
- Enforce least-privilege policies
- Do not use service-role key in browser/client code
- Validate authorization server-side for privileged operations

## 4) Test Data Standards
- Seed data must be deterministic and stable
- Include happy-path, negative-path, and boundary-path records
- Include locale-sensitive sample data (UTF-8 names, date/currency formats)

## 5) Change Documentation Requirements
Every DB-related PR must include:
- Migration purpose and impact
- Backward compatibility and rollback notes
- Affected tables/policies/functions
- Test evidence for migration + seeded execution
