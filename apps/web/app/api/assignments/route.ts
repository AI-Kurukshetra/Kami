import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, Assignment, AssignmentStatus } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createUserNotification } from '@/lib/notifications';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const createAssignmentSchema = z.object({
  classroomId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).default(''),
  status: z.enum(['draft', 'published', 'closed']).default('draft'),
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

type DbMember = {
  user_id: string;
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

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  const classroomId = request.nextUrl.searchParams.get('classroomId');
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('assignments')
    .select('id,classroom_id,created_by_user_id,title,description,status,due_at,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (classroomId) {
    query = query.eq('classroom_id', classroomId);
  }

  const { data, error } = await query;

  if (error) {
    return errorResponse(500, 'assignments_fetch_failed', 'Unable to fetch assignments');
  }

  return NextResponse.json({ items: ((data ?? []) as DbAssignment[]).map(mapAssignment) }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let body: z.infer<typeof createAssignmentSchema>;
  try {
    body = createAssignmentSchema.parse(await request.json());
  } catch {
    return errorResponse(400, 'invalid_payload', 'Invalid request payload');
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      classroom_id: body.classroomId,
      created_by_user_id: userId,
      title: body.title,
      description: body.description,
      status: body.status,
      due_at: body.dueAt ?? null
    })
    .select('id,classroom_id,created_by_user_id,title,description,status,due_at,created_at,updated_at')
    .single();

  if (error) {
    return errorResponse(500, 'assignment_create_failed', 'Unable to create assignment');
  }

  if (body.status === 'published') {
    const members = await supabase
      .from('classroom_members')
      .select('user_id')
      .eq('classroom_id', body.classroomId);

    if (!members.error) {
      for (const member of (members.data ?? []) as DbMember[]) {
        await createUserNotification({
          userId: member.user_id,
          type: 'assignment_assigned',
          title: 'New assignment published',
          body: body.title,
          metadata: {
            classroomId: body.classroomId
          },
          supabase
        }).catch(() => undefined);
      }
    }
  }

  return NextResponse.json(mapAssignment(data as DbAssignment), { status: 201 });
}
