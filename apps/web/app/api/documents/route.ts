import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type {
  ApiError,
  CreateDocumentInput,
  Document,
  DocumentAccessRole,
  DocumentStatus
} from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { appendDocumentActivity } from '@/lib/document-activity';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const documentStatusSchema = z.enum(['draft', 'published']);

const createDocumentSchema = z.object({
  title: z.string().min(2).max(120),
  content: z.string().max(10_000),
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
  document_id: string;
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

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  const supabase = createSupabaseServerClient();

  const [ownedResponse, sharedLinksResponse] = await Promise.all([
    supabase
      .from('documents')
      .select('id,owner_id,title,content,status,created_at,updated_at')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase.from('document_collaborators').select('document_id,role').eq('user_id', userId)
  ]);

  if (ownedResponse.error || sharedLinksResponse.error) {
    return errorResponse(500, 'documents_fetch_failed', 'Unable to fetch documents');
  }

  const ownedRows = (ownedResponse.data ?? []) as DbDocument[];
  const sharedLinks = (sharedLinksResponse.data ?? []) as DbCollaborator[];

  let sharedRows: DbDocument[] = [];
  if (sharedLinks.length > 0) {
    const sharedIds = sharedLinks.map((row) => row.document_id);

    const sharedResponse = await supabase
      .from('documents')
      .select('id,owner_id,title,content,status,created_at,updated_at')
      .in('id', sharedIds)
      .order('updated_at', { ascending: false });

    if (sharedResponse.error) {
      return errorResponse(500, 'documents_fetch_failed', 'Unable to fetch documents');
    }

    sharedRows = (sharedResponse.data ?? []) as DbDocument[];
  }

  const sharedRoleByDocumentId = new Map(sharedLinks.map((row) => [row.document_id, row.role]));

  const mergedMap = new Map<string, Document>();

  for (const row of ownedRows) {
    mergedMap.set(row.id, mapDocument(row, 'owner'));
  }

  for (const row of sharedRows) {
    if (!mergedMap.has(row.id)) {
      const role = sharedRoleByDocumentId.get(row.id) ?? 'viewer';
      mergedMap.set(row.id, mapDocument(row, role));
    }
  }

  const items = [...mergedMap.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let body: CreateDocumentInput;

  try {
    body = createDocumentSchema.parse(await request.json());
  } catch {
    return errorResponse(400, 'invalid_payload', 'Invalid request payload');
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('documents')
    .insert({
      owner_id: userId,
      title: body.title,
      content: body.content,
      status: body.status
    })
    .select('id,owner_id,title,content,status,created_at,updated_at')
    .single();

  if (error) {
    return errorResponse(500, 'document_create_failed', 'Unable to create document');
  }

  await appendDocumentActivity({
    documentId: (data as DbDocument).id,
    actorUserId: userId,
    action: 'created',
    metadata: {
      status: (data as DbDocument).status
    },
    supabase
  }).catch(() => undefined);

  return NextResponse.json(mapDocument(data as DbDocument, 'owner'), { status: 201 });
}
