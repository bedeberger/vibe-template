// E2E: the pre-auth login page (public/login.html + js/login.js) against the
// auth mocks (tests/mocks/auth-users.js). Not a registry feature — it runs
// without a session and without the SPA shell (docs/auth.md).

const { test, expect } = require('./_helpers/fixtures');

test.beforeEach(async ({ request }) => {
  await request.post('/__mock/reset');
});

async function open(page) {
  await page.goto('/login.html');
  await expect(page.locator('#login-email')).toBeVisible();
}

test('local method: password form, no SSO button, no dev button', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mit Single Sign-on anmelden' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Weiter als Dev-User' })).toBeHidden();
});

test('oidc method: SSO button plus the admin form', async ({ page, request }) => {
  await request.post('/__mock/methods', { data: { method: 'oidc', adminLogin: true, devMode: false } });
  await open(page);
  await expect(page.getByRole('heading', { name: 'Admin-Anmeldung' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mit Single Sign-on anmelden' })).toBeVisible();
});

test('wrong password and disabled account show translated errors', async ({ page }) => {
  await open(page);
  await page.fill('#login-email', 'anna@local');
  await page.fill('#login-password', 'falsch');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('.card-form-error:visible')).toHaveText('E-Mail oder Passwort stimmt nicht.');
  await page.fill('#login-password', 'gesperrt-passwort-1');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('.card-form-error:visible')).toHaveText('Dieses Konto ist gesperrt.');
});

test('initial password → change form → re-authenticated change → redirect', async ({ page }) => {
  await open(page);
  await page.fill('#login-email', 'anna@local');
  await page.fill('#login-password', 'initial-passwort-1');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('heading', { name: 'Eigenes Passwort setzen' })).toBeVisible();

  await page.fill('#login-new', 'annas-eigenes-pw-1');
  await page.fill('#login-repeat', 'tippfehler');
  await page.getByRole('button', { name: 'Passwort speichern' }).click();
  await expect(page.locator('.card-form-error:visible')).toHaveText('Die beiden Passwörter stimmen nicht überein.');

  await page.fill('#login-repeat', 'annas-eigenes-pw-1');
  // Checked on the request itself — the mock state is shared across workers.
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().endsWith('/auth/password') && r.method() === 'POST'),
    page.waitForURL((u) => u.pathname === '/'),
    page.getByRole('button', { name: 'Passwort speichern' }).click(),
  ]);
  expect(req.postDataJSON()).toEqual({ email: 'anna@local', password: 'initial-passwort-1', newPassword: 'annas-eigenes-pw-1' });
});

// Phone width: the pre-auth page has no SPA shell, so the smoke's phone pass
// never sees it — its own check (DESIGN.md → Mobile).
test.describe('phone viewport', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('login form fits 360px without horizontal scroll', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `login page overflows by ${overflow}px at 360px`).toBeLessThanOrEqual(0);
  });
});

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 360, height: 780 } });
  test('login and change form fit 360px without horizontal scroll', async ({ page }) => {
    await open(page);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.fill('#login-email', 'anna@local');
    await page.fill('#login-password', 'initial-passwort-1');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.locator('#login-new')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});
