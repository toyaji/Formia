import { test, expect } from '@playwright/test';

test.describe('Workspace Flow', () => {
  test('should navigate to dashboard and show forms list', async ({ page }) => {
    // 1. Visit Dashboard
    await page.goto('/dashboard');
    
    // 2. Check for Logo and Title
    await expect(page.locator('span:has-text("Formia")')).toBeVisible();
    await expect(page.locator('h1')).toContainText('워크스페이스');
    
    // 3. Verify Empty State or List
    const emptyState = page.locator('text=생성된 폼이 없습니다');
    const formItems = page.locator('[class*="formItem"]');
    
    await expect(emptyState.or(formItems.first())).toBeVisible();
  });

  test('should simulate creating a new form', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Click "New Form" button (matches "새 신청 폼 만들기")
    const newFormBtn = page.locator('button:has-text("새 신청 폼 만들기")');
    await expect(newFormBtn).toBeVisible();
    
    // Click and expect navigation to editor (URL should be root /)
    await newFormBtn.click();
    await expect(page).toHaveURL('/');
    
    // Check if editor header is visible (Title should be "새 설문")
    await expect(page.locator('span:has-text("새 설문")').first()).toBeVisible();
  });
});
