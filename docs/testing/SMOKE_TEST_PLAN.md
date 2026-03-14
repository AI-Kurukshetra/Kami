# Smoke Test Plan (MVP)

## Objective
Validate that critical user journeys and core integrations are healthy after deployment or major merge.

## Scope
- Web app availability on Vercel preview/production
- Authentication basic flow
- Core create/read/update flow for primary MVP entity
- Supabase connectivity and policy enforcement basics

## Out of Scope
- Full edge-case permutations (covered in regression/integration)
- Non-critical UI polish scenarios

## Entry Criteria
- Deployment completed
- Required environment variables present
- DB migrations applied and non-production data seeded

## Exit Criteria
- All P0 smoke tests pass
- No open critical defects

## Environment & Data
- Environment: PR preview or staging-like non-production
- Data: reset and seeded dataset (`supabase db reset`)

## Test Case Template
Use fields: `Test ID`, `Requirement ID`, `Priority`, `Type`, `Preconditions`, `Steps`, `Expected`, `Actual`, `Status`, `Defect ID`, `Notes`.

## Detailed Smoke Test Cases

### SMK-001 Application Boot and Health
- Requirement ID: `REQ-001`
- Type: Positive
- Preconditions: Deployment live
- Steps: Open application root URL
- Expected: App loads, no fatal error UI, essential assets load

### SMK-002 Login with Valid Credentials
- Requirement ID: `REQ-002`
- Type: Positive
- Preconditions: Seeded valid user
- Steps: Sign in with known valid credentials
- Expected: User lands on authenticated home/dashboard

### SMK-003 Login with Invalid Credentials
- Requirement ID: `REQ-002`
- Type: Negative
- Preconditions: None
- Steps: Sign in with wrong password
- Expected: Friendly error shown, no login session created

### SMK-004 Session Persistence on Refresh
- Requirement ID: `REQ-003`
- Type: Boundary
- Preconditions: Logged-in user
- Steps: Refresh browser and navigate to protected page
- Expected: Session persists or refreshes correctly; no auth loop

### SMK-005 Create Core Entity (Happy Path)
- Requirement ID: `REQ-004`
- Type: Positive
- Preconditions: Logged in
- Steps: Submit valid creation form
- Expected: Record created and visible in UI

### SMK-006 Create Core Entity with Missing Required Field
- Requirement ID: `REQ-004`
- Type: Negative
- Preconditions: Logged in
- Steps: Submit form with required field empty
- Expected: Inline validation error; no record created

### SMK-007 Read Newly Created Entity
- Requirement ID: `REQ-005`
- Type: Positive
- Preconditions: Existing seeded or newly created entity
- Steps: Open entity detail page
- Expected: Correct details are displayed

### SMK-008 Basic Update Flow
- Requirement ID: `REQ-006`
- Type: Positive
- Preconditions: Existing entity
- Steps: Update editable field and save
- Expected: Update persists after page reload

### SMK-009 Unauthorized Access Block
- Requirement ID: `REQ-007`
- Type: Negative
- Preconditions: Logged out
- Steps: Access protected route directly
- Expected: Redirect to login or access denied

### SMK-010 Supabase Connectivity Failure Handling
- Requirement ID: `REQ-008`
- Type: Negative
- Preconditions: Simulated API/network failure
- Steps: Trigger data fetch
- Expected: User sees non-crashing fallback error state

### SMK-011 Mobile Viewport Critical Screen Render
- Requirement ID: `REQ-009`
- Type: Boundary
- Preconditions: None
- Steps: Open main screen at 360x640 viewport
- Expected: No layout break/overlap; actions accessible

### SMK-012 Globalization Baseline (English + UTF-8)
- Requirement ID: `REQ-010`
- Type: Globalization
- Preconditions: Seed includes UTF-8 sample values
- Steps: Open list/detail screens with UTF-8 data
- Expected: Text renders correctly; no encoding artifacts

## Execution Cadence
- Every PR preview sanity check (subset: SMK-001..SMK-006)
- Full smoke before manual production deployment
