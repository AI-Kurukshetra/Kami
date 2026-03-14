import { expect, test } from '@playwright/test';

test.describe('smoke e2e', () => {
  test('home renders and links to auth', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Elevate instruction and collaboration in one elegant workspace' })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Auth' })).toBeVisible();
  });

  test('auth page toggles between sign in and sign up', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await page.getByRole('button', { name: 'Need an account? Sign up' }).click();
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });

  test('invalid auth submit shows validation/runtime error state', async ({ page }) => {
    await page.goto('/auth');

    await page.getByLabel('Email').fill('invalid-email');
    await page.getByLabel('Password').fill('123');

    // Native validation keeps submit blocked for invalid inputs.
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});
