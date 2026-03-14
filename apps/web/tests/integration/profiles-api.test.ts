import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  return {
    mockFrom: vi.fn(),
    mockCreateSupabaseServerClient: vi.fn(),
    mockGetRequestUserId: vi.fn()
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: hoisted.mockCreateSupabaseServerClient
}));

vi.mock('@/lib/auth-user', () => ({
  getRequestUserId: hoisted.mockGetRequestUserId
}));

import { GET, POST } from '@/app/api/profiles/route';

type DbRow = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
};

function setupGetChain(result: { data: DbRow[] | null; error: { code?: string } | null }) {
  const limit = vi.fn().mockResolvedValue(result);
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });

  hoisted.mockFrom.mockReturnValue({ select });
}

function setupPostChain(result: { data: DbRow | null; error: { code?: string } | null }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });

  hoisted.mockFrom.mockReturnValue({ insert });
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mockGetRequestUserId.mockResolvedValue('user_1');
  hoisted.mockCreateSupabaseServerClient.mockReturnValue({
    from: hoisted.mockFrom
  });
});

describe('profiles api integration', () => {
  it('GET returns mapped profile list', async () => {
    setupGetChain({
      data: [
        {
          id: 'p_1',
          email: 'demo@kami.app',
          display_name: 'Demo User',
          created_at: '2026-03-14T00:00:00.000Z'
        }
      ],
      error: null
    });

    const request = new NextRequest('http://localhost/api/profiles');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      items: [
        {
          id: 'p_1',
          email: 'demo@kami.app',
          displayName: 'Demo User',
          createdAt: '2026-03-14T00:00:00.000Z'
        }
      ]
    });
  });

  it('GET returns 500 on database failure', async () => {
    setupGetChain({
      data: null,
      error: { code: 'db_error' }
    });

    const request = new NextRequest('http://localhost/api/profiles');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      code: 'profiles_fetch_failed',
      message: 'Unable to fetch profiles'
    });
  });

  it('POST returns 400 for invalid payload (negative)', async () => {
    const request = new NextRequest('http://localhost/api/profiles', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', displayName: 'A' }),
      headers: { 'content-type': 'application/json' }
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      code: 'invalid_payload',
      message: 'Invalid request payload'
    });
    expect(hoisted.mockFrom).not.toHaveBeenCalled();
  });

  it('GET returns 401 when user is unauthenticated', async () => {
    hoisted.mockGetRequestUserId.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/profiles');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      code: 'unauthorized',
      message: 'Authentication required'
    });
  });

  it('POST accepts boundary display name length = 80', async () => {
    const maxName = 'N'.repeat(80);

    setupPostChain({
      data: {
        id: 'p_2',
        email: 'max@kami.app',
        display_name: maxName,
        created_at: '2026-03-14T01:00:00.000Z'
      },
      error: null
    });

    const request = new NextRequest('http://localhost/api/profiles', {
      method: 'POST',
      body: JSON.stringify({ email: 'max@kami.app', displayName: maxName }),
      headers: { 'content-type': 'application/json' }
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      id: 'p_2',
      email: 'max@kami.app',
      displayName: maxName,
      createdAt: '2026-03-14T01:00:00.000Z'
    });
  });

  it('POST returns 409 for duplicate email', async () => {
    setupPostChain({
      data: null,
      error: { code: '23505' }
    });

    const request = new NextRequest('http://localhost/api/profiles', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@kami.app', displayName: 'Demo User' }),
      headers: { 'content-type': 'application/json' }
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({
      code: 'profile_exists',
      message: 'Profile already exists for this email'
    });
  });

  it('POST returns 500 for unexpected database failure', async () => {
    setupPostChain({
      data: null,
      error: { code: 'unexpected' }
    });

    const request = new NextRequest('http://localhost/api/profiles', {
      method: 'POST',
      body: JSON.stringify({ email: 'new@kami.app', displayName: 'New User' }),
      headers: { 'content-type': 'application/json' }
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      code: 'profile_create_failed',
      message: 'Unable to create profile'
    });
  });
});
