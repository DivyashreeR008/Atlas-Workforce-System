import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle(/Atlas/);
});

test('can log in', async ({ page }) => {
  await page.goto('/login');
  
  await page.fill('input[type="email"]', 'admin@atlas.io');
  await page.fill('input[type="password"]', 'ChangeMe123!');
  
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL(/.*dashboard/);
});
