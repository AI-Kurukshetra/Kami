import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, Assignment, AssignmentStatus } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const paramsSchema = z.object({
  id: z.string().uuid()
});

const updateSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(['draft', 'published', 'closed']).optional(),
  dueAt: z.string().datetime().optional().nullable()
});

type DbAssignment = {
  id: string;
  classroom_id: string;
  created_by_user_id: string;
  title: string;
  description: string;
  status: AssignmentStatus;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapAssignment(row: DbAssignment): Assignment {
  return {
    id: row.id,
    classroomId: row.classroom_id,
    createdByUserId: row.created_by_user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    dueAt: row.due_at,
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

  let assignmentId: string;
  let body: z.infer<typeof updateSchema>;
  try {
    const params = await context.params;
    assignmentId = paramsSchema.parse(params).id;
    body = updateSchema.parse(await request.json());
  } catch {
    return errorResponse(400, 'invalid_payload', 'Invalid request payload');
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('assignments')
    .update({
      ...(body.title ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.dueAt !== undefined ? { due_at: body.dueAt } : {})
    })
    .eq('id', assignmentId)
    .select('id,classroom_id,created_by_user_id,title,description,status,due_at,created_at,updated_at')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return errorResponse(404, 'assignment_not_found', 'Assignment not found');
    }
    return errorResponse(500, 'assignment_update_failed', 'Unable to update assignment');
  }

  return NextResponse.json(mapAssignment(data as DbAssignment), { status: 200 });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(_request);
  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let assignmentId: string;
  try {
    const params = await context.params;
    assignmentId = paramsSchema.parse(params).id;
  } catch {
    return errorResponse(400, 'invalid_assignment_id', 'Invalid assignment id');
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', assignmentId)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return errorResponse(404, 'assignment_not_found', 'Assignment not found');
    }
    return errorResponse(500, 'assignment_delete_failed', 'Unable to delete assignment');
  }

  return NextResponse.json({ success: true, id: data.id }, { status: 200 });
}
