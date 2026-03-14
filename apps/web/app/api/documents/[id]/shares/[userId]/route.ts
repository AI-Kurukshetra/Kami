import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { appendDocumentActivity } from '@/lib/document-activity';
import { createUserNotification } from '@/lib/notifications';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const paramsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid()
});

type DbDocument = {
  owner_id: string;
};

function errorResponse(status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  return NextResponse.json(error, { status });
}

async function ensureOwnerOrThrow(userId: string, documentId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('documents')
    .select('owner_id')
    .eq('id', documentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return errorResponse(404, 'document_not_found', 'Document not found');
    }

    return errorResponse(500, 'document_fetch_failed', 'Unable to fetch document');
  }

  const document = data as DbDocument;

  if (document.owner_id !== userId) {
    return errorResponse(403, 'forbidden', 'Only document owners can manage collaborators');
  }

  return null;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  const requesterUserId = await getRequestUserId(request);

  if (!requesterUserId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let documentId: string;
  let collaboratorUserId: string;

  try {
    const params = await context.params;
    const parsed = paramsSchema.parse(params);
    documentId = parsed.id;
    collaboratorUserId = parsed.userId;
  } catch {
    return errorResponse(400, 'invalid_path', 'Invalid route parameters');
  }

  const ownerError = await ensureOwnerOrThrow(requesterUserId, documentId);
  if (ownerError) {
    return ownerError;
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('document_collaborators')
    .delete()
    .eq('document_id', documentId)
    .eq('user_id', collaboratorUserId)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return errorResponse(404, 'share_not_found', 'Collaborator entry not found');
    }

    return errorResponse(500, 'share_delete_failed', 'Unable to remove collaborator');
  }

  await appendDocumentActivity({
    documentId,
    actorUserId: requesterUserId,
    action: 'unshared',
    metadata: {
      collaboratorUserId
    },
    supabase
  }).catch(() => undefined);

  await createUserNotification({
    userId: collaboratorUserId,
    type: 'document_unshared',
    title: 'Document access removed',
    body: 'Your collaborator access was removed from a document.',
    metadata: {
      documentId
    },
    supabase
  }).catch(() => undefined);

  return NextResponse.json({ success: true, id: data.id }, { status: 200 });
}
