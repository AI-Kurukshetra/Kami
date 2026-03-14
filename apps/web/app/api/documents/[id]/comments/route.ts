import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, DocumentAccessRole, DocumentComment } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { appendDocumentActivity } from '@/lib/document-activity';
import { createUserNotification } from '@/lib/notifications';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.object({
  id: z.string().uuid()
});

const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  parentCommentId: z.string().uuid().optional().nullable(),
  mentionEmails: z.array(z.string().email()).max(10).optional().default([])
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

function mapComment(row: DbComment, authorEmail?: string): DocumentComment {
  return {
    id: row.id,
    documentId: row.document_id,
    authorUserId: row.author_user_id,
    authorEmail,
    parentCommentId: row.parent_comment_id,
    body: row.body,
    mentionUserIds: row.mention_user_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

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

async function findUserByEmail(supabase: ReturnType<typeof createSupabaseServerClient>, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error('user_lookup_failed');
    }

    const user = data.users.find((item) => item.email?.toLowerCase() === normalizedEmail);
    if (user) {
      return user;
    }
    if (data.users.length < perPage) {
      break;
    }
    page += 1;
  }

  return null;
}

async function getUserEmailById(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string) {
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
      .from('document_comments')
      .select('id,document_id,author_user_id,parent_comment_id,body,mention_user_ids,created_at,updated_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) {
      return errorResponse(500, 'comments_fetch_failed', 'Unable to fetch comments');
    }

    const items = await Promise.all(
      ((data ?? []) as DbComment[]).map(async (row) => {
        const authorEmail = await getUserEmailById(supabase, row.author_user_id);
        return mapComment(row, authorEmail);
      })
    );

    return NextResponse.json({ items, accessRole }, { status: 200 });
  } catch {
    return errorResponse(500, 'comments_fetch_failed', 'Unable to fetch comments');
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let documentId: string;
  let body: z.infer<typeof createCommentSchema>;
  try {
    const params = await context.params;
    documentId = idSchema.parse(params).id;
    body = createCommentSchema.parse(await request.json());
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
  const mentionUserIds: string[] = [];
  for (const email of body.mentionEmails) {
    const user = await findUserByEmail(supabase, email).catch(() => null);
    if (user?.id && user.id !== userId && !mentionUserIds.includes(user.id)) {
      mentionUserIds.push(user.id);
    }
  }

  const { data, error } = await supabase
    .from('document_comments')
    .insert({
      document_id: documentId,
      author_user_id: userId,
      parent_comment_id: body.parentCommentId ?? null,
      body: body.body,
      mention_user_ids: mentionUserIds
    })
    .select('id,document_id,author_user_id,parent_comment_id,body,mention_user_ids,created_at,updated_at')
    .single();

  if (error) {
    return errorResponse(500, 'comment_create_failed', 'Unable to create comment');
  }

  const created = data as DbComment;

  for (const mentionedUserId of mentionUserIds) {
    await createUserNotification({
      userId: mentionedUserId,
      type: 'comment_mentioned',
      title: 'You were mentioned in a comment',
      body: created.body.slice(0, 140),
      metadata: {
        documentId,
        commentId: created.id
      },
      supabase
    }).catch(() => undefined);
  }

  if (created.parent_comment_id) {
    const parent = await supabase
      .from('document_comments')
      .select('author_user_id')
      .eq('id', created.parent_comment_id)
      .single();

    const parentAuthorId = parent.data?.author_user_id as string | undefined;
    if (parentAuthorId && parentAuthorId !== userId) {
      await createUserNotification({
        userId: parentAuthorId,
        type: 'comment_reply',
        title: 'Someone replied to your comment',
        body: created.body.slice(0, 140),
        metadata: {
          documentId,
          commentId: created.id,
          parentCommentId: created.parent_comment_id
        },
        supabase
      }).catch(() => undefined);
    }
  }

  await appendDocumentActivity({
    documentId,
    actorUserId: userId,
    action: 'updated',
    metadata: {
      source: 'comment_create',
      commentId: created.id
    },
    supabase
  }).catch(() => undefined);

  const authorEmail = await getUserEmailById(supabase, created.author_user_id);
  return NextResponse.json(mapComment(created, authorEmail), { status: 201 });
}
