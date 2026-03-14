import { createSupabaseServerClient } from './supabase/server';

export type DocumentActivityAction = 'created' | 'updated' | 'deleted' | 'shared' | 'unshared';

type AppendDocumentActivityInput = {
  documentId: string;
  actorUserId: string;
  action: DocumentActivityAction;
  metadata?: Record<string, unknown>;
  supabase?: ReturnType<typeof createSupabaseServerClient>;
};

export async function appendDocumentActivity(input: AppendDocumentActivityInput) {
  const supabase = input.supabase ?? createSupabaseServerClient();

  await supabase.from('document_activity').insert({
    document_id: input.documentId,
    actor_user_id: input.actorUserId,
    action: input.action,
    metadata: input.metadata ?? {}
  });
}
