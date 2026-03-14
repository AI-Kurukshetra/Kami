import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import type { ApiError, Document, DocumentStatus } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { appendDocumentActivity } from '@/lib/document-activity';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
  title: string;
  content: string;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
};

function errorResponse(status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  return NextResponse.json(error, { status });
}

function sanitizeFileName(input: string) {
  const trimmed = input.trim();
  const withoutUnsafe = trimmed.replace(/[^a-zA-Z0-9._-]/g, '_');
  return withoutUnsafe.slice(0, 120) || 'file';
}

function titleFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  return withoutExtension.replace(/[_-]+/g, ' ').trim().slice(0, 120) || 'Imported Document';
}

function deriveSeedContent(file: File, extractedText: string | null) {
  if (extractedText && extractedText.trim().length > 0) {
    return extractedText.slice(0, 10000);
  }

  return [
    `Imported file: ${file.name}`,
    `MIME type: ${file.type}`,
    '',
    'This document was created from an uploaded file.',
    'Open the Files section in document details to access the original file.'
  ].join('\n');
}

function mapDocument(row: DbDocument): Document {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accessRole: 'owner'
  };
}

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
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

  const status = form.get('status') === 'published' ? 'published' : 'draft';
  const safeName = sanitizeFileName(file.name);
  const title = titleFromFileName(safeName);
  const storagePath = `${userId}/imports/${Date.now()}-${randomUUID()}-${safeName}`;

  let extractedText: string | null = null;
  if (file.type === 'text/plain') {
    extractedText = await file.text().catch(() => null);
  }

  const content = deriveSeedContent(file, extractedText);
  const supabase = createSupabaseServerClient();

  const { data: documentData, error: documentError } = await supabase
    .from('documents')
    .insert({
      owner_id: userId,
      title,
      content,
      status
    })
    .select('id,title,content,status,created_at,updated_at')
    .single();

  if (documentError) {
    return errorResponse(500, 'document_create_failed', 'Unable to create imported document');
  }

  const document = documentData as DbDocument;

  const { error: uploadError } = await supabase.storage
    .from(FILE_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type });

  if (uploadError) {
    await supabase.from('documents').delete().eq('id', document.id);
    return errorResponse(500, 'file_upload_failed', 'Unable to upload imported file');
  }

  const { error: fileRowError } = await supabase.from('document_files').insert({
    document_id: document.id,
    uploader_user_id: userId,
    file_name: safeName,
    file_path: storagePath,
    mime_type: file.type,
    size_bytes: file.size
  });

  if (fileRowError) {
    await supabase.storage.from(FILE_BUCKET).remove([storagePath]).catch(() => undefined);
    await supabase.from('documents').delete().eq('id', document.id);
    return errorResponse(500, 'file_create_failed', 'Unable to create imported file record');
  }

  await appendDocumentActivity({
    documentId: document.id,
    actorUserId: userId,
    action: 'created',
    metadata: {
      status,
      source: 'file_import',
      fileName: safeName,
      mimeType: file.type
    },
    supabase
  }).catch(() => undefined);

  return NextResponse.json(mapDocument(document), { status: 201 });
}
