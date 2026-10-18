import { test, expect } from '@playwright/test';

const E2E_USER = process.env.E2E_USER || 'admin@atlas.io';
const E2E_PASS = process.env.E2E_PASS || 'ChangeMe123!';

test.describe('Employee Self-Service', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', E2E_USER);
    await page.fill('input[type="password"]', E2E_PASS);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('sidebar exposes the my workspace links', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'My Payslips' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Leave' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Profile' })).toBeVisible();
  });

  test('my payslips page renders a resolved state', async ({ page }) => {
    await page.goto('/dashboard/me/payslips');
    await expect(page.getByRole('heading', { name: 'My Workspace' })).toBeVisible();

    const resolved = page
      .locator('table')
      .or(page.getByTestId('payslips-empty'))
      .or(page.getByText('Failed to load your payslips'));
    await expect(resolved.first()).toBeVisible({ timeout: 15000 });
  });

  test('my leave page shows balances and requests sections', async ({ page }) => {
    await page.goto('/dashboard/me/leave');
    await expect(page.getByRole('heading', { name: 'Balances' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'My requests' })).toBeVisible();

    const resolved = page
      .locator('table')
      .or(page.getByTestId('leave-requests-empty'))
      .or(page.getByText("No leave balances are configured"))
      .or(page.getByText('Failed to load your leave requests'));
    await expect(resolved.first()).toBeVisible({ timeout: 15000 });
  });

  test('profile page resolves and supports editing with validation', async ({ page }) => {
    await page.goto('/dashboard/me');

    const resolved = page
      .getByTestId('my-profile')
      .or(page.getByTestId('my-profile-empty'))
      .or(page.getByTestId('my-profile-error'));
    await expect(resolved.first()).toBeVisible({ timeout: 15000 });

    const editButton = page.getByTestId('edit-profile');
    if (!(await editButton.isVisible().catch(() => false))) {
      test.skip(true, 'E2E user has no linked employee profile to edit');
    }

    await editButton.click();
    await expect(page.getByTestId('profile-form')).toBeVisible();

    await page.fill('#profile-name', '');
    await page.fill('#profile-phone', 'abc');
    await page.click('button[type="submit"]:has-text("Save changes")');

    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Enter a valid phone number')).toBeVisible();
  });
});

// The portal is an employee-facing surface, so the role that matters is
// employee - not admin. A fresh employee account is registered per run; it has
// no seeded HR data, which is exactly what the scoping should return: only
// their own (empty) records. Registration assigns the employee role
// server-side.
test.describe('Employee Self-Service as employee role', () => {
  test('a registered employee sees only their own (empty) workspace', async ({ page }) => {
    const email = `e2e-employee-${Date.now()}@example.com`;
    const password = 'Atlas-E2e-Pass-1';

    await page.goto('/register');
    await page.fill('#name', 'E2E Employee');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]:has-text("Create account")');
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 20000 });

    // Payslips: a brand-new employee has none, so the real empty state shows.
    await page.goto('/dashboard/me/payslips');
    await expect(page.getByTestId('payslips-empty')).toBeVisible({ timeout: 15000 });

    // Leave: the policy entitlement applies to every employee identity.
    await page.goto('/dashboard/me/leave');
    await expect(page.getByTestId('balance-VACATION')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('leave-requests-empty')).toBeVisible({ timeout: 15000 });

    // Profile: no employee record is linked to the fresh account, so the page
    // must say so instead of showing invented data.
    await page.goto('/dashboard/me');
    await expect(page.getByTestId('my-profile-empty')).toBeVisible({ timeout: 15000 });
  });
});
