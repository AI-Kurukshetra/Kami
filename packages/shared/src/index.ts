export type HealthStatus = 'ok' | 'degraded' | 'down';

export type HealthCheck = {
  service: string;
  status: HealthStatus;
  timestampIso: string;
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

export type NotificationType = 'document_shared' | 'document_unshared';

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
