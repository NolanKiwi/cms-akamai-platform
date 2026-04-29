import { expect, test } from '@playwright/test';

const BASE = process.env.BASE_URL || 'https://dimicms.duckdns.org';
const API = `${BASE}/api/v1`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@dimicms.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Dimicms123!@#';

test.describe('dimi-cms smoke', () => {
  test('public health is ok', async ({ request }) => {
    const r = await request.get(`${API}/health`);
    expect(r.ok()).toBeTruthy();
    const json = await r.json();
    expect(json.status).toBe('ok');
  });

  test('swagger is published', async ({ request }) => {
    const r = await request.get(`${BASE}/api/docs`);
    expect(r.status()).toBe(200);
  });

  test('login flow lands on dashboard', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`);
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('sites list is reachable for an authed user', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`);
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
    await page.goto(`${BASE}/sites`);
    await expect(page.getByRole('heading', { name: 'Sites' })).toBeVisible();
  });
});
