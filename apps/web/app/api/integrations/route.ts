import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, IntegrationSetting, IntegrationStatus } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const upsertSchema = z.object({
  provider: z.enum(['google_drive', 'dropbox', 'onedrive', 'canvas', 'google_classroom']),
  status: z.enum(['disconnected', 'connected']).default('disconnected'),
  config: z.record(z.string(), z.unknown()).default({})
});

type DbIntegration = {
  id: string;
  owner_id: string;
  provider: 'google_drive' | 'dropbox' | 'onedrive' | 'canvas' | 'google_classroom';
  status: IntegrationStatus;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function mapIntegration(row: DbIntegration): IntegrationSetting {
  return {
    id: row.id,
    ownerId: row.owner_id,
    provider: row.provider,
    status: row.status,
    config: row.config ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
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
    .from('integration_settings')
    .select('id,owner_id,provider,status,config,created_at,updated_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return errorResponse(500, 'integrations_fetch_failed', 'Unable to fetch integrations');
  }

  return NextResponse.json({ items: ((data ?? []) as DbIntegration[]).map(mapIntegration) }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let body: z.infer<typeof upsertSchema>;
  try {
    body = upsertSchema.parse(await request.json());
  } catch {
    return errorResponse(400, 'invalid_payload', 'Invalid request payload');
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('integration_settings')
    .upsert(
      {
        owner_id: userId,
        provider: body.provider,
        status: body.status,
        config: body.config
      },
      {
        onConflict: 'owner_id,provider'
      }
    )
    .select('id,owner_id,provider,status,config,created_at,updated_at')
    .single();

  if (error) {
    return errorResponse(500, 'integration_upsert_failed', 'Unable to save integration setting');
  }

  return NextResponse.json(mapIntegration(data as DbIntegration), { status: 200 });
}
