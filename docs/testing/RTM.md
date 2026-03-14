# Requirements Traceability Matrix (RTM)

## Purpose
Provide end-to-end mapping from MVP requirements to test coverage across smoke, regression, and integration categories.

## Coverage Policy
- Every requirement must map to at least one test case in at least one category.
- High-risk requirements must map across all three categories.
- Each requirement should have positive, negative, and boundary coverage.
- User-facing requirements should include globalization coverage checks.

## Matrix

| Requirement ID | Requirement Description | Risk | Smoke Cases | Regression Cases | Integration Cases | Positive | Negative | Boundary | Globalization | Owner | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | App boot and base availability | High | SMK-001 | RGN-008 | INT-007 | Yes | Yes | Yes | N/A | QA | Planned |
| REQ-002 | User authentication (login/logout) | High | SMK-002, SMK-003 | RGN-001 | INT-003 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-003 | Session lifecycle and protected routing | High | SMK-004, SMK-009 | RGN-001, RGN-005 | INT-003 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-004 | Create core entity | High | SMK-005, SMK-006 | RGN-003 | INT-002 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-005 | Read core entity | High | SMK-007 | RGN-003 | INT-002 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-006 | Update core entity | High | SMK-008 | RGN-003 | INT-002 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-007 | Authorization and RLS enforcement | Critical | SMK-009 | RGN-005 | INT-004 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-008 | Error handling for backend/network failures | High | SMK-010 | RGN-006 | INT-006 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-009 | Responsive UI behavior | Medium | SMK-011 | RGN-008 | INT-007 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-010 | UTF-8 and base globalization rendering | Medium | SMK-012 | RGN-001, RGN-003 | INT-001, INT-002 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-011 | Profile/settings management | Medium | N/A | RGN-002 | INT-001 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-012 | Search/filter/sort behavior | Medium | N/A | RGN-004 | INT-001 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-013 | Accessibility baseline | High | N/A | RGN-007 | INT-007 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-014 | Frontend/backend API contract consistency | High | N/A | RGN-006 | INT-001 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-015 | API/DB data consistency | High | N/A | RGN-003 | INT-002 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-016 | Migration compatibility with current app build | High | N/A | RGN-003 | INT-005 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-017 | Vercel environment consistency (preview/prod) | High | SMK-001 | RGN-008 | INT-007 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-018 | Signup/profile validation policy (8+ uppercase/lowercase/digit/special and normalized phone) | High | SMK-013 | RGN-001, RGN-002 | INT-001, INT-002 | Yes | Yes | Yes | Yes | QA | Planned |
| REQ-019 | Delete confirmation + toast feedback (success/error/warning) | High | SMK-014 | RGN-009 | INT-008 | Yes | Yes | Yes | Yes | QA | Planned |

## RTM Maintenance Rules
1. Update RTM whenever requirement scope, test cases, or risk changes.
2. Do not close a requirement until mapped test executions are complete and defects are triaged.
3. Keep requirement IDs stable across releases.
4. Link defect IDs to affected requirement rows during execution.

## Execution Tracking Fields (to fill per cycle)
- Test Cycle ID
- Build/Commit
- Environment (Preview/Staging)
- Seed Version
- Pass/Fail counts by category
- Blockers and waivers
