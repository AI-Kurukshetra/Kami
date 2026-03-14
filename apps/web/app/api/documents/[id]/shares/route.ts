import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, DocumentShare } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { appendDocumentActivity } from '@/lib/document-activity';
import { createUserNotification } from '@/lib/notifications';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.object({
  id: z.string().uuid()
});

const createShareSchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  role: z.enum(['viewer', 'editor'])
}).refine((data) => Boolean(data.userId) !== Boolean(data.email), {
  message: 'Provide either userId or email',
  path: ['userId']
});

type DbDocument = {
  id: string;
  owner_id: string;
};

type DbDocumentShare = {
  document_id: string;
  user_id: string;
  email?: string;
  role: 'viewer' | 'editor';
  created_at: string;
};

function mapShare(row: DbDocumentShare): DocumentShare {
  return {
    documentId: row.document_id,
    userId: row.user_id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at
  };
}

function errorResponse(status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  return NextResponse.json(error, { status });
}

async function ensureOwnerOrThrow(userId: string, documentId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('documents')
    .select('id,owner_id')
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

async function findUserEmailById(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string
) {
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

  const ownerError = await ensureOwnerOrThrow(userId, documentId);
  if (ownerError) {
    return ownerError;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('document_collaborators')
    .select('document_id,user_id,role,created_at')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false });

  if (error) {
    return errorResponse(500, 'shares_fetch_failed', 'Unable to fetch collaborators');
  }

  const items = await Promise.all(
    ((data ?? []) as DbDocumentShare[]).map(async (row) => {
      const mapped = mapShare(row);
      mapped.email = await findUserEmailById(supabase, mapped.userId);
      return mapped;
    })
  );

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let documentId: string;
  let body: z.infer<typeof createShareSchema>;

  try {
    const params = await context.params;
    documentId = idSchema.parse(params).id;
    body = createShareSchema.parse(await request.json());
  } catch {
    return errorResponse(400, 'invalid_payload', 'Invalid request payload');
  }

  const ownerError = await ensureOwnerOrThrow(userId, documentId);
  if (ownerError) {
    return ownerError;
  }

  const supabase = createSupabaseServerClient();
  let collaboratorUserId = body.userId;
  let collaboratorEmail: string | undefined;

  if (body.email) {
    try {
      const matchedUser = await findUserByEmail(supabase, body.email);
      if (!matchedUser) {
        return errorResponse(404, 'user_not_found', 'No user exists for this email');
      }

      collaboratorUserId = matchedUser.id;
      collaboratorEmail = matchedUser.email ?? body.email;
    } catch {
      return errorResponse(500, 'user_lookup_failed', 'Unable to resolve collaborator email');
    }
  }

  if (!collaboratorUserId) {
    return errorResponse(400, 'invalid_collaborator', 'Collaborator user id is required');
  }

  if (collaboratorUserId === userId) {
    return errorResponse(400, 'invalid_collaborator', 'Owner already has full access');
  }

  const { data, error } = await supabase
    .from('document_collaborators')
    .upsert(
      {
        document_id: documentId,
        user_id: collaboratorUserId,
        role: body.role
      },
      {
        onConflict: 'document_id,user_id'
      }
    )
    .select('document_id,user_id,role,created_at')
    .single();

  if (error) {
    return errorResponse(500, 'share_upsert_failed', 'Unable to add collaborator');
  }

  const mapped = mapShare(data as DbDocumentShare);
  mapped.email = collaboratorEmail ?? (await findUserEmailById(supabase, mapped.userId));

  await appendDocumentActivity({
    documentId,
    actorUserId: userId,
    action: 'shared',
    metadata: {
      collaboratorUserId: mapped.userId,
      collaboratorEmail: mapped.email,
      role: mapped.role
    },
    supabase
  }).catch(() => undefined);

  await createUserNotification({
    userId: mapped.userId,
    type: 'document_shared',
    title: 'Document access granted',
    body: `You were granted ${mapped.role} access to a document.`,
    metadata: {
      documentId,
      collaboratorRole: mapped.role
    },
    supabase
  }).catch(() => undefined);

  return NextResponse.json(mapped, { status: 200 });
}
