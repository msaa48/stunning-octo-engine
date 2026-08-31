const { test, expect } = require('@playwright/test');

const URL = process.env.DEPLOYED_URL || 'https://msaa48.github.io/stunning-octo-engine/';

const ROLE_CARD = {
  admin: 'المدير',
  teacher: 'المدرّس',
  parent: 'ولي الأمر',
};

async function login(page, role, email, password) {
  await page.goto(URL);
  await page.getByText(ROLE_CARD[role], { exact: true }).click();
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'دخول' }).click();
}

test('تسجيل دخول أدمن', async ({ page }) => {
  await login(page, 'admin', 'admin@masar-centers.demo', 'Admin@12345');
  await expect(page.locator('#login-screen')).not.toHaveClass(/active/, { timeout: 10000 });
});

test('تسجيل دخول مدرّس', async ({ page }) => {
  await login(page, 'teacher', 'teacher1@masar-centers.demo', 'Teacher1@2025');
  await expect(page.locator('#teacher-tab-log')).toBeVisible({ timeout: 10000 });
});

test('تسجيل دخول ولي أمر', async ({ page }) => {
  await login(page, 'parent', 'parent1@masar-centers.demo', 'Parent1@2025');
  await expect(page.locator('#parent-tab-log')).toBeVisible({ timeout: 10000 });
});

test('تبديل الوضع الليلي', async ({ page }) => {
  await page.goto(URL);
  const themeToggle = page.locator('.theme-toggle');
  await expect(themeToggle).toBeVisible();

  // أول نقرة: يجب أن يضيف السمة "dark"
  await themeToggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // ثانية نقرة: يجب أن يزيل السمة مرة أخرى (الوضع الافتراضي هو light)
  await themeToggle.click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
});

test('تبديل إظهار كلمة المرور في شاشة الدخول', async ({ page }) => {
  await page.goto(URL);
  await page.getByText(ROLE_CARD.admin, { exact: true }).click();
  const passwordInput = page.locator('#login-password');
  await expect(passwordInput).toHaveAttribute('type', 'password');

  const eyeToggle = page.locator('#email-login-form .pw-eye');
  await expect(eyeToggle).toBeVisible();
  await eyeToggle.click();

  await expect(passwordInput).toHaveAttribute('type', 'text');
});