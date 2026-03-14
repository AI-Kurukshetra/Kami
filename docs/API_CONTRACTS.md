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

### `POST /api/documents/import`
- Auth: Yes
- Body: `multipart/form-data` with `file`, optional `status`
- Behavior: creates document + uploads source file
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

### `GET /api/documents/:id/export`
- Auth: Yes (owner/editor/viewer)
- Response `200`: text download (`.txt`) with document content

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

## Document Files
### `GET /api/documents/:id/files`
- Auth: Yes (owner/editor/viewer)
- Response `200`: `{ items: DocumentFile[], accessRole }`

### `POST /api/documents/:id/files`
- Auth: Yes (owner/editor)
- Body: `multipart/form-data` with `file`
- File limits: max `10 MB`, supported mime types include PDF/Word/PowerPoint/images/text
- Response `201`: `DocumentFile`

## Document Annotations
### `GET /api/documents/:id/annotations`
- Auth: Yes (owner/editor/viewer)
- Response `200`: `{ items: DocumentAnnotation[], accessRole }`

### `POST /api/documents/:id/annotations`
- Auth: Yes (owner/editor)
- Body: `{ type, content?, color?, anchor? }`
- Response `201`: `DocumentAnnotation`

### `PATCH /api/documents/:id/annotations/:annotationId`
- Auth: Yes (owner/editor)
- Body: partial `{ type?, content?, color?, anchor? }`
- Response `200`: `DocumentAnnotation`

### `DELETE /api/documents/:id/annotations/:annotationId`
- Auth: Yes (owner/editor)
- Response `200`: `{ success: true, id }`

## Document Comments
### `GET /api/documents/:id/comments`
- Auth: Yes (owner/editor/viewer)
- Response `200`: `{ items: DocumentComment[], accessRole }`

### `POST /api/documents/:id/comments`
- Auth: Yes (owner/editor/viewer)
- Body: `{ body, parentCommentId?, mentionEmails? }`
- Response `201`: `DocumentComment`

### `PATCH /api/documents/:id/comments/:commentId`
- Auth: Yes (author or owner/editor)
- Body: `{ body }`
- Response `200`: `DocumentComment`

### `DELETE /api/documents/:id/comments/:commentId`
- Auth: Yes (author or owner/editor)
- Response `200`: `{ success: true, id }`

## Notifications
### `GET /api/notifications`
- Auth: Yes
- Response `200`: `{ items: UserNotification[], unreadCount }`
- Types: `document_shared`, `document_unshared`, `document_updated`, `assignment_assigned`

### `PATCH /api/notifications/:id/read`
- Auth: Yes (owner)
- Response `200`: `UserNotification`

### `POST /api/notifications/read-all`
- Auth: Yes
- Response `200`: `{ success: true }`

## Search
### `GET /api/search?q=<query>`
- Auth: Yes
- Query: `q` length `2..100`
- Response `200`: `{ items: Document[], query }`

## Classrooms
### `GET /api/classrooms`
- Auth: Yes
- Response `200`: `{ items: Classroom[] }`

### `POST /api/classrooms`
- Auth: Yes
- Body: `{ name, description }`
- Response `201`: `Classroom`

### `PATCH /api/classrooms/:id`
- Auth: Yes (owner)
- Body: `{ name, description }`
- Response `200`: `Classroom`

### `DELETE /api/classrooms/:id`
- Auth: Yes (owner)
- Response `200`: `{ success: true, id }`

## Assignments
### `GET /api/assignments`
- Auth: Yes
- Optional query: `classroomId`
- Response `200`: `{ items: Assignment[] }`

### `POST /api/assignments`
- Auth: Yes (classroom owner/teacher)
- Body: `{ classroomId, title, description, status, dueAt? }`
- Response `201`: `Assignment`

### `PATCH /api/assignments/:id`
- Auth: Yes (classroom owner/teacher)
- Body: partial `{ title?, description?, status?, dueAt? }`
- Response `200`: `Assignment`

### `DELETE /api/assignments/:id`
- Auth: Yes (classroom owner/teacher)
- Response `200`: `{ success: true, id }`

## Integrations
### `GET /api/integrations`
- Auth: Yes
- Response `200`: `{ items: IntegrationSetting[] }`

### `POST /api/integrations`
- Auth: Yes
- Body: `{ provider, status, config }`
- Response `200`: `IntegrationSetting`
