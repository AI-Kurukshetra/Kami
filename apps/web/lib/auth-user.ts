import type { NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export async function getRequestUserId(request: NextRequest): Promise<string | null> {
  const token = extractBearerToken(request);

  if (!token) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}
