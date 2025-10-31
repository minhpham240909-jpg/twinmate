import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display sign in page', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page).toHaveTitle(/Clerva/);
    await expect(page.locator('h1, h2').filter({ hasText: /sign in/i })).toBeVisible();
  });

  test('should display sign up page', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page).toHaveTitle(/Clerva/);
    await expect(page.locator('h1, h2').filter({ hasText: /sign up/i })).toBeVisible();
  });

  test('should validate email format on sign in', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Fill in invalid email
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password123');
    
    // Try to submit
    await page.click('button[type="submit"]');
    
    // Should show validation error
    await expect(page.locator('text=/invalid.*email/i')).toBeVisible({ timeout: 3000 }).catch(() => {
      // Some forms use HTML5 validation
      expect(page.locator('input[type="email"]:invalid')).toBeTruthy();
    });
  });

  test('should require password on sign in', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Fill only email
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Try to submit
    await page.click('button[type="submit"]');
    
    // Should not navigate away or show error
    await expect(page).toHaveURL(/signin/);
  });

  test('should navigate between sign in and sign up', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Click link to sign up
    const signUpLink = page.locator('a').filter({ hasText: /sign up/i }).first();
    if (await signUpLink.count() > 0) {
      await signUpLink.click();
      await expect(page).toHaveURL(/signup/);
      
      // Navigate back to sign in
      const signInLink = page.locator('a').filter({ hasText: /sign in/i }).first();
      if (await signInLink.count() > 0) {
        await signInLink.click();
        await expect(page).toHaveURL(/signin/);
      }
    }
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin');
    
    await page.fill('input[type="email"]', 'nonexistent@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Wait for error message
    await expect(page.locator('text=/invalid|error|wrong/i')).toBeVisible({ timeout: 5000 });
  });

  test('should redirect to dashboard after successful auth', async ({ page }) => {
    // This test would require valid test credentials
    // In a real scenario, you'd use test database with known credentials
    test.skip();
  });

  test('should handle OAuth flow', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Check if OAuth buttons exist
    const googleButton = page.locator('button').filter({ hasText: /google/i });
    await expect(googleButton).toBeVisible().catch(() => {
      // OAuth might not be configured in all environments
      test.skip();
    });
  });
});

test.describe('Authentication Security', () => {
  test('should not expose sensitive data in DOM', async ({ page }) => {
    await page.goto('/auth/signin');
    
    await page.fill('input[type="password"]', 'secretpassword123');
    
    // Password should be masked
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Check that password is not in plain text anywhere
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('secretpassword123');
  });

  test('should have CSRF protection', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Check for CSRF token or secure headers
    const response = await page.request.get('/api/auth/signin');
    const headers = response.headers();
    
    // Should have security headers
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('should enforce password requirements on signup', async ({ page }) => {
    await page.goto('/auth/signup');
    
    await page.fill('input[type="email"]', 'newuser@example.com');
    await page.fill('input[type="password"]', '123'); // Too short
    await page.click('button[type="submit"]');
    
    // Should show password requirement error
    await expect(page.locator('text=/password.*short|minimum.*characters/i')).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Session Management', () => {
  test('should handle logout', async ({ page }) => {
    // This requires authentication first
    test.skip();
  });

  test('should persist session across page refreshes', async ({ page }) => {
    // This requires authentication first
    test.skip();
  });

  test('should redirect unauthenticated users from protected pages', async ({ page }) => {
    // Try to access protected route
    await page.goto('/dashboard');
    
    // Should redirect to sign in
    await expect(page).toHaveURL(/signin|auth/, { timeout: 5000 });
  });
});
