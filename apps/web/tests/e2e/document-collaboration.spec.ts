import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const requiredEnvReady = Boolean(supabaseUrl && supabaseAnonKey && serviceRoleKey);

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const ownerEmail = `owner.${runId}@example.com`;
const editorEmail = `editor.${runId}@example.com`;
const viewerEmail = `viewer.${runId}@example.com`;
const userPassword = `KamiE2E!${Math.random().toString(36).slice(2, 10)}Z9`;

const docTitle = `E2E Role Doc ${runId}`;
const editorTitle = `${docTitle} Updated`;
const docContent = 'Initial owner content';
const editorContent = 'Edited by editor role';

let ownerId = '';
let editorId = '';
let viewerId = '';
let documentId = '';
let collaborationSchemaReady = true;

async function signInViaUi(page: Page, email: string, password: string) {
  await page.goto('/auth');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /signin/i }).click();
  await expect(page).toHaveURL(/\/workspace/);
}

async function signOutViaWorkspace(page: Page) {
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/auth/);
}

test.describe('document collaboration roles e2e', () => {
  test.skip(!requiredEnvReady, 'Requires Supabase URL, anon key, and service role key for e2e setup');

  test.beforeAll(async () => {
    const admin = createClient(supabaseUrl!, serviceRoleKey!);

    const schemaProbe = await admin
      .from('document_collaborators')
      .select('id')
      .limit(1);

    if (schemaProbe.error) {
      collaborationSchemaReady = false;
      return;
    }

    const ownerResult = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: userPassword,
      email_confirm: true
    });
    if (ownerResult.error || !ownerResult.data.user) {
      throw new Error(`Failed to create owner user: ${ownerResult.error?.message ?? 'unknown error'}`);
    }
    ownerId = ownerResult.data.user.id;

    const editorResult = await admin.auth.admin.createUser({
      email: editorEmail,
      password: userPassword,
      email_confirm: true
    });
    if (editorResult.error || !editorResult.data.user) {
      throw new Error(`Failed to create editor user: ${editorResult.error?.message ?? 'unknown error'}`);
    }
    editorId = editorResult.data.user.id;

    const viewerResult = await admin.auth.admin.createUser({
      email: viewerEmail,
      password: userPassword,
      email_confirm: true
    });
    if (viewerResult.error || !viewerResult.data.user) {
      throw new Error(`Failed to create viewer user: ${viewerResult.error?.message ?? 'unknown error'}`);
    }
    viewerId = viewerResult.data.user.id;
  });

  test.afterAll(async () => {
    const admin = createClient(supabaseUrl!, serviceRoleKey!);

    if (documentId) {
      await admin.from('documents').delete().eq('id', documentId);
    }

    if (ownerId) {
      await admin.auth.admin.deleteUser(ownerId);
    }
    if (editorId) {
      await admin.auth.admin.deleteUser(editorId);
    }
    if (viewerId) {
      await admin.auth.admin.deleteUser(viewerId);
    }
  });

  test('owner can share, editor can edit, viewer is read-only', async ({ page }) => {
    test.skip(!collaborationSchemaReady, 'Requires collaboration migration in Supabase (document_collaborators table)');

    await signInViaUi(page, ownerEmail, userPassword);

    await page.goto('/documents');
    await expect(page.getByRole('heading', { name: 'Document Workspace' })).toBeVisible();

    await page.getByLabel('Title').fill(docTitle);
    await page.getByLabel('Content').fill(docContent);
    await page.getByRole('button', { name: 'Create document' }).click();

    const ownerDocItem = page.locator('li', { hasText: docTitle }).first();
    await expect(ownerDocItem.locator('.rolePill', { hasText: 'owner' })).toBeVisible();

    await ownerDocItem.getByRole('link', { name: docTitle }).click();
    await expect(page.getByText('Access role:')).toBeVisible();
    await expect(
      page.locator('p.meta', { hasText: 'Access role:' }).locator('.rolePill', { hasText: 'owner' })
    ).toBeVisible();

    const detailUrl = page.url();
    documentId = detailUrl.split('/documents/')[1]?.split('?')[0] ?? '';

    await page.getByLabel('Collaborator Email').fill(editorEmail);
    await page.getByLabel('Role').selectOption('editor');
    await page.getByRole('button', { name: 'Add or update collaborator' }).click();
    await expect(page.getByText('Collaborator saved.')).toBeVisible();
    await expect(page.getByText(`Email: ${editorEmail}`)).toBeVisible();

    await page.getByLabel('Collaborator Email').fill(viewerEmail);
    await page.getByLabel('Role').selectOption('viewer');
    await page.getByRole('button', { name: 'Add or update collaborator' }).click();
    await expect(page.getByText(`Email: ${viewerEmail}`)).toBeVisible();

    await signOutViaWorkspace(page);

    await signInViaUi(page, editorEmail, userPassword);
    await page.goto('/documents');

    const editorDocItem = page.locator('li', { hasText: docTitle }).first();
    await expect(editorDocItem.locator('.rolePill', { hasText: 'editor' })).toBeVisible();
    await expect(editorDocItem.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(editorDocItem.getByRole('button', { name: 'Delete' })).toHaveCount(0);

    await editorDocItem.getByRole('link', { name: docTitle }).click();
    await expect(page.getByText('Access role:')).toBeVisible();
    await expect(
      page.locator('p.meta', { hasText: 'Access role:' }).locator('.rolePill', { hasText: 'editor' })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Collaborators' })).toHaveCount(0);

    await page.getByLabel('Title').first().fill(editorTitle);
    await page.locator('textarea[rows="12"]').first().fill(editorContent);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Document saved successfully.')).toBeVisible();

    await signOutViaWorkspace(page);

    await signInViaUi(page, viewerEmail, userPassword);
    await page.goto('/documents');

    const viewerDocItem = page.locator('li', { hasText: editorTitle }).first();
    await expect(viewerDocItem.locator('.rolePill', { hasText: 'viewer' })).toBeVisible();
    await expect(viewerDocItem.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(viewerDocItem.getByRole('button', { name: 'Delete' })).toHaveCount(0);

    await viewerDocItem.getByRole('link', { name: editorTitle }).click();
    await expect(page.getByText('Access role:')).toBeVisible();
    await expect(
      page.locator('p.meta', { hasText: 'Access role:' }).locator('.rolePill', { hasText: 'viewer' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await expect(page.getByLabel('Title').first()).toBeDisabled();
    await expect(page.locator('textarea[rows="12"]').first()).toBeDisabled();
    await expect(page.getByLabel('Status').first()).toBeDisabled();
  });
});
