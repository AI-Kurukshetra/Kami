# API Contracts (MVP)

All protected APIs require `Authorization: Bearer <supabase_access_token>`.
Error format is:
```json
{ "code": "string", "message": "string" }
```

## Health
### `GET /api/health`
- Auth: No
- Response `200`: `{ service, status, timestampIso }`

## Profiles
### `GET /api/profiles`
- Auth: Yes
- Response `200`: `{ items: Profile[] }`

### `POST /api/profiles`
- Auth: Yes
- Body: `{ firstName, lastName, email, phoneNumber }`
- Response `201`: `Profile`

### `PATCH /api/profiles/:id`
- Auth: Yes (owner)
- Body: `{ firstName, lastName, email, phoneNumber }`
- Response `200`: `Profile`

### `DELETE /api/profiles/:id`
- Auth: Yes (owner)
- Response `200`: `{ success: true, id }`

### Password update (client SDK)
- Route: profile security section uses Supabase browser SDK (not custom API route).
- Method: `supabase.auth.updateUser({ password: "<newPassword>" })`

## Documents
### `GET /api/documents`
- Auth: Yes
- Response `200`: `{ items: Document[] }` (`accessRole` included)

### `POST /api/documents`
- Auth: Yes
- Body: `{ title, content, status }`
- Response `201`: `Document`

### `GET /api/documents/:id`
- Auth: Yes (owner/editor/viewer)
- Response `200`: `Document`

### `PATCH /api/documents/:id`
- Auth: Yes (owner/editor)
- Body: `{ title, content, status }`
- Response `200`: `Document`

### `DELETE /api/documents/:id`
- Auth: Yes (owner)
- Response `200`: `{ success: true, id }`

## Document Sharing
### `GET /api/documents/:id/shares`
- Auth: Yes (owner)
- Response `200`: `{ items: DocumentShare[] }`

### `POST /api/documents/:id/shares`
- Auth: Yes (owner)
- Body: `{ role, email }` or `{ role, userId }` (exactly one identifier)
- Response `200`: `DocumentShare`

### `DELETE /api/documents/:id/shares/:userId`
- Auth: Yes (owner)
- Response `200`: `{ success: true, id }`

## Document Activity
### `GET /api/documents/:id/activity`
- Auth: Yes (owner/editor/viewer)
- Response `200`: `{ items: DocumentActivity[], accessRole }`

## Notifications
### `GET /api/notifications`
- Auth: Yes
- Response `200`: `{ items: UserNotification[], unreadCount }`

### `PATCH /api/notifications/:id/read`
- Auth: Yes (owner)
- Response `200`: `UserNotification`

### `POST /api/notifications/read-all`
- Auth: Yes
- Response `200`: `{ success: true }`
