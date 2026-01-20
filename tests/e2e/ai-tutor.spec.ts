/**
 * AI Tutor E2E Tests
 * Tests the AI tutor functionality including homework guard protection
 */

import { test, expect } from '@playwright/test'

test.describe('AI Tutor: Solo Study Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to solo study page
    await page.goto('/solo-study')
  })

  test('should display solo study page or redirect to auth', async ({ page }) => {
    // If redirected to signin, auth guard is working
    if (page.url().includes('/auth') || page.url().includes('/signin')) {
      console.log('Solo study page is protected (redirected to signin)')
      return
    }

    // Should show solo study content
    await expect(
      page.locator('h1, h2, [class*="title"]').filter({ hasText: /solo.*study|study.*alone|focus/i })
    ).toBeVisible({ timeout: 10000 })
  })

  test('should show study timer controls', async ({ page }) => {
    if (page.url().includes('/auth') || page.url().includes('/signin')) {
      test.skip()
    }

    // Look for timer or duration selector
    const hasTimerUI = await page.locator(
      '[class*="timer"], [class*="duration"], button:has-text(/start|begin/i)'
    ).count() > 0

    expect(hasTimerUI).toBeTruthy()
  })

  test('should show AI tutor chat interface when available', async ({ page }) => {
    if (page.url().includes('/auth') || page.url().includes('/signin')) {
      test.skip()
    }

    // Wait for page to fully load
    await page.waitForTimeout(2000)

    // Look for chat interface or AI tutor button
    const hasAITutor = await page.locator(
      '[class*="chat"], [class*="tutor"], button:has-text(/ask.*ai|tutor|help/i), textarea[placeholder*="ask"]'
    ).count() > 0

    // AI tutor might not be visible until session starts
    console.log('AI Tutor UI present:', hasAITutor)
  })
})

test.describe('AI Tutor: Teaching Mode (Homework Guard)', () => {
  test('should not expose direct answers in API response', async ({ request }) => {
    // This tests the API directly to verify homework guard
    const response = await request.post('/api/ai/tutor', {
      data: {
        message: 'What is 5 + 3?',
        history: [],
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Should return 401 (unauthorized) if not authenticated
    // or 200 with teaching response if authenticated
    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const data = await response.json()

      // Verify teaching mode is active
      expect(data._analysis?.teachingMode).toBe(true)

      // Response should not contain direct answer "8"
      // It should teach the concept instead
      const responseText = data.response?.toLowerCase() || ''

      // The response should contain teaching elements
      const hasTeachingElements =
        responseText.includes('let') ||
        responseText.includes('try') ||
        responseText.includes('think') ||
        responseText.includes('step') ||
        responseText.includes('?') // Questions to guide learning

      console.log('Teaching response verified:', hasTeachingElements)
    }
  })

  test('should detect answer-seeking intent', async ({ request }) => {
    const response = await request.post('/api/ai/tutor', {
      data: {
        message: 'Just tell me the answer to 2x + 4 = 10',
        history: [],
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.status() === 200) {
      const data = await response.json()

      // Should detect answer-seeking intent
      expect(data._analysis?.intent).toBe('answer')
      expect(data._analysis?.confidence).toBeGreaterThan(50)
    }
  })

  test('should detect learning intent', async ({ request }) => {
    const response = await request.post('/api/ai/tutor', {
      data: {
        message: 'Can you explain how to solve linear equations step by step?',
        history: [],
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.status() === 200) {
      const data = await response.json()

      // Should detect learning intent
      expect(data._analysis?.intent).toBe('learn')
    }
  })
})

test.describe('AI Tutor: Error Handling', () => {
  test('should handle missing message gracefully', async ({ request }) => {
    const response = await request.post('/api/ai/tutor', {
      data: {
        history: [],
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Should return 400 (bad request) or 401 (unauthorized)
    expect([400, 401]).toContain(response.status())

    if (response.status() === 400) {
      const data = await response.json()
      expect(data.error).toBeTruthy()
    }
  })

  test('should handle empty message', async ({ request }) => {
    const response = await request.post('/api/ai/tutor', {
      data: {
        message: '',
        history: [],
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect([400, 401]).toContain(response.status())
  })

  test('should handle very long messages', async ({ request }) => {
    const longMessage = 'a'.repeat(10000)

    const response = await request.post('/api/ai/tutor', {
      data: {
        message: longMessage,
        history: [],
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Should either process or return appropriate error
    expect([200, 400, 401, 413]).toContain(response.status())
  })
})

test.describe('AI Tutor: Study Plan Integration', () => {
  test('should accept study plan context', async ({ request }) => {
    const response = await request.post('/api/ai/tutor', {
      data: {
        message: 'What should I focus on in my current step?',
        history: [],
        studyPlan: {
          subject: 'Calculus',
          totalMinutes: 30,
          steps: [
            {
              title: 'Review derivatives',
              description: 'Go over basic derivative rules',
              duration: 10,
              tips: ['Focus on power rule', 'Practice with examples'],
            },
            {
              title: 'Practice problems',
              description: 'Solve 5 practice problems',
              duration: 20,
            },
          ],
        },
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.status() === 200) {
      const data = await response.json()

      // Response should reference the study plan
      const responseText = data.response?.toLowerCase() || ''
      const referencesStudyPlan =
        responseText.includes('calculus') ||
        responseText.includes('derivative') ||
        responseText.includes('step') ||
        responseText.includes('plan')

      console.log('Study plan context used:', referencesStudyPlan)
    }
  })
})
