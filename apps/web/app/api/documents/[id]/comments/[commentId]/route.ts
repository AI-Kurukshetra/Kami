import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, DocumentAccessRole, DocumentComment } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { appendDocumentActivity } from '@/lib/document-activity';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const paramsSchema = z.object({
  id: z.string().uuid(),
  commentId: z.string().uuid()
});

const updateSchema = z.object({
  body: z.string().trim().min(1).max(2000)
});

type DbDocument = {
  id: string;
  owner_id: string;
};

type DbCollaborator = {
  role: 'editor' | 'viewer';
};

type DbComment = {
  id: string;
  document_id: string;
  author_user_id: string;
  parent_comment_id: string | null;
  body: string;
  mention_user_ids: string[] | null;
  created_at: string;
  updated_at: string;
};

function errorResponse(status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  return NextResponse.json(error, { status });
}

function mapComment(row: DbComment): DocumentComment {
  return {
    id: row.id,
    documentId: row.document_id,
    authorUserId: row.author_user_id,
    parentCommentId: row.parent_comment_id,
    body: row.body,
    mentionUserIds: row.mention_user_ids ?? [],
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
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let documentId: string;
  let commentId: string;
  let body: z.infer<typeof updateSchema>;
  try {
    const params = await context.params;
    const parsed = paramsSchema.parse(params);
    documentId = parsed.id;
    commentId = parsed.commentId;
    body = updateSchema.parse(await request.json());
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

  const supabase = createSupabaseServerClient();
  const existing = await supabase
    .from('document_comments')
    .select('id,author_user_id')
    .eq('id', commentId)
    .eq('document_id', documentId)
    .single();

  if (existing.error) {
    if (existing.error.code === 'PGRST116') {
      return errorResponse(404, 'comment_not_found', 'Comment not found');
    }
    return errorResponse(500, 'comment_update_failed', 'Unable to update comment');
  }

  const existingAuthorId = existing.data.author_user_id as string;
  const canModerate = accessRole === 'owner' || accessRole === 'editor';
  if (existingAuthorId !== userId && !canModerate) {
    return errorResponse(403, 'forbidden', 'You do not have permission to edit this comment');
  }

  const { data, error } = await supabase
    .from('document_comments')
    .update({
      body: body.body
    })
    .eq('id', commentId)
    .eq('document_id', documentId)
    .select('id,document_id,author_user_id,parent_comment_id,body,mention_user_ids,created_at,updated_at')
    .single();

  if (error) {
    return errorResponse(500, 'comment_update_failed', 'Unable to update comment');
  }

  await appendDocumentActivity({
    documentId,
    actorUserId: userId,
    action: 'updated',
    metadata: {
      source: 'comment_update',
      commentId
    },
    supabase
  }).catch(() => undefined);

  return NextResponse.json(mapComment(data as DbComment), { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let documentId: string;
  let commentId: string;
  try {
    const params = await context.params;
    const parsed = paramsSchema.parse(params);
    documentId = parsed.id;
    commentId = parsed.commentId;
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

  const supabase = createSupabaseServerClient();
  const existing = await supabase
    .from('document_comments')
    .select('id,author_user_id')
    .eq('id', commentId)
    .eq('document_id', documentId)
    .single();

  if (existing.error) {
    if (existing.error.code === 'PGRST116') {
      return errorResponse(404, 'comment_not_found', 'Comment not found');
    }
    return errorResponse(500, 'comment_delete_failed', 'Unable to delete comment');
  }

  const existingAuthorId = existing.data.author_user_id as string;
  const canModerate = accessRole === 'owner' || accessRole === 'editor';
  if (existingAuthorId !== userId && !canModerate) {
    return errorResponse(403, 'forbidden', 'You do not have permission to delete this comment');
  }

  const { data, error } = await supabase
    .from('document_comments')
    .delete()
    .eq('id', commentId)
    .eq('document_id', documentId)
    .select('id')
    .single();

  if (error) {
    return errorResponse(500, 'comment_delete_failed', 'Unable to delete comment');
  }

  await appendDocumentActivity({
    documentId,
    actorUserId: userId,
    action: 'updated',
    metadata: {
      source: 'comment_delete',
      commentId
    },
    supabase
  }).catch(() => undefined);

  return NextResponse.json({ success: true, id: data.id }, { status: 200 });
}
