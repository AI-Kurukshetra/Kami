import { NextRequest, NextResponse } from 'next/server';

import type { ApiError, UserNotification } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('user_notifications')
    .select('id,user_id,type,title,body,metadata,read_at,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    const message =
      process.env.NODE_ENV === 'development'
        ? `Unable to fetch notifications: ${error.message}`
        : 'Unable to fetch notifications';
    return errorResponse(500, 'notifications_fetch_failed', message);
  }

  const items = ((data ?? []) as DbNotification[]).map(mapNotification);
  const unreadCount = items.filter((item) => !item.readAt).length;

  return NextResponse.json({ items, unreadCount }, { status: 200 });
}
