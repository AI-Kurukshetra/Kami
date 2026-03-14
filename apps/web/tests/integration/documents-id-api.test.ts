import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockCreateSupabaseServerClient: vi.fn(),
  mockGetRequestUserId: vi.fn(),
  documentSelectQueue: [] as Array<{ data: unknown; error: { code?: string } | null }>,
  collaboratorSelectQueue: [] as Array<{ data: unknown; error: { code?: string } | null }>,
  documentUpdateQueue: [] as Array<{ data: unknown; error: { code?: string } | null }>,
  documentDeleteQueue: [] as Array<{ data: unknown; error: { code?: string } | null }>
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: hoisted.mockCreateSupabaseServerClient
}));

vi.mock('@/lib/auth-user', () => ({
  getRequestUserId: hoisted.mockGetRequestUserId
}));

import { DELETE, GET, PATCH } from '@/app/api/documents/[id]/route';

const DOC_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

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
            eq: () => ({
              single: vi.fn().mockResolvedValue(shiftOrThrow(hoisted.documentSelectQueue, 'documents.select.eq.eq.single'))
            }),
            single: vi.fn().mockResolvedValue(shiftOrThrow(hoisted.documentSelectQueue, 'documents.select.eq.single'))
          })
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue(shiftOrThrow(hoisted.documentUpdateQueue, 'documents.update.eq.select.single'))
            })
          })
        }),
        delete: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue(shiftOrThrow(hoisted.documentDeleteQueue, 'documents.delete.eq.eq.select.single'))
              })
            }),
            select: () => ({
              single: vi.fn().mockResolvedValue(shiftOrThrow(hoisted.documentDeleteQueue, 'documents.delete.eq.select.single'))
            })
          })
        })
      };
    }

    if (table === 'document_collaborators') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue(shiftOrThrow(hoisted.collaboratorSelectQueue, 'document_collaborators.select.eq.eq.single'))
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
  hoisted.mockGetRequestUserId.mockResolvedValue(USER_ID);
  hoisted.documentSelectQueue = [];
  hoisted.collaboratorSelectQueue = [];
  hoisted.documentUpdateQueue = [];
  hoisted.documentDeleteQueue = [];

  setupFromMock();

  hoisted.mockCreateSupabaseServerClient.mockReturnValue({
    from: hoisted.mockFrom
  });
});

describe('documents/[id] api integration', () => {
  it('GET returns 401 for unauthenticated request', async () => {
    hoisted.mockGetRequestUserId.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost/api/documents/${DOC_ID}`);
    const response = await GET(request, { params: Promise.resolve({ id: DOC_ID }) });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      code: 'unauthorized',
      message: 'Authentication required'
    });
  });

  it('GET returns owner document with accessRole owner', async () => {
    hoisted.documentSelectQueue.push({
      data: {
        id: DOC_ID,
        owner_id: USER_ID,
        title: 'Owner doc',
        content: 'owner content',
        status: 'draft',
        created_at: '2026-03-14T00:00:00.000Z',
        updated_at: '2026-03-14T00:00:00.000Z'
      },
      error: null
    });

    const request = new NextRequest(`http://localhost/api/documents/${DOC_ID}`);
    const response = await GET(request, { params: Promise.resolve({ id: DOC_ID }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      id: DOC_ID,
      accessRole: 'owner'
    });
  });

  it('GET returns collaborator document with viewer role', async () => {
    hoisted.documentSelectQueue.push({
      data: {
        id: DOC_ID,
        owner_id: OTHER_USER_ID,
        title: 'Shared doc',
        content: 'shared content',
        status: 'published',
        created_at: '2026-03-14T00:00:00.000Z',
        updated_at: '2026-03-14T00:00:00.000Z'
      },
      error: null
    });
    hoisted.collaboratorSelectQueue.push({
      data: { role: 'viewer' },
      error: null
    });

    const request = new NextRequest(`http://localhost/api/documents/${DOC_ID}`);
    const response = await GET(request, { params: Promise.resolve({ id: DOC_ID }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      id: DOC_ID,
      accessRole: 'viewer'
    });
  });

  it('PATCH blocks viewer with 403', async () => {
    hoisted.documentSelectQueue.push({
      data: {
        id: DOC_ID,
        owner_id: OTHER_USER_ID,
        title: 'Shared doc',
        content: 'shared content',
        status: 'draft',
        created_at: '2026-03-14T00:00:00.000Z',
        updated_at: '2026-03-14T00:00:00.000Z'
      },
      error: null
    });
    hoisted.collaboratorSelectQueue.push({
      data: { role: 'viewer' },
      error: null
    });

    const request = new NextRequest(`http://localhost/api/documents/${DOC_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Edited title', content: 'Edited content', status: 'draft' })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: DOC_ID }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      code: 'forbidden',
      message: 'You do not have permission to edit this document'
    });
  });

  it('PATCH allows editor and returns updated document', async () => {
    hoisted.documentSelectQueue.push({
      data: {
        id: DOC_ID,
        owner_id: OTHER_USER_ID,
        title: 'Shared doc',
        content: 'shared content',
        status: 'draft',
        created_at: '2026-03-14T00:00:00.000Z',
        updated_at: '2026-03-14T00:00:00.000Z'
      },
      error: null
    });
    hoisted.collaboratorSelectQueue.push({
      data: { role: 'editor' },
      error: null
    });
    hoisted.documentUpdateQueue.push({
      data: {
        id: DOC_ID,
        owner_id: OTHER_USER_ID,
        title: 'Edited title',
        content: 'Edited content',
        status: 'published',
        created_at: '2026-03-14T00:00:00.000Z',
        updated_at: '2026-03-14T01:00:00.000Z'
      },
      error: null
    });

    const request = new NextRequest(`http://localhost/api/documents/${DOC_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Edited title', content: 'Edited content', status: 'published' })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: DOC_ID }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      id: DOC_ID,
      title: 'Edited title',
      accessRole: 'editor'
    });
  });

  it('DELETE blocks non-owner with 403', async () => {
    hoisted.documentSelectQueue.push({
      data: {
        id: DOC_ID,
        owner_id: OTHER_USER_ID,
        title: 'Shared doc',
        content: 'shared content',
        status: 'draft',
        created_at: '2026-03-14T00:00:00.000Z',
        updated_at: '2026-03-14T00:00:00.000Z'
      },
      error: null
    });
    hoisted.collaboratorSelectQueue.push({
      data: { role: 'editor' },
      error: null
    });

    const request = new NextRequest(`http://localhost/api/documents/${DOC_ID}`, {
      method: 'DELETE'
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: DOC_ID }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      code: 'forbidden',
      message: 'Only document owners can delete documents'
    });
  });
});
