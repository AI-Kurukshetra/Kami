import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type {
  ApiError,
  Document,
  DocumentAccessRole,
  DocumentStatus,
  UpdateDocumentInput
} from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { appendDocumentActivity } from '@/lib/document-activity';
import { createUserNotification } from '@/lib/notifications';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.object({
  id: z.string().uuid()
});

const documentStatusSchema = z.enum(['draft', 'published']);

const updateDocumentSchema = z.object({
  title: z.string().trim().min(2).max(120),
  content: z.string().trim().min(1).max(10_000),
  status: documentStatusSchema
});

type DbDocument = {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
};

type DbCollaborator = {
  user_id?: string;
  role: 'editor' | 'viewer';
};

function mapDocument(row: DbDocument, accessRole: DocumentAccessRole): Document {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accessRole
  };
}

function errorResponse(status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  return NextResponse.json(error, { status });
}

async function getDocumentAndRole(
  userId: string,
  documentId: string
): Promise<{ document: DbDocument; accessRole: DocumentAccessRole } | null> {
  const supabase = createSupabaseServerClient();

  const documentResponse = await supabase
    .from('documents')
    .select('id,owner_id,title,content,status,created_at,updated_at')
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
    return {
      document,
      accessRole: 'owner'
    };
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

  const collaborator = collaboratorResponse.data as DbCollaborator;

  return {
    document,
    accessRole: collaborator.role
  };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(_request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let documentId: string;

  try {
    const params = await context.params;
    documentId = idSchema.parse(params).id;
  } catch {
    return errorResponse(400, 'invalid_document_id', 'Invalid document id');
  }

  try {
    const result = await getDocumentAndRole(userId, documentId);
    if (!result) {
      return errorResponse(404, 'document_not_found', 'Document not found');
    }

    return NextResponse.json(mapDocument(result.document, result.accessRole), { status: 200 });
  } catch {
    return errorResponse(500, 'document_fetch_failed', 'Unable to fetch document');
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let documentId: string;
  let body: UpdateDocumentInput;

  try {
    const params = await context.params;
    documentId = idSchema.parse(params).id;
    body = updateDocumentSchema.parse(await request.json());
  } catch {
    return errorResponse(400, 'invalid_payload', 'Invalid request payload');
  }

  const supabase = createSupabaseServerClient();
  try {
    const result = await getDocumentAndRole(userId, documentId);
    if (!result) {
      return errorResponse(404, 'document_not_found', 'Document not found');
    }

    if (result.accessRole === 'viewer') {
      return errorResponse(403, 'forbidden', 'You do not have permission to edit this document');
    }

    const { data, error } = await supabase
      .from('documents')
      .update({
        title: body.title.trim(),
        content: body.content.trim(),
        status: body.status
      })
      .eq('id', documentId)
      .select('id,owner_id,title,content,status,created_at,updated_at')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse(404, 'document_not_found', 'Document not found');
      }

      return errorResponse(500, 'document_update_failed', 'Unable to update document');
    }

    await appendDocumentActivity({
      documentId,
      actorUserId: userId,
      action: 'updated',
      metadata: {
        status: body.status,
        accessRole: result.accessRole
      },
      supabase
    }).catch(() => undefined);

    const collaborators = await supabase
      .from('document_collaborators')
      .select('user_id')
      .eq('document_id', documentId);

    if (!collaborators.error) {
      for (const item of (collaborators.data ?? []) as DbCollaborator[]) {
        if (!item.user_id) {
          continue;
        }

        await createUserNotification({
          userId: item.user_id,
          type: 'document_updated',
          title: 'Document updated',
          body: `A shared document was updated: ${body.title.trim()}`,
          metadata: {
            documentId,
            status: body.status
          },
          supabase
        }).catch(() => undefined);
      }
    }

    return NextResponse.json(mapDocument(data as DbDocument, result.accessRole), { status: 200 });
  } catch {
    return errorResponse(500, 'document_update_failed', 'Unable to update document');
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(_request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let documentId: string;

  try {
    const params = await context.params;
    documentId = idSchema.parse(params).id;
  } catch {
    return errorResponse(400, 'invalid_document_id', 'Invalid document id');
  }

  const supabase = createSupabaseServerClient();
  try {
    const result = await getDocumentAndRole(userId, documentId);
    if (!result) {
      return errorResponse(404, 'document_not_found', 'Document not found');
    }

    if (result.accessRole !== 'owner') {
      return errorResponse(403, 'forbidden', 'Only document owners can delete documents');
    }

    await appendDocumentActivity({
      documentId,
      actorUserId: userId,
      action: 'deleted',
      metadata: {
        accessRole: result.accessRole
      },
      supabase
    }).catch(() => undefined);

    const { data, error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .select('id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse(404, 'document_not_found', 'Document not found');
      }

      return errorResponse(500, 'document_delete_failed', 'Unable to delete document');
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 200 });
  } catch {
    return errorResponse(500, 'document_delete_failed', 'Unable to delete document');
  }
}
