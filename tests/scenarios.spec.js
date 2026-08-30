const { test, expect } = require('@playwright/test');

const URL = process.env.DEPLOYED_URL || 'https://msaa48.github.io/stunning-octo-engine/';

async function login(page, email, password) {
  await page.goto(URL);
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'دخول' }).click();
}

test('تسجيل دخول أدمن', async ({ page }) => {
  await login(page, 'admin@masar-centers.demo', 'Admin@12345');
  await expect(page.locator('#login-screen')).not.toHaveClass(/active/, { timeout: 10000 });
});

test('تسجيل دخول مدرّس', async ({ page }) => {
  await login(page, 'teacher1@masar-centers.demo', 'Teacher1@2025');
  await expect(page.locator('#teacher-tab-log')).toBeVisible({ timeout: 10000 });
});

test('تسجيل دخول ولي أمر', async ({ page }) => {
  await login(page, 'parent1@masar-centers.demo', 'Parent1@2025');
  await expect(page.locator('#parent-tab-log')).toBeVisible({ timeout: 10000 });
});
