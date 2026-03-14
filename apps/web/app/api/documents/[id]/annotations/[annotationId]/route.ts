import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type {
  ApiError,
  DocumentAccessRole,
  DocumentAnnotation,
  DocumentAnnotationType
} from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { appendDocumentActivity } from '@/lib/document-activity';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const paramsSchema = z.object({
  id: z.string().uuid(),
  annotationId: z.string().uuid()
});

const updateAnnotationSchema = z.object({
  type: z.enum(['highlight', 'note', 'text', 'drawing']).optional(),
  content: z.string().max(5000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  anchor: z.record(z.string(), z.unknown()).optional()
});

type DbDocument = {
  id: string;
  owner_id: string;
};

type DbCollaborator = {
  role: 'editor' | 'viewer';
};

type DbAnnotation = {
  id: string;
  document_id: string;
  author_user_id: string;
  type: DocumentAnnotationType;
  content: string | null;
  color: string;
  anchor: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function errorResponse(status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  return NextResponse.json(error, { status });
}

function mapAnnotation(row: DbAnnotation): DocumentAnnotation {
  return {
    id: row.id,
    documentId: row.document_id,
    authorUserId: row.author_user_id,
    type: row.type,
    content: row.content ?? '',
    color: row.color,
    anchor: row.anchor ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getDocumentAccessRole(
  userId: string,
  documentId: string
): Promise<DocumentAccessRole | null> {
  const supabase = createSupabaseServerClient();

  const documentResponse = await supabase
    .from('documents')
    .select('id,owner_id')
    .eq('id', documentId)
    .single();

  if (documentResponse.error) {
    if (documentResponse.error.code === 'PGRST116') {
      return null;
    }

    throw new Error('document_fetch_failed');
  }

  const document = documentResponse.data as DbDocument;
  if (document.owner_id === userId) {
    return 'owner';
  }

  const collaboratorResponse = await supabase
    .from('document_collaborators')
    .select('role')
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .single();

  if (collaboratorResponse.error) {
    if (collaboratorResponse.error.code === 'PGRST116') {
      return null;
    }

    throw new Error('document_access_fetch_failed');
  }

  return (collaboratorResponse.data as DbCollaborator).role;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; annotationId: string }> }
) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let documentId: string;
  let annotationId: string;
  let body: z.infer<typeof updateAnnotationSchema>;
  try {
    const params = await context.params;
    const parsed = paramsSchema.parse(params);
    documentId = parsed.id;
    annotationId = parsed.annotationId;
    body = updateAnnotationSchema.parse(await request.json());
  } catch {
    return errorResponse(400, 'invalid_payload', 'Invalid request payload');
  }

  let accessRole: DocumentAccessRole | null;
  try {
    accessRole = await getDocumentAccessRole(userId, documentId);
  } catch {
    return errorResponse(500, 'document_fetch_failed', 'Unable to fetch document');
  }

  if (!accessRole) {
    return errorResponse(404, 'document_not_found', 'Document not found');
  }

  if (accessRole === 'viewer') {
    return errorResponse(403, 'forbidden', 'You do not have permission to edit annotations');
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('document_annotations')
    .update({
      ...(body.type ? { type: body.type } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.color ? { color: body.color } : {}),
      ...(body.anchor ? { anchor: body.anchor } : {})
    })
    .eq('id', annotationId)
    .eq('document_id', documentId)
    .select('id,document_id,author_user_id,type,content,color,anchor,created_at,updated_at')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return errorResponse(404, 'annotation_not_found', 'Annotation not found');
    }

    return errorResponse(500, 'annotation_update_failed', 'Unable to update annotation');
  }

  await appendDocumentActivity({
    documentId,
    actorUserId: userId,
    action: 'updated',
    metadata: {
      source: 'annotation_update',
      annotationId
    },
    supabase
  }).catch(() => undefined);

  return NextResponse.json(mapAnnotation(data as DbAnnotation), { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; annotationId: string }> }
) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let documentId: string;
  let annotationId: string;
  try {
    const params = await context.params;
    const parsed = paramsSchema.parse(params);
    documentId = parsed.id;
    annotationId = parsed.annotationId;
  } catch {
    return errorResponse(400, 'invalid_path', 'Invalid route parameters');
  }

  let accessRole: DocumentAccessRole | null;
  try {
    accessRole = await getDocumentAccessRole(userId, documentId);
  } catch {
    return errorResponse(500, 'document_fetch_failed', 'Unable to fetch document');
  }

  if (!accessRole) {
    return errorResponse(404, 'document_not_found', 'Document not found');
  }

  if (accessRole === 'viewer') {
    return errorResponse(403, 'forbidden', 'You do not have permission to delete annotations');
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('document_annotations')
    .delete()
    .eq('id', annotationId)
    .eq('document_id', documentId)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return errorResponse(404, 'annotation_not_found', 'Annotation not found');
    }

    return errorResponse(500, 'annotation_delete_failed', 'Unable to delete annotation');
  }

  await appendDocumentActivity({
    documentId,
    actorUserId: userId,
    action: 'updated',
    metadata: {
      source: 'annotation_delete',
      annotationId
    },
    supabase
  }).catch(() => undefined);

  return NextResponse.json({ success: true, id: data.id }, { status: 200 });
}
