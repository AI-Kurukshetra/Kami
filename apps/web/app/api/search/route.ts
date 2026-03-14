import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, Document, DocumentAccessRole, DocumentStatus } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const querySchema = z.object({
  q: z.string().trim().min(2).max(100)
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

function errorResponse(status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  return NextResponse.json(error, { status });
}

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

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let q: string;
  try {
    const parsed = querySchema.parse({
      q: request.nextUrl.searchParams.get('q') ?? ''
    });
    q = parsed.q.toLowerCase();
  } catch {
    return errorResponse(400, 'invalid_query', 'Search query must be between 2 and 100 characters');
  }

  const supabase = createSupabaseServerClient();

  const [ownedResponse, sharedLinksResponse] = await Promise.all([
    supabase
      .from('documents')
      .select('id,owner_id,title,content,status,created_at,updated_at')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase.from('document_collaborators').select('document_id,role').eq('user_id', userId)
  ]);

  if (ownedResponse.error || sharedLinksResponse.error) {
    return errorResponse(500, 'search_failed', 'Unable to perform search');
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
      return errorResponse(500, 'search_failed', 'Unable to perform search');
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
      mergedMap.set(row.id, mapDocument(row, sharedRoleByDocumentId.get(row.id) ?? 'viewer'));
    }
  }

  const items = [...mergedMap.values()]
    .filter((item) => {
      const title = item.title.toLowerCase();
      const content = item.content.toLowerCase();
      return title.includes(q) || content.includes(q);
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 50);

  return NextResponse.json({ items, query: q }, { status: 200 });
}
