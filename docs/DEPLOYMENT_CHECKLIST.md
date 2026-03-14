# Deployment Checklist (MVP)

## 1) Pre-Deploy (Required)
- [ ] Feature scope approved and PR merged
- [ ] Migrations reviewed and rollback approach documented
- [ ] Non-production DB reset + seed verified
- [ ] RTM and affected test docs updated

## 2) Quality Gate (Required)
Run:
```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
- [ ] All commands pass
- [ ] No critical/high unresolved defects

## 3) Preview Validation (Required)
- [ ] Open Vercel preview URL from latest commit
- [ ] Run smoke checks (auth, core create/read/update, error states)
- [ ] Validate mobile + desktop responsive behavior
- [ ] Validate keyboard navigation and focus visibility
- [ ] Confirm env variables resolved in preview

## 4) Production Deployment (Manual)
```bash
vercel deploy --prod
```
- [ ] Triggered by authorized maintainer only
- [ ] Release notes attached

## 5) Post-Deploy Verification
- [ ] Run production smoke tests
- [ ] Verify API health (`/api/health`)
- [ ] Verify auth login and signout
- [ ] Verify core data flow against production-safe records
- [ ] Confirm monitoring/logs show no critical errors

## 6) Rollback Rules
- Roll back immediately for auth failures, data corruption risk, or severe outage.
- Use previous known-good deployment and execute incident notes.
