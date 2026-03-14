import { NextRequest, NextResponse } from 'next/server';

import type { ApiError } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function errorResponse(status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  return NextResponse.json(error, { status });
}

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from('user_notifications')
    .update({
      read_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    return errorResponse(500, 'notification_update_failed', 'Unable to update notifications');
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
