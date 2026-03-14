import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiError, CreateProfileInput, Profile } from '@kami/shared';

import { getRequestUserId } from '@/lib/auth-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const createProfileSchema = z.object({
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
  phoneNumber: z.preprocess(
    (value) => (typeof value === 'string' ? value.replace(/[\s()-]/g, '').trim() : value),
    z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Phone number must be in valid international format')
  )
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

export async function GET(request: NextRequest) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,display_name,first_name,last_name,phone_number,created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    const message =
      process.env.NODE_ENV === 'development'
        ? `Unable to fetch profiles: ${error.message}`
        : 'Unable to fetch profiles';
    return errorResponse(500, 'profiles_fetch_failed', message);
  }

  const rows = (data ?? []) as DbProfile[];
  const profiles = rows.map((row: DbProfile) => mapProfile(row));
  return NextResponse.json({ items: profiles }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request);

  if (!userId) {
    return errorResponse(401, 'unauthorized', 'Authentication required');
  }

  let body: CreateProfileInput;

  try {
    const rawBody = await request.json();
    body = createProfileSchema.parse(rawBody);
  } catch {
    return errorResponse(400, 'invalid_payload', 'Invalid request payload');
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      owner_id: userId,
      email: body.email,
      display_name: `${body.firstName} ${body.lastName}`.trim(),
      first_name: body.firstName,
      last_name: body.lastName,
      phone_number: body.phoneNumber
    })
    .select('id,email,display_name,first_name,last_name,phone_number,created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return errorResponse(409, 'profile_exists', 'Profile already exists for this email');
    }

    const message =
      process.env.NODE_ENV === 'development'
        ? `Unable to create profile: ${error.message}`
        : 'Unable to create profile';
    return errorResponse(500, 'profile_create_failed', message);
  }

  return NextResponse.json(mapProfile(data as DbProfile), { status: 201 });
}
