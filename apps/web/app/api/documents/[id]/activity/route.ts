import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, DocumentAccessRole, DocumentActivity } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.object({
  id: z.string().uuid()
});

type DbDocument = {
  id: string;
  owner_id: string;
};

type DbCollaborator = {
  role: 'editor' | 'viewer';
};

type DbActivity = {
  id: string;
  document_id: string;
  actor_user_id: string;
  action: 'created' | 'updated' | 'deleted' | 'shared' | 'unshared';
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function errorResponse(status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  return NextResponse.json(error, { status });
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

async function getActorEmail(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    return undefined;
  }

  return data.user?.email ?? undefined;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(request);

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
    const accessRole = await getDocumentAccessRole(userId, documentId);

    if (!accessRole) {
      return errorResponse(404, 'document_not_found', 'Document not found');
    }

    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from('document_activity')
      .select('id,document_id,actor_user_id,action,metadata,created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return errorResponse(500, 'activity_fetch_failed', 'Unable to fetch document activity');
    }

    const items = await Promise.all(
      ((data ?? []) as DbActivity[]).map(async (row): Promise<DocumentActivity> => {
        const actorEmail = await getActorEmail(supabase, row.actor_user_id);

        return {
          id: row.id,
          documentId: row.document_id,
          actorUserId: row.actor_user_id,
          actorEmail,
          action: row.action,
          metadata: row.metadata ?? {},
          createdAt: row.created_at
        };
      })
    );

    return NextResponse.json({ items, accessRole }, { status: 200 });
  } catch {
    return errorResponse(500, 'activity_fetch_failed', 'Unable to fetch document activity');
  }
}
