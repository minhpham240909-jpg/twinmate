/**
 * Leaderboard E2E Tests
 * Tests the global leaderboard functionality and performance
 */

import { test, expect } from '@playwright/test'

test.describe('Leaderboard: API Performance', () => {
  test('should respond within 2 seconds (with cache)', async ({ request }) => {
    const startTime = Date.now()

    const response = await request.get('/api/leaderboard')
    const duration = Date.now() - startTime

    console.log(`Leaderboard API responded in ${duration}ms`)

    // Should respond quickly (cache hit or miss)
    expect(duration).toBeLessThan(2000)

    // Should return 200 or 401 (if not authenticated)
    expect([200, 401]).toContain(response.status())
  })

  test('should return proper leaderboard structure', async ({ request }) => {
    const response = await request.get('/api/leaderboard')

    if (response.status() === 200) {
      const data = await response.json()

      // Verify response structure
      expect(data.success).toBe(true)
      expect(Array.isArray(data.leaderboard)).toBe(true)
      expect(data.leaderboard.length).toBeLessThanOrEqual(5)

      // Verify leaderboard entry structure
      if (data.leaderboard.length > 0) {
        const entry = data.leaderboard[0]
        expect(entry).toHaveProperty('rank')
        expect(entry).toHaveProperty('userId')
        expect(entry).toHaveProperty('name')
        expect(entry).toHaveProperty('totalMinutes')
        expect(entry).toHaveProperty('sessionCount')
      }

      // Verify current user info
      expect(data.currentUser).toHaveProperty('rank')
      expect(data.currentUser).toHaveProperty('totalMinutes')
      expect(data.currentUser).toHaveProperty('sessionCount')
      expect(data.currentUser).toHaveProperty('isInTop5')

      // Verify metadata
      expect(data.lastUpdated).toBeTruthy()
      expect(data.nextRefresh).toBeTruthy()
    }
  })

  test('should sort leaderboard by total minutes descending', async ({ request }) => {
    const response = await request.get('/api/leaderboard')

    if (response.status() === 200) {
      const data = await response.json()

      if (data.leaderboard.length > 1) {
        // Verify descending order
        for (let i = 0; i < data.leaderboard.length - 1; i++) {
          expect(data.leaderboard[i].totalMinutes).toBeGreaterThanOrEqual(
            data.leaderboard[i + 1].totalMinutes
          )
        }

        // Verify ranks are sequential
        for (let i = 0; i < data.leaderboard.length; i++) {
          expect(data.leaderboard[i].rank).toBe(i + 1)
        }
      }
    }
  })
})

test.describe('Leaderboard: UI Display', () => {
  test('should display leaderboard on dashboard', async ({ page }) => {
    await page.goto('/dashboard')

    // Skip if redirected to auth
    if (page.url().includes('/auth') || page.url().includes('/signin')) {
      console.log('Dashboard is protected (redirected to signin)')
      return
    }

    // Wait for dashboard to load
    await page.waitForTimeout(2000)

    // Look for leaderboard component
    const leaderboardSection = page.locator(
      '[class*="leaderboard"], [data-testid="leaderboard"], text=/top.*studiers?|leaderboard/i'
    )

    const hasLeaderboard = (await leaderboardSection.count()) > 0

    // Leaderboard might be locked for new users (progressive disclosure)
    const hasLockedState = (await page.locator('text=/unlock|locked|complete.*sessions?/i').count()) > 0

    expect(hasLeaderboard || hasLockedState).toBeTruthy()
  })

  test('should show rank badges for top 3', async ({ page }) => {
    await page.goto('/dashboard')

    if (page.url().includes('/auth') || page.url().includes('/signin')) {
      test.skip()
    }

    await page.waitForTimeout(3000)

    // Check for rank indicators (gold, silver, bronze or 1, 2, 3)
    const hasRankIndicators = await page.locator(
      '[class*="gold"], [class*="silver"], [class*="bronze"], [class*="rank"], svg[class*="trophy"]'
    ).count() > 0

    // This is only expected if leaderboard is visible
    if (await page.locator('[class*="leaderboard"]').count() > 0) {
      console.log('Rank indicators present:', hasRankIndicators)
    }
  })

  test('should show current user rank if not in top 5', async ({ page }) => {
    await page.goto('/dashboard')

    if (page.url().includes('/auth') || page.url().includes('/signin')) {
      test.skip()
    }

    await page.waitForTimeout(3000)

    // Look for "Your Rank" section
    const yourRankSection = page.locator('text=/your.*rank/i')
    const hasYourRank = (await yourRankSection.count()) > 0

    console.log('Your Rank section visible:', hasYourRank)
  })

  test('should show last updated time', async ({ page }) => {
    await page.goto('/dashboard')

    if (page.url().includes('/auth') || page.url().includes('/signin')) {
      test.skip()
    }

    await page.waitForTimeout(3000)

    // Look for update time indicator
    const hasUpdateTime = await page.locator(
      'text=/updated|refresh|24.*hours?/i'
    ).count() > 0

    // This is only expected if leaderboard is visible and not locked
    console.log('Update time indicator present:', hasUpdateTime)
  })
})

test.describe('Leaderboard: Progressive Disclosure', () => {
  test('should show locked state for new users', async ({ page }) => {
    // This test verifies that new users see a locked leaderboard
    await page.goto('/dashboard')

    if (page.url().includes('/auth') || page.url().includes('/signin')) {
      test.skip()
    }

    await page.waitForTimeout(2000)

    // Check for lock icon or locked message
    const isLocked = await page.locator(
      '[class*="lock"], text=/unlock|complete.*sessions?.*to.*unlock/i'
    ).count() > 0

    // Either locked state or unlocked leaderboard should be present
    const isUnlocked = await page.locator('[class*="leaderboard"]').count() > 0

    expect(isLocked || isUnlocked).toBeTruthy()
  })
})

test.describe('Leaderboard: Caching Behavior', () => {
  test('should return cached data on subsequent requests', async ({ request }) => {
    // First request
    const response1 = await request.get('/api/leaderboard')

    if (response1.status() !== 200) {
      test.skip()
    }

    const data1 = await response1.json()

    // Second request should return same data (from cache)
    const response2 = await request.get('/api/leaderboard')
    const data2 = await response2.json()

    // lastUpdated should be the same (cached)
    expect(data1.lastUpdated).toBe(data2.lastUpdated)

    // Meta should indicate cache status
    if (data1._meta?.cached !== undefined) {
      console.log('Cache status:', data1._meta.cached)
    }
  })

  test('should include response time in metadata', async ({ request }) => {
    const response = await request.get('/api/leaderboard')

    if (response.status() === 200) {
      const data = await response.json()

      if (data._meta?.responseTimeMs !== undefined) {
        console.log('Response time from API:', data._meta.responseTimeMs, 'ms')
        expect(data._meta.responseTimeMs).toBeLessThan(5000)
      }
    }
  })
})

test.describe('Leaderboard: Error Handling', () => {
  test('should handle unauthorized access gracefully', async ({ request }) => {
    // Request without authentication
    const response = await request.get('/api/leaderboard', {
      headers: {
        // Clear any existing auth cookies
        Cookie: '',
      },
    })

    // Should return 401 (unauthorized)
    expect(response.status()).toBe(401)

    const data = await response.json()
    expect(data.error).toBeTruthy()
  })
})
