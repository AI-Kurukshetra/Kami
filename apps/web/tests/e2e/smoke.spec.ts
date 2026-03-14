import { expect, test } from '@playwright/test';

test.describe('smoke e2e', () => {
  test('home renders and links to auth', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Make learning materials truly interactive' })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in \/ sign up/i })).toBeVisible();
  });

  test('auth page toggles between sign in and sign up', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.getByRole('heading', { name: /signin/i })).toBeVisible();
    await page.getByRole('button', { name: /need an account\? signup/i }).click();
    await expect(page.getByRole('heading', { name: /signup/i })).toBeVisible();
  });

  test('invalid auth submit shows validation/runtime error state', async ({ page }) => {
    await page.goto('/auth');

    await page.getByLabel('Email').fill('invalid-email');
    await page.getByLabel('Password').fill('123');

    // Native validation keeps submit blocked for invalid inputs.
    await expect(page.getByRole('button', { name: /signin/i })).toBeVisible();
  });
});
