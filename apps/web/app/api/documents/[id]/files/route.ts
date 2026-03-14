import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, DocumentAccessRole, DocumentFile } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.object({
  id: z.string().uuid()
});

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const FILE_BUCKET = 'document-files';
const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain'
]);

type DbDocument = {
  id: string;
  owner_id: string;
};

type DbCollaborator = {
  role: 'editor' | 'viewer';
};

type DbFile = {
  id: string;
  document_id: string;
  uploader_user_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  file_path: string;
  created_at: string;
};

function mapFile(row: DbFile): DocumentFile {
  return {
    id: row.id,
    documentId: row.document_id,
    uploaderUserId: row.uploader_user_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at
  };
}

function errorResponse(status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  return NextResponse.json(error, { status });
}

function sanitizeFileName(input: string) {
  const trimmed = input.trim();
  const withoutUnsafe = trimmed.replace(/[^a-zA-Z0-9._-]/g, '_');
  return withoutUnsafe.slice(0, 120) || 'file';
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
      .from('document_files')
      .select('id,document_id,uploader_user_id,file_name,mime_type,size_bytes,file_path,created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return errorResponse(500, 'files_fetch_failed', 'Unable to fetch document files');
    }

    const items = await Promise.all(
      ((data ?? []) as DbFile[]).map(async (row): Promise<DocumentFile> => {
        const mapped = mapFile(row);
        const signed = await supabase.storage.from(FILE_BUCKET).createSignedUrl(row.file_path, 3600);
        if (!signed.error) {
          mapped.signedUrl = signed.data.signedUrl;
        }
        return mapped;
      })
    );

    return NextResponse.json({ items, accessRole }, { status: 200 });
  } catch {
    return errorResponse(500, 'files_fetch_failed', 'Unable to fetch document files');
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    return errorResponse(403, 'forbidden', 'You do not have permission to upload files');
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return errorResponse(400, 'invalid_payload', 'Invalid upload payload');
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return errorResponse(400, 'invalid_payload', 'File is required');
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
    return errorResponse(400, 'invalid_file_size', 'File size must be between 1 byte and 10 MB');
  }

  if (!SUPPORTED_MIME_TYPES.has(file.type)) {
    return errorResponse(400, 'invalid_file_type', 'Unsupported file type');
  }

  const safeName = sanitizeFileName(file.name);
  const storagePath = `${userId}/${documentId}/${Date.now()}-${randomUUID()}-${safeName}`;

  const supabase = createSupabaseServerClient();

  const { error: uploadError } = await supabase.storage
    .from(FILE_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type });

  if (uploadError) {
    return errorResponse(500, 'file_upload_failed', 'Unable to upload file');
  }

  const { data, error } = await supabase
    .from('document_files')
    .insert({
      document_id: documentId,
      uploader_user_id: userId,
      file_name: safeName,
      file_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size
    })
    .select('id,document_id,uploader_user_id,file_name,mime_type,size_bytes,file_path,created_at')
    .single();

  if (error) {
    await supabase.storage.from(FILE_BUCKET).remove([storagePath]).catch(() => undefined);
    return errorResponse(500, 'file_create_failed', 'Unable to create file record');
  }

  const mapped = mapFile(data as DbFile);
  const signed = await supabase.storage.from(FILE_BUCKET).createSignedUrl(storagePath, 3600);
  if (!signed.error) {
    mapped.signedUrl = signed.data.signedUrl;
  }

  return NextResponse.json(mapped, { status: 201 });
}
