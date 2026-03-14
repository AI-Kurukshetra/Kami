import { createSupabaseServerClient } from './supabase/server';

import type { NotificationType } from '@kami/shared';

type CreateUserNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  supabase?: ReturnType<typeof createSupabaseServerClient>;
};

export async function createUserNotification(input: CreateUserNotificationInput) {
  const supabase = input.supabase ?? createSupabaseServerClient();

  await supabase.from('user_notifications').insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    metadata: input.metadata ?? {}
  });
}
