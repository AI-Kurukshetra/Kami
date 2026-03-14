import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, Classroom } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const paramsSchema = z.object({
  id: z.string().uuid()
});

const updateSchema = z.object({
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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let classroomId: string;
  let body: z.infer<typeof updateSchema>;
  try {
    const params = await context.params;
    classroomId = paramsSchema.parse(params).id;
    body = updateSchema.parse(await request.json());
  } catch {
    return errorResponse(400, 'invalid_payload', 'Invalid request payload');
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('classrooms')
    .update({
      name: body.name,
      description: body.description
    })
    .eq('id', classroomId)
    .eq('owner_id', userId)
    .select('id,owner_id,name,description,created_at,updated_at')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return errorResponse(404, 'classroom_not_found', 'Classroom not found');
    }
    return errorResponse(500, 'classroom_update_failed', 'Unable to update classroom');
  }

  return NextResponse.json(mapClassroom(data as DbClassroom), { status: 200 });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(_request);
  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let classroomId: string;
  try {
    const params = await context.params;
    classroomId = paramsSchema.parse(params).id;
  } catch {
    return errorResponse(400, 'invalid_classroom_id', 'Invalid classroom id');
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('classrooms')
    .delete()
    .eq('id', classroomId)
    .eq('owner_id', userId)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return errorResponse(404, 'classroom_not_found', 'Classroom not found');
    }
    return errorResponse(500, 'classroom_delete_failed', 'Unable to delete classroom');
  }

  return NextResponse.json({ success: true, id: data.id }, { status: 200 });
}
