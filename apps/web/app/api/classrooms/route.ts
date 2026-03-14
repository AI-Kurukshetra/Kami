import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, Classroom } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const createClassroomSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default('')
});

type DbClassroom = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

function mapClassroom(row: DbClassroom): Classroom {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
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
    .from('classrooms')
    .select('id,owner_id,name,description,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    return errorResponse(500, 'classrooms_fetch_failed', 'Unable to fetch classrooms');
  }

  return NextResponse.json({ items: ((data ?? []) as DbClassroom[]).map(mapClassroom) }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let body: z.infer<typeof createClassroomSchema>;
  try {
    body = createClassroomSchema.parse(await request.json());
  } catch {
    return errorResponse(400, 'invalid_payload', 'Invalid request payload');
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('classrooms')
    .insert({
      owner_id: userId,
      name: body.name,
      description: body.description
    })
    .select('id,owner_id,name,description,created_at,updated_at')
    .single();

  if (error) {
    return errorResponse(500, 'classroom_create_failed', 'Unable to create classroom');
  }

  return NextResponse.json(mapClassroom(data as DbClassroom), { status: 201 });
}
