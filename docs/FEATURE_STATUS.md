# MVP Feature Status

## Completed (Web MVP)
- Supabase Auth sign in/sign up/session handling
- Profiles settings with ownership checks (`firstName`, `lastName`, `email`, `phoneNumber`)
- Password change from authenticated profile security section
- Documents CRUD with ownership checks
- Role-based collaboration (`owner`, `editor`, `viewer`)
- Sharing by collaborator email
- Document activity timeline (create/update/share/unshare/delete)
- In-app notifications inbox for share/unshare events
- Responsive UI pages for profile, documents, workspace, notifications
- Migration + seed workflow for repeatable non-prod setup
- Vercel-ready environment/docs baseline
- External-share summary generated as PDF (`docs/Kami_MVP_Early_Stage_Summary.pdf`)

## Deferred (Post-MVP / Lower Priority)
- React Native mobile implementation in `apps/mobile`
- Push/email notification channels
- Rich text editor and document version history
- Advanced analytics/reporting dashboards
