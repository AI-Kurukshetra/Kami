import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, UserNotification } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.object({
  id: z.string().uuid()
});

type DbNotification = {
  id: string;
  user_id: string;
  type: 'document_shared' | 'document_unshared';
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

function mapNotification(row: DbNotification): UserNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    metadata: row.metadata ?? {},
    readAt: row.read_at,
    createdAt: row.created_at
  };
}

function errorResponse(status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  return NextResponse.json(error, { status });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let notificationId: string;
  try {
    const params = await context.params;
    notificationId = idSchema.parse(params).id;
  } catch {
    return errorResponse(400, 'invalid_notification_id', 'Invalid notification id');
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('user_notifications')
    .update({
      read_at: new Date().toISOString()
    })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select('id,user_id,type,title,body,metadata,read_at,created_at')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return errorResponse(404, 'notification_not_found', 'Notification not found');
    }

    return errorResponse(500, 'notification_update_failed', 'Unable to update notification');
  }

  return NextResponse.json(mapNotification(data as DbNotification), { status: 200 });
}
