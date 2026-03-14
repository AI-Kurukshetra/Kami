export type HealthStatus = 'ok' | 'degraded' | 'down';

export type HealthCheck = {
  service: string;
  status: HealthStatus;
  timestampIso: string;
  warnings?: string[];
};

export type Profile = {
  id: string;
  email: string;
  displayName?: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  createdAt: string;
};

export type CreateProfileInput = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
};

export type UpdateProfileInput = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
};

export type DocumentStatus = 'draft' | 'published';
export type DocumentAccessRole = 'owner' | 'editor' | 'viewer';

export type Document = {
  id: string;
  title: string;
  content: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  accessRole?: DocumentAccessRole;
};

export type CreateDocumentInput = {
  title: string;
  content: string;
  status: DocumentStatus;
};

export type UpdateDocumentInput = {
  title: string;
  content: string;
  status: DocumentStatus;
};

export type DocumentShare = {
  documentId: string;
  userId: string;
  email?: string;
  role: 'editor' | 'viewer';
  createdAt: string;
};

export type DocumentActivityAction = 'created' | 'updated' | 'deleted' | 'shared' | 'unshared';

export type DocumentActivity = {
  id: string;
  documentId: string;
  actorUserId: string;
  actorEmail?: string;
  action: DocumentActivityAction;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type DocumentFile = {
  id: string;
  documentId: string;
  uploaderUserId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  signedUrl?: string;
};

export type DocumentAnnotationType = 'highlight' | 'note' | 'text' | 'drawing';

export type DocumentAnnotation = {
  id: string;
  documentId: string;
  authorUserId: string;
  type: DocumentAnnotationType;
  content?: string;
  color: string;
  anchor: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type DocumentComment = {
  id: string;
  documentId: string;
  authorUserId: string;
  authorEmail?: string;
  parentCommentId?: string | null;
  body: string;
  mentionUserIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type NotificationType =
  | 'document_shared'
  | 'document_unshared'
  | 'document_updated'
  | 'assignment_assigned'
  | 'comment_mentioned'
  | 'comment_reply';

export type UserNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
};

export type ApiError = {
  code: string;
  message: string;
};

export type Classroom = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type ClassroomRole = 'teacher' | 'student';

export type AssignmentStatus = 'draft' | 'published' | 'closed';

export type Assignment = {
  id: string;
  classroomId: string;
  createdByUserId: string;
  title: string;
  description: string;
  status: AssignmentStatus;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntegrationProvider =
  | 'google_drive'
  | 'dropbox'
  | 'onedrive'
  | 'canvas'
  | 'google_classroom';

export type IntegrationStatus = 'disconnected' | 'connected';

export type IntegrationSetting = {
  id: string;
  ownerId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
