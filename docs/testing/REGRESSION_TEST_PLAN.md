# Regression Test Plan (MVP)

## Objective
Ensure existing functionality remains stable after feature additions, refactors, bug fixes, and migration updates.

## Scope
- End-user functional behavior across all completed MVP features
- Validation, permissions, error handling, and UX consistency
- Key non-functional checks (responsive behavior, accessibility baseline)

## Entry Criteria
- Feature complete for release candidate
- Migrations committed and applied
- Non-production DB reseeded

## Exit Criteria
- All planned P0/P1 regression cases pass
- Known issues are triaged with explicit release decision

## Test Design Rules
For each requirement include:
- Positive scenario
- Negative scenario
- Boundary scenario
- Globalization scenario where user-facing text/data exists

## Regression Test Cases

### RGN-001 Signup/Login/Logout Lifecycle
- Requirement ID: `REQ-002`
- Positive: valid signup/login/logout sequence works
- Negative: invalid credentials show controlled error
- Boundary: max-length email/password accepted/rejected as designed
- Globalization: UTF-8 display name accepted and rendered

### RGN-002 Profile/Edit Settings
- Requirement ID: `REQ-011`
- Positive: profile updates persist
- Negative: invalid input blocked with field-level messages
- Boundary: min/max text lengths for profile fields
- Globalization: locale-formatted date fields remain readable

### RGN-003 Entity CRUD Full Cycle
- Requirement ID: `REQ-004`, `REQ-005`, `REQ-006`
- Positive: create, read, update, delete with authorized user
- Negative: invalid payload and unauthorized update/delete rejected
- Boundary: long text, empty optional fields, max attachment size/type rules
- Globalization: multilingual content remains intact after edit/save

### RGN-004 Search/Filter/Sort
- Requirement ID: `REQ-012`
- Positive: relevant results and sorting correctness
- Negative: malformed query handled without crash
- Boundary: zero results, max dataset page, extreme filter combinations
- Globalization: case-insensitive matching behavior with UTF-8 samples

### RGN-005 Role and Permission Controls
- Requirement ID: `REQ-007`
- Positive: authorized actions available to correct role
- Negative: restricted action denied and logged
- Boundary: role transition in active session updates permissions correctly
- Globalization: role labels/messages remain clear in localized text containers

### RGN-006 API Error Handling UX
- Requirement ID: `REQ-008`
- Positive: recoverable error prompts retry path
- Negative: 4xx/5xx responses never expose sensitive internals
- Boundary: timeout and retry-limit behavior
- Globalization: user-facing error copy handles variable text lengths

### RGN-007 Accessibility Baseline
- Requirement ID: `REQ-013`
- Positive: keyboard-only navigation reaches primary actions
- Negative: blocked focus states flagged as defects
- Boundary: zoom 200% and narrow viewport usability
- Globalization: longer strings do not hide focusable controls

### RGN-008 Responsive Layout Stability
- Requirement ID: `REQ-009`
- Positive: desktop/tablet/mobile layouts remain usable
- Negative: no clipped actions on small screens
- Boundary: 320px width and ultra-wide desktop
- Globalization: text expansion does not break critical CTAs

### RGN-009 Destructive Action Safeguards + Toast UX
- Requirement ID: `REQ-019`
- Positive: delete confirmation shown before destructive action, success toast shown after deletion
- Negative: cancel path keeps record and shows warning toast; failed delete shows error toast
- Boundary: repeated rapid delete attempts do not bypass confirmation flow
- Globalization: toast/error strings remain readable with long/UTF-8 content

## Execution Cadence
- Full run for release candidates
- Targeted regression for hotfixes (mapped by impacted requirements)

## Defect Severity Guidance
- Critical: data loss, auth bypass, crash in core flow
- High: major feature blocked, incorrect persisted data
- Medium: partial workflow degradation
- Low: cosmetic/non-blocking behavior
