# Integration Test Plan (MVP)

## Objective
Validate interactions across Next.js frontend, Node.js server logic, Supabase services, and deployment environment behavior.

## Scope
- UI-to-API request/response contracts
- API-to-Supabase data and auth behavior
- RLS and permission enforcement
- Failure propagation and fallback UX

## Entry Criteria
- Latest migrations applied
- Seed data loaded in test environment
- Required env vars configured

## Exit Criteria
- All critical integration paths pass
- Contract mismatches are resolved or explicitly deferred

## Integration Test Cases

### INT-001 Client to API Contract Validation
- Requirement ID: `REQ-014`
- Positive: expected request payload returns correct 2xx response schema
- Negative: malformed payload returns controlled 4xx with standard error format
- Boundary: max payload size and optional field permutations
- Globalization: UTF-8 payload values round-trip intact

### INT-002 API to Supabase Insert/Read Consistency
- Requirement ID: `REQ-015`
- Positive: inserted record is readable with expected transformed fields
- Negative: DB constraint violation surfaces actionable API error
- Boundary: min/max field lengths and nullability combinations
- Globalization: locale-sensitive fields (names/text) persist correctly

### INT-003 Auth Token and Session Propagation
- Requirement ID: `REQ-003`
- Positive: valid session token grants access across protected API routes
- Negative: expired/invalid token returns unauthorized response
- Boundary: near-expiry token refresh handling
- Globalization: auth error messaging handles text expansion safely

### INT-004 Row Level Security Enforcement
- Requirement ID: `REQ-007`
- Positive: owner can access own records
- Negative: non-owner access blocked by policy
- Boundary: role upgrade/downgrade reflects immediately in access checks
- Globalization: policy-denied messages render correctly

### INT-005 Migration Compatibility
- Requirement ID: `REQ-016`
- Positive: latest app build works with latest migration state
- Negative: missing migration state fails fast with clear diagnostics
- Boundary: sequential migration apply/rollback in non-prod
- Globalization: seeded multilingual rows survive migration

### INT-006 External Failure Propagation
- Requirement ID: `REQ-008`
- Positive: temporary backend outage shows retryable UX
- Negative: repeated failures do not crash frontend runtime
- Boundary: timeout threshold and retry ceiling behavior
- Globalization: fallback error strings remain readable

### INT-007 Vercel Environment Consistency
- Requirement ID: `REQ-017`
- Positive: preview and production env vars resolve correctly
- Negative: missing env var fails with clear startup/runtime message
- Boundary: environment-specific feature flags toggle safely
- Globalization: locale-related env settings do not break rendering

### INT-008 Delete Route Enforcement + UI Feedback Mapping
- Requirement ID: `REQ-019`
- Positive: confirmed delete request reaches API and persists deletion in DB
- Negative: denied/failed delete returns controlled API error and surfaces as error toast
- Boundary: sequential delete operations preserve consistent UI state and API responses
- Globalization: server error messages with UTF-8 text map correctly to toast UI

## Test Data & Setup
- Reset and seed before execution:
```bash
supabase db reset
```
- Use deterministic seeded IDs for reproducible assertions.

## Reporting
For each run capture:
- Build/deployment identifier
- Environment and seed version
- Passed/failed/skipped counts
- Linked defects and impacted requirement IDs
