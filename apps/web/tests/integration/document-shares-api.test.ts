import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockCreateSupabaseServerClient: vi.fn(),
  mockGetRequestUserId: vi.fn(),
  adminGetUserByIdQueue: [] as Array<{ data: { user: { email?: string } | null } | null; error: { code?: string } | null }>,
  adminListUsersQueue: [] as Array<{ data: { users: Array<{ id: string; email?: string }> }; error: { code?: string } | null }>,
  documentSelectQueue: [] as Array<{ data: unknown; error: { code?: string } | null }>,
  collaboratorSelectQueue: [] as Array<{ data: unknown; error: { code?: string } | null }>,
  collaboratorListQueue: [] as Array<{ data: unknown; error: { code?: string } | null }>,
  collaboratorUpsertQueue: [] as Array<{ data: unknown; error: { code?: string } | null }>,
  collaboratorDeleteQueue: [] as Array<{ data: unknown; error: { code?: string } | null }>
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: hoisted.mockCreateSupabaseServerClient
}));

vi.mock('@/lib/auth-user', () => ({
  getRequestUserId: hoisted.mockGetRequestUserId
}));

import {
  GET as GET_SHARES,
  POST as POST_SHARE
} from '@/app/api/documents/[id]/shares/route';
import { DELETE as DELETE_SHARE } from '@/app/api/documents/[id]/shares/[userId]/route';

const DOC_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COLLAB_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function shiftOrThrow<T>(queue: T[], label: string): T {
  const item = queue.shift();
  if (!item) {
    throw new Error(`Missing mock result for ${label}`);
  }
  return item;
}

