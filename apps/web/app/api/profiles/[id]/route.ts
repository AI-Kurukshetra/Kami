import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, Profile, UpdateProfileInput } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.object({
  id: z.string().uuid()
});

const updateProfileSchema = z.object({
  firstName: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-zA-Z][a-zA-Z '\\-]*$/, 'First name can only contain letters and valid separators'),
  lastName: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-zA-Z][a-zA-Z '\\-]*$/, 'Last name can only contain letters and valid separators'),
  email: z.string().email(),
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{9,14}$/, 'Phone number must be in valid international format')
});

type DbProfile = {
  id: string;
  email: string;
  display_name: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  created_at: string;
};

function mapProfile(row: DbProfile): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    firstName: row.first_name,
    lastName: row.last_name,
    phoneNumber: row.phone_number,
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

  let profileId: string;
  let body: UpdateProfileInput;

  try {
    const params = await context.params;
    profileId = idSchema.parse(params).id;
    body = updateProfileSchema.parse(await request.json());
  } catch {
    return errorResponse(400, 'invalid_payload', 'Invalid request payload');
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('profiles')
    .update({
      first_name: body.firstName,
      last_name: body.lastName,
      email: body.email,
      phone_number: body.phoneNumber,
      display_name: `${body.firstName} ${body.lastName}`.trim()
    })
    .eq('id', profileId)
    .eq('owner_id', userId)
    .select('id,email,display_name,first_name,last_name,phone_number,created_at')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return errorResponse(404, 'profile_not_found', 'Profile not found');
    }

    return errorResponse(500, 'profile_update_failed', 'Unable to update profile');
  }

  return NextResponse.json(mapProfile(data as DbProfile), { status: 200 });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(_request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let profileId: string;

  try {
    const params = await context.params;
    profileId = idSchema.parse(params).id;
  } catch {
    return errorResponse(400, 'invalid_profile_id', 'Invalid profile id');
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', profileId)
    .eq('owner_id', userId)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return errorResponse(404, 'profile_not_found', 'Profile not found');
    }

    return errorResponse(500, 'profile_delete_failed', 'Unable to delete profile');
  }

  return NextResponse.json({ success: true, id: data.id }, { status: 200 });
}
