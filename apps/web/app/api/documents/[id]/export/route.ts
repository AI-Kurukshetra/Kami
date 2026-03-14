import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, DocumentAccessRole, DocumentStatus } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.object({
  id: z.string().uuid()
});

type DbDocument = {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  status: DocumentStatus;
};

type DbCollaborator = {
  role: 'editor' | 'viewer';
};

function errorResponse(status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  return NextResponse.json(error, { status });
}

function safeFileName(input: string) {
  return input.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'document';
}

async function getDocumentAndRole(
  userId: string,
  documentId: string
): Promise<{ document: DbDocument; accessRole: DocumentAccessRole } | null> {
  const supabase = createSupabaseServerClient();

  const documentResponse = await supabase
    .from('documents')
    .select('id,owner_id,title,content,status')
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
    return { document, accessRole: 'owner' };
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

  return {
    document,
    accessRole: (collaboratorResponse.data as DbCollaborator).role
  };
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
    const result = await getDocumentAndRole(userId, documentId);
    if (!result) {
      return errorResponse(404, 'document_not_found', 'Document not found');
    }

    const body = [
      `Title: ${result.document.title}`,
      `Status: ${result.document.status}`,
      `Access Role: ${result.accessRole}`,
      '',
      result.document.content
    ].join('\n');

    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': `attachment; filename=\"${safeFileName(result.document.title)}.txt\"`
      }
    });
  } catch {
    return errorResponse(500, 'document_export_failed', 'Unable to export document');
  }
}
