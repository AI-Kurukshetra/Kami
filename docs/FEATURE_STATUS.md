# MVP Feature Status

## Completed (Web MVP)
- Supabase Auth sign in/sign up/session handling
- Signup flow expanded with `firstName`, `lastName`, `phoneNumber` and strong password validation
- Profiles settings with ownership checks (`firstName`, `lastName`, `email`, `phoneNumber`)
- Password change from authenticated profile security section
- Documents CRUD with ownership checks
- Role-based collaboration (`owner`, `editor`, `viewer`)
- Sharing by collaborator email
- Document activity timeline (create/update/share/unshare/delete)
- Document file upload/list foundation with signed access URLs
- Document import endpoint and UI flow (`/api/documents/import`)
- Inline PDF/image preview in document detail files section
- Document annotations model + API + detail-page management section
- Annotation tooling UX foundation (selection-based quick annotation + filters)
- Basic realtime collaboration updates (document/annotation/activity live refresh)
- Threaded comments with mentions and reply notifications
- Document text export endpoint (`/api/documents/:id/export`)
- Search API foundation (`/api/search`)
- Classroom and assignment API + page foundations (`/api/classrooms`, `/api/assignments`, `/classrooms`, `/assignments`)
- Integration settings API foundation (`/api/integrations`)
- Notification type coverage expanded (`document_updated`, `assignment_assigned`, `comment_mentioned`, `comment_reply`)
- In-app notifications inbox for share/unshare/update/assignment/comment events
- Delete-action confirmation flow across document modules with toast feedback (success/error/warning)
- Responsive UI pages for profile, documents, workspace, notifications
- Migration + seed workflow for repeatable non-prod setup
- Vercel-ready environment/docs baseline
- External-share summary generated as PDF (`docs/Kami_MVP_Early_Stage_Summary.pdf`)

## Deferred (Post-MVP / Lower Priority)
- React Native mobile implementation in `apps/mobile`
- Integrations UI page (`/integrations`) is temporarily hidden and redirects to `/workspace`
- Push/email notification channels
- Rich text editor and full CRDT presence/cursor collaboration
- Document version history
- Advanced analytics/reporting dashboards
