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

const idSchema = z.object({
  id: z.string().uuid()
});

const createAnnotationSchema = z.object({
  type: z.enum(['highlight', 'note', 'text', 'drawing']),
  content: z.string().max(5000).optional().default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffe58f'),
  anchor: z.record(z.string(), z.unknown()).default({})
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
      .from('document_annotations')
      .select('id,document_id,author_user_id,type,content,color,anchor,created_at,updated_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return errorResponse(500, 'annotations_fetch_failed', 'Unable to fetch annotations');
    }

    return NextResponse.json(
      {
        items: ((data ?? []) as DbAnnotation[]).map(mapAnnotation),
        accessRole
      },
      { status: 200 }
    );
  } catch {
    return errorResponse(500, 'annotations_fetch_failed', 'Unable to fetch annotations');
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let documentId: string;
  let body: z.infer<typeof createAnnotationSchema>;
  try {
    const params = await context.params;
    documentId = idSchema.parse(params).id;
    body = createAnnotationSchema.parse(await request.json());
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
    return errorResponse(403, 'forbidden', 'You do not have permission to add annotations');
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('document_annotations')
    .insert({
      document_id: documentId,
      author_user_id: userId,
      type: body.type,
      content: body.content,
      color: body.color,
      anchor: body.anchor
    })
    .select('id,document_id,author_user_id,type,content,color,anchor,created_at,updated_at')
    .single();

  if (error) {
    return errorResponse(500, 'annotation_create_failed', 'Unable to create annotation');
  }

  await appendDocumentActivity({
    documentId,
    actorUserId: userId,
    action: 'updated',
    metadata: {
      source: 'annotation_create',
      annotationType: body.type
    },
    supabase
  }).catch(() => undefined);

  return NextResponse.json(mapAnnotation(data as DbAnnotation), { status: 201 });
}
