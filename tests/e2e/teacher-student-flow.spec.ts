import { test, expect } from '@playwright/test'

/**
 * E2E tests for Teacher + Student core flows
 * 
 * Prerequisites:
 * - Supabase configured with environment variables
 * - Database migrated with multi-tenant schema
 * - Test users created: one teacher, one student
 */

test.describe('Teacher Flow', () => {
  test.skip('teacher can create a course and add lessons', async ({ page }) => {
    // 1. Sign in as teacher
    await page.goto('/teacher')
    // (Auth flow depends on your Supabase setup; skipped for now)
    
    // 2. Create course
    await page.click('text=Create course')
    await page.fill('input[placeholder*="title"]', 'Test Course')
    await page.fill('input[placeholder*="Math"]', 'Mathematics')
    await page.fill('input[placeholder*="9"]', '9')
    await page.click('button:has-text("Create")')
    
    // 3. Verify course appears
    await expect(page.locator('text=Test Course')).toBeVisible()
    
    // 4. Open course and add lesson
    await page.click('text=Test Course')
    await page.click('button:has-text("New lesson")')
    // Prompt-based; would need mocking or alternative approach
    
    // 5. Open lesson editor
    // await page.click('text=Lesson 1')
    // await expect(page.locator('text=Editor')).toBeVisible()
  })
})

test.describe('Student Flow', () => {
  test.skip('student can join course via code and view lessons', async ({ page }) => {
    // 1. Sign in as student
    await page.goto('/student')
    
    // 2. Join course with code (assumes a course exists with known join code)
    const joinCode = 'ABC123'
    await page.fill('input[placeholder*="join code"]', joinCode)
    await page.click('button:has-text("Join")')
    
    // 3. Verify enrollment
    await expect(page.locator('text=Test Course')).toBeVisible()
    
    // 4. Open course and view lesson
    await page.click('text=Test Course')
    await page.click('text=Lesson 1')
    
    // 5. Verify slide viewer
    await expect(page.locator('text=Slide 1')).toBeVisible()
  })
})

/**
 * Notes:
 * - These tests are skipped by default because they require:
 *   1. A running dev server
 *   2. A seeded database with test users
 *   3. Auth mocking or real sign-in flow
 * 
 * To run:
 * 1. Set up test database and users
 * 2. Remove .skip() from tests
 * 3. Run: npx playwright test
 */