function setupFromMock() {
  hoisted.mockFrom.mockImplementation((table: string) => {
    if (table === 'documents') {
      return {
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue(
              shiftOrThrow(hoisted.documentSelectQueue, 'documents.select.eq.single')
            )
          })
        })
      };
    }

    if (table === 'document_collaborators') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue(
                shiftOrThrow(hoisted.collaboratorSelectQueue, 'document_collaborators.select.eq.eq.single')
              )
            }),
            order: vi
              .fn()
              .mockResolvedValue(
                shiftOrThrow(hoisted.collaboratorListQueue, 'document_collaborators.select.eq.order')
              )
          })
        }),
        upsert: () => ({
          select: () => ({
            single: vi.fn().mockResolvedValue(
              shiftOrThrow(hoisted.collaboratorUpsertQueue, 'document_collaborators.upsert.select.single')
            )
          })
        }),
        delete: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue(
                  shiftOrThrow(hoisted.collaboratorDeleteQueue, 'document_collaborators.delete.eq.eq.select.single')
                )
              })
            })
          })
        })
      };
    }

    throw new Error(`Unexpected table mock: ${table}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mockGetRequestUserId.mockResolvedValue(OWNER_ID);
  hoisted.documentSelectQueue = [];
  hoisted.collaboratorSelectQueue = [];
  hoisted.collaboratorListQueue = [];
  hoisted.collaboratorUpsertQueue = [];
  hoisted.collaboratorDeleteQueue = [];
  hoisted.adminGetUserByIdQueue = [];
  hoisted.adminListUsersQueue = [];

  setupFromMock();

  hoisted.mockCreateSupabaseServerClient.mockReturnValue({
    from: hoisted.mockFrom,
    auth: {
      admin: {
        getUserById: vi.fn().mockImplementation(() => shiftOrThrow(hoisted.adminGetUserByIdQueue, 'auth.admin.getUserById')),
        listUsers: vi.fn().mockImplementation(() => shiftOrThrow(hoisted.adminListUsersQueue, 'auth.admin.listUsers'))
      }
    }
  });
});

describe('document shares api integration', () => {
  it('GET /shares returns collaborators for owner', async () => {
    hoisted.documentSelectQueue.push({
      data: { id: DOC_ID, owner_id: OWNER_ID },
      error: null
    });
    hoisted.collaboratorListQueue.push({
      data: [
        {
          document_id: DOC_ID,
          user_id: COLLAB_ID,
          role: 'viewer',
          created_at: '2026-03-14T00:00:00.000Z'
        }
      ],
      error: null
    });
    hoisted.adminGetUserByIdQueue.push({
      data: { user: { email: 'collab@kami.app' } },
      error: null
    });

    const request = new NextRequest(`http://localhost/api/documents/${DOC_ID}/shares`);
    const response = await GET_SHARES(request, { params: Promise.resolve({ id: DOC_ID }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      items: [
        {
          documentId: DOC_ID,
          userId: COLLAB_ID,
          email: 'collab@kami.app',
          role: 'viewer',
          createdAt: '2026-03-14T00:00:00.000Z'
        }
      ]
    });
  });

  it('GET /shares returns 403 for non-owner', async () => {
    hoisted.documentSelectQueue.push({
      data: { id: DOC_ID, owner_id: OTHER_ID },
      error: null
    });

    const request = new NextRequest(`http://localhost/api/documents/${DOC_ID}/shares`);
    const response = await GET_SHARES(request, { params: Promise.resolve({ id: DOC_ID }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      code: 'forbidden',
      message: 'Only document owners can manage collaborators'
    });
  });

  it('POST /shares blocks owner self-sharing', async () => {
    hoisted.documentSelectQueue.push({
      data: { id: DOC_ID, owner_id: OWNER_ID },
      error: null
    });

    const request = new NextRequest(`http://localhost/api/documents/${DOC_ID}/shares`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: OWNER_ID, role: 'editor' })
    });

    const response = await POST_SHARE(request, { params: Promise.resolve({ id: DOC_ID }) });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      code: 'invalid_collaborator',
      message: 'Owner already has full access'
    });
  });

  it('POST /shares upserts collaborator for owner', async () => {
    hoisted.documentSelectQueue.push({
      data: { id: DOC_ID, owner_id: OWNER_ID },
      error: null
    });
    hoisted.collaboratorUpsertQueue.push({
      data: {
        document_id: DOC_ID,
        user_id: COLLAB_ID,
        role: 'editor',
        created_at: '2026-03-14T00:00:00.000Z'
      },
      error: null
    });
    hoisted.adminGetUserByIdQueue.push({
      data: { user: { email: 'collab@kami.app' } },
      error: null
    });

    const request = new NextRequest(`http://localhost/api/documents/${DOC_ID}/shares`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: COLLAB_ID, role: 'editor' })
    });

    const response = await POST_SHARE(request, { params: Promise.resolve({ id: DOC_ID }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      documentId: DOC_ID,
      userId: COLLAB_ID,
      email: 'collab@kami.app',
      role: 'editor',
      createdAt: '2026-03-14T00:00:00.000Z'
    });
  });

  it('DELETE /shares/[userId] removes collaborator for owner', async () => {
    hoisted.documentSelectQueue.push({
      data: { owner_id: OWNER_ID },
      error: null
    });
    hoisted.collaboratorDeleteQueue.push({
      data: { id: 'share-row-id' },
      error: null
    });

    const request = new NextRequest(`http://localhost/api/documents/${DOC_ID}/shares/${COLLAB_ID}`, {
      method: 'DELETE'
    });

    const response = await DELETE_SHARE(request, {
      params: Promise.resolve({ id: DOC_ID, userId: COLLAB_ID })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true, id: 'share-row-id' });
  });

  it('DELETE /shares/[userId] returns 403 for non-owner', async () => {
    hoisted.documentSelectQueue.push({
      data: { owner_id: OTHER_ID },
      error: null
    });

    const request = new NextRequest(`http://localhost/api/documents/${DOC_ID}/shares/${COLLAB_ID}`, {
      method: 'DELETE'
    });

    const response = await DELETE_SHARE(request, {
      params: Promise.resolve({ id: DOC_ID, userId: COLLAB_ID })
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      code: 'forbidden',
      message: 'Only document owners can manage collaborators'
    });
  });
});
