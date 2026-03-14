# Blueprint Execution Tracker

Baseline date: **March 14, 2026**  
Scope: close major gaps from `docs/BLUEPRINT_COMPLIANCE_MATRIX.md` and move toward full blueprint coverage.

## Planning Assumptions
- Team: 2 full-stack engineers, 1 frontend engineer, 1 QA engineer (part-time), 1 product owner.
- Cadence: 2-week sprints.
- Estimates are engineering effort (person-days), excluding approval lag.

## Skill/Role Requirements
- Next.js + TypeScript + Supabase RLS
- Realtime architecture (Supabase Realtime/WebSocket)
- PDF rendering/annotation UX
- Storage integration (Supabase Storage + provider SDKs)
- QA automation (Vitest + Playwright)

## Phase Plan (8 Weeks)
| Phase | Dates | Goal | Exit Criteria | Est. Effort |
|---|---|---|---|---|
| Phase 1 | Mar 16, 2026 - Mar 27, 2026 | File pipeline + PDF viewer base | Upload/import works; PDF document open/edit scaffold live | 18 pd |
| Phase 2 | Mar 30, 2026 - Apr 10, 2026 | Annotation MVP | Highlight, text, draw tools persisted and reloadable | 22 pd |
| Phase 3 | Apr 13, 2026 - Apr 24, 2026 | Realtime + comments | Multi-user live sync, comment threads, mention notifications | 24 pd |
| Phase 4 | Apr 27, 2026 - May 08, 2026 | Classroom + assignment + export/search | Classroom/assignment flows usable; export and API search available | 26 pd |

## Epic Backlog With Targets
| Epic | Priority | Owner | Effort | Target Date | Dependencies | Status |
|---|---|---|---|---|---|---|
| E1: File Upload & Storage | P0 | Full-stack | 8 pd | Mar 21, 2026 | None | Done |
| E2: PDF Render + Document Import | P0 | Frontend | 10 pd | Mar 27, 2026 | E1 | In Progress (import + preview base done) |
| E3: Annotation Data Model + APIs | P0 | Full-stack | 10 pd | Apr 03, 2026 | E2 | In Progress (base CRUD delivered) |
| E4: Annotation Tooling UI | P0 | Frontend | 12 pd | Apr 10, 2026 | E3 | In Progress (selection + quick actions base delivered) |
| E5: Realtime Collaboration | P0 | Full-stack | 14 pd | Apr 17, 2026 | E3 | In Progress (live refresh baseline delivered) |
| E6: Comment Threads + Mentions | P0 | Full-stack | 10 pd | Apr 24, 2026 | E5 | In Progress (threaded + mentions base delivered) |
| E7: Classroom Management | P1 | Full-stack | 10 pd | May 01, 2026 | Auth/Profile stable | In Progress (API foundation delivered) |
| E8: Assignment Distribution | P1 | Full-stack | 8 pd | May 05, 2026 | E7 | In Progress (API foundation delivered) |
| E9: Export/Print + Search API | P1 | Full-stack | 8 pd | May 08, 2026 | E3 | In Progress |
| E10: Validation Hardening + QA Pack | P0 | QA + Full-stack | 10 pd | May 08, 2026 | E1-E9 | Planned |

## Validation & Quality Gates
- API validation: strict `zod` schemas for all new endpoints (positive/negative/boundary coverage).
- Security: owner/role checks + RLS tests for every new table and mutation.
- Test gates per sprint: `lint`, `typecheck`, `unit/integration`, selective e2e smoke.
- Regression check: auth-gated routing and existing documents/profile/notifications must remain green.

## Milestone Deliverables
1. **Mar 27, 2026:** Upload/import + PDF view foundation demo.
2. **Apr 10, 2026:** Annotation MVP demo (save/load/export snapshot).
3. **Apr 24, 2026:** Live collaboration + comments demo.
4. **May 08, 2026:** Classroom/assignment/export/search + QA signoff package.

## Tracking Rules
- Update epic `Status` daily (`Planned`, `In Progress`, `Blocked`, `Done`).
- Every completed epic must include: code links, migration notes, and test evidence.
- Blockers older than 2 business days must be escalated with mitigation options.
