const { test, expect } = require('@playwright/test');

const URL = process.env.DEPLOYED_URL || 'https://msaa48.github.io/stunning-octo-engine/';

const ROLE_CARD = {
  admin: 'المدير',
  teacher: 'المدرّس',
  parent: 'ولي الأمر',
};

async function login(page, role, email, password) {
  await page.goto(URL + (URL.includes('?') ? '&' : '?') + 'nocache=' + Date.now());
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

/* ================= الدخول بالنيابة (Impersonation) — أضيفت 8 سبتمبر ================= */

test('الأدمن يشوف شاشة مدرّس بالنيابة وبانر الرجوع شغال', async ({ page }) => {
  const tLoginStart = Date.now();
  await login(page, 'admin', 'admin@masar-centers.demo', 'Admin@12345');
  await expect(page.locator('#login-screen')).not.toHaveClass(/active/, { timeout: 10000 });
  const tLoginDone = Date.now();

  // ننتظر لحد ما handleEmailLogin تخلص فعليًا (afterFetch=true) أو نوصل لحد أقصى 8 ثواني تشخيصية
  let waitedMs = 0;
  let loginState = null;
  while(waitedMs < 8000){
    loginState = await page.evaluate(() => window.__loginDiag || null);
    if(loginState && (loginState.afterFetch || loginState.path)) break;
    await page.waitForTimeout(250);
    waitedMs += 250;
  }
  console.log('WAIT_LOOP:', JSON.stringify({ waitedMs, loginState }));

  const diag = await page.evaluate(() => {
    let evalError = null;
    try { openAdminSection('teachers'); }
    catch(e){ evalError = (e && e.stack) ? e.stack : String(e); }
    const activeScreen = document.querySelector('.screen.active');
    const panel = document.getElementById('admin-list-panel');
    return {
      evalError,
      activeScreenId: activeScreen ? activeScreen.id : null,
      typeofFn: typeof window.openAdminSection,
      panelHtmlLen: panel ? panel.innerHTML.length : null,
      panelHtmlSnippet: panel ? panel.innerHTML.slice(0,300) : null,
      teachersCount: (typeof loadDB === 'function') ? loadDB().teachers.length : 'loadDB not found',
      teachersClaimed: (typeof loadDB === 'function') ? loadDB().teachers.map(t=>({id:t.id,claimedBy: t.claimedBy===undefined ? '__UNDEFINED__' : t.claimedBy})) : null,
      fetchDiag: window.__fetchDiag || null,
      loginDiag: window.__loginDiag || null,
      buildMarker: window.APP_BUILD_MARKER || null,
      unexpectedError: (window.__loginDiag && window.__loginDiag.unexpectedError) || null,
      currentUrl: window.location.href,
      readyState: document.readyState,
      perfNavEntries: (performance.getEntriesByType && performance.getEntriesByType('navigation').length) || 0
    };
  });
  console.log('DIAG:', JSON.stringify(diag, null, 2));
  console.log('TIMING:', JSON.stringify({ tLoginStart, tLoginDone, gapMs: tLoginDone - tLoginStart, nowAtEval: Date.now() }));
  await page.waitForTimeout(500);

  const viewAsBtn = page.getByText('👁 عرض كشاشته').first();
  await expect(viewAsBtn).toBeVisible({ timeout: 10000 });
  await viewAsBtn.click();

  // البانر الأصفر لازم يظهر فوق شاشة المدرّس
  await expect(page.locator('#impersonation-banner')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#teacher-screen')).toHaveClass(/active/);

  // الرجوع خطوة واحدة لازم يرجّع للوحة الأدمن، والبانر يختفي
  await page.getByText('🔙 رجوع خطوة').click();
  await expect(page.locator('#admin-screen')).toHaveClass(/active/, { timeout: 10000 });
  await expect(page.locator('#impersonation-banner')).toBeHidden();
});

test('Super Admin يدخل كأدمن مؤسسة ثم يرجع خطوة واحدة', async ({ page }) => {
  await login(page, 'admin', 'owner@masar-centers.demo', 'Owner@12345');
  await expect(page.locator('#super-admin-screen')).toHaveClass(/active/, { timeout: 10000 });

  const viewAsAdminBtn = page.getByText('👁 دخول كأدمن').first();
  await expect(viewAsAdminBtn).toBeVisible({ timeout: 10000 });
  await viewAsAdminBtn.click();

  await expect(page.locator('#impersonation-banner')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#admin-screen')).toHaveClass(/active/);

  await page.getByText('🔙 رجوع خطوة').click();
  await expect(page.locator('#super-admin-screen')).toHaveClass(/active/, { timeout: 10000 });
  await expect(page.locator('#impersonation-banner')).toBeHidden();
});

test('زر الخروج الحقيقي (بدون impersonation) يرجع لشاشة الدخول', async ({ page }) => {
  await login(page, 'admin', 'admin@masar-centers.demo', 'Admin@12345');
  await expect(page.locator('#admin-screen')).toHaveClass(/active/, { timeout: 10000 });
  await page.getByRole('button', { name: 'خروج' }).click();
  await expect(page.locator('#login-screen')).toHaveClass(/active/, { timeout: 10000 });
});

/* ================= حسابات إضافية (مدرّس ثانٍ + أسيستنت) ================= */

test('تسجيل دخول مدرّس ثانٍ', async ({ page }) => {
  await login(page, 'teacher', 'teacher2@masar-centers.demo', 'Teacher2@2025');
  await expect(page.locator('#teacher-screen')).toHaveClass(/active/, { timeout: 10000 });
});
