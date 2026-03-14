import { expect, test } from '@playwright/test';

const testEmail = process.env.E2E_SUPABASE_TEST_EMAIL;
const testPassword = process.env.E2E_SUPABASE_TEST_PASSWORD;

test.describe('authenticated smoke e2e', () => {
  test.skip(!testEmail || !testPassword, 'Requires E2E_SUPABASE_TEST_EMAIL and E2E_SUPABASE_TEST_PASSWORD');

  test('sign in, open workspace, and sign out', async ({ page }) => {
    await page.goto('/auth');

    await page.getByLabel('Email').fill(testEmail!);
    await page.getByLabel('Password').fill(testPassword!);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/workspace/);
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/auth/);
  });
});
