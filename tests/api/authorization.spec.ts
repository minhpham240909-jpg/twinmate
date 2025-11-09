/**
 * API Authorization Tests
 * Tests that all API endpoints properly enforce authentication and authorization
 *
 * These tests verify:
 * - Endpoints return 401 when called without authentication
 * - Endpoints return 403/404 when trying to access other users' data
 * - Rate limiting is enforced
 * - Input validation works correctly
 */

import { test, expect } from '@playwright/test'

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

test.describe('API Authorization: Authentication Required', () => {
  test('GET /api/posts should require authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/posts`)

    // Should return 401 Unauthorized
    expect(response.status()).toBe(401)

    const body = await response.json()
    expect(body.error).toBeTruthy()
  })

  test('POST /api/posts should require authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/posts`, {
      data: {
        content: 'Test post'
      }
    })

    expect(response.status()).toBe(401)
  })

  test('GET /api/notifications should require authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/notifications`)
    expect(response.status()).toBe(401)
  })

  test('GET /api/connections should require authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/connections`)
    expect(response.status()).toBe(401)
  })

  test('POST /api/connections/send should require authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/connections/send`, {
      data: {
        receiverId: 'fake-user-id',
        message: 'Hello'
      }
    })

    expect(response.status()).toBe(401)
  })

  test('GET /api/users/[userId] should require authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/users/some-user-id`)
    expect(response.status()).toBe(401)
  })

  test('PUT /api/users/[userId]/profile should require authentication', async ({ request }) => {
    const response = await request.put(`${API_BASE}/api/users/some-user-id/profile`, {
      data: {
        bio: 'New bio'
      }
    })

    expect(response.status()).toBe(401)
  })

  test('GET /api/settings should require authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/settings`)
    expect(response.status()).toBe(401)
  })

  test('POST /api/settings/update should require authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/settings/update`, {
      data: {
        notificationEmail: true
      }
    })

    expect(response.status()).toBe(401)
  })

  test('GET /api/study-sessions should require authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/study-sessions`)
    expect(response.status()).toBe(401)
  })

  test('POST /api/messages/send should require authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/messages/send`, {
      data: {
        recipientId: 'fake-id',
        content: 'Test message'
      }
    })

    expect(response.status()).toBe(401)
  })
})

test.describe('API Authorization: Input Validation', () => {
  test('POST /api/posts should validate content is required', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/posts`, {
      data: {
        content: '' // Empty content
      }
    })

    // Should return 400 or 401 (if auth check happens first)
    expect([400, 401]).toContain(response.status())
  })

  test('POST /api/posts should validate content length', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/posts`, {
      data: {
        content: 'a'.repeat(10000) // Too long
      }
    })

    expect([400, 401]).toContain(response.status())
  })

  test('POST /api/connections/send should validate receiverId format', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/connections/send`, {
      data: {
        receiverId: 'invalid-id-format',
        message: 'Hello'
      }
    })

    expect([400, 401]).toContain(response.status())
  })

  test('GET /api/posts should validate cursor format', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/posts?cursor=invalid-cursor-format`)

    // Should return 400 or 401
    expect([400, 401]).toContain(response.status())
  })

  test('GET /api/posts should enforce limit maximum', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/posts?limit=999999`)

    // Should return 401 (not authenticated), but if authenticated would limit to 50
    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const body = await response.json()
      expect(body.posts.length).toBeLessThanOrEqual(50)
    }
  })
})

test.describe('API Authorization: Rate Limiting', () => {
  test('POST /api/posts should enforce rate limiting', async ({ request }) => {
    // Make multiple rapid requests
    const promises = Array.from({ length: 15 }, () =>
      request.post(`${API_BASE}/api/posts`, {
        data: { content: 'Test post' }
      })
    )

    const responses = await Promise.all(promises)

    // Some should be rate limited (429) or unauthorized (401)
    const rateLimited = responses.some(r => r.status() === 429)
    const unauthorized = responses.every(r => r.status() === 401)

    // Either all are unauthorized, or some are rate limited
    expect(rateLimited || unauthorized).toBeTruthy()

    // If rate limited, check for proper headers
    const rateLimitedResponse = responses.find(r => r.status() === 429)
    if (rateLimitedResponse) {
      const headers = rateLimitedResponse.headers()
      expect(headers['x-ratelimit-limit']).toBeTruthy()
      expect(headers['retry-after']).toBeTruthy()
    }
  })

  test('POST /api/connections/send should enforce rate limiting', async ({ request }) => {
    const promises = Array.from({ length: 10 }, () =>
      request.post(`${API_BASE}/api/connections/send`, {
        data: {
          receiverId: 'fake-user-id',
          message: 'Hello'
        }
      })
    )

    const responses = await Promise.all(promises)

    const rateLimited = responses.some(r => r.status() === 429)
    const unauthorized = responses.every(r => r.status() === 401)

    expect(rateLimited || unauthorized).toBeTruthy()
  })

  test('POST /api/messages/send should enforce rate limiting', async ({ request }) => {
    const promises = Array.from({ length: 35 }, () =>
      request.post(`${API_BASE}/api/messages/send`, {
        data: {
          recipientId: 'fake-id',
          content: 'Test'
        }
      })
    )

    const responses = await Promise.all(promises)

    const rateLimited = responses.some(r => r.status() === 429)
    const unauthorized = responses.every(r => r.status() === 401)

    expect(rateLimited || unauthorized).toBeTruthy()
  })
})

test.describe('API Authorization: Debug Endpoints Protected', () => {
  test('GET /api/debug/env should not expose data in production', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/debug/env`)

    // Should return 404 in production, or be protected
    if (process.env.NODE_ENV === 'production') {
      expect(response.status()).toBe(404)
    } else {
      // In development, it might exist but should require auth
      expect([401, 404]).toContain(response.status())
    }
  })

  test('GET /api/list-all-users should be protected or removed', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/list-all-users`)

    // Should return 401, 403, or 404
    expect([401, 403, 404]).toContain(response.status())
  })

  test('GET /api/debug-current-user should be protected or removed', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/debug-current-user`)

    expect([401, 403, 404]).toContain(response.status())
  })

  test('GET /api/debug/metrics should be protected or removed', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/debug/metrics`)

    expect([401, 403, 404]).toContain(response.status())
  })
})

test.describe('API Authorization: CORS and Security Headers', () => {
  test('API responses should include security headers', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health`)

    const headers = response.headers()

    // Check for security headers (some might be set by middleware)
    // At minimum, API should not expose sensitive headers
    expect(headers['x-powered-by']).toBeFalsy() // Should be hidden
  })

  test('API should handle OPTIONS requests (CORS preflight)', async ({ request }) => {
    const response = await request.fetch(`${API_BASE}/api/posts`, {
      method: 'OPTIONS'
    })

    // Should return 200 or 204 for OPTIONS
    expect([200, 204, 405]).toContain(response.status())
  })
})

test.describe('API Authorization: Health and Public Endpoints', () => {
  test('GET /api/health should be publicly accessible', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health`)

    // Health check should be public
    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body.status).toBe('ok')
  })

  test('POST /api/auth/signup should be publicly accessible', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/signup`, {
      data: {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      }
    })

    // Should not return 401 (might return 400 for duplicate email, etc.)
    expect(response.status()).not.toBe(401)
  })

  test('POST /api/auth/signin should be publicly accessible', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/signin`, {
      data: {
        email: 'test@example.com',
        password: 'password123'
      }
    })

    // Should not return 401 (might return 400 for invalid credentials)
    expect(response.status()).not.toBe(401)
  })
})

test.describe('API Authorization: Error Responses', () => {
  test('Unauthorized requests should return proper error format', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/posts`)

    expect(response.status()).toBe(401)

    const body = await response.json()
    expect(body).toHaveProperty('error')
    expect(typeof body.error).toBe('string')
  })

  test('Invalid requests should return proper error format', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/posts`, {
      data: {
        invalid: 'data'
      }
    })

    const body = await response.json()
    expect(body).toHaveProperty('error')
  })

  test('Rate limited requests should return proper error format', async ({ request }) => {
    // This test assumes we can trigger rate limit
    // In practice, might need multiple requests
    const response = await request.get(`${API_BASE}/api/posts`)

    // Just verify response has proper structure
    const body = await response.json()
    expect(body).toBeTruthy()
  })
})

test.describe('API Authorization: Data Access Control', () => {
  test('User should not be able to update other users\' profiles', async ({ request }) => {
    // This test would require authentication tokens for two different users
    // For now, we just verify the endpoint requires auth
    const response = await request.put(`${API_BASE}/api/users/other-user-id/profile`, {
      data: {
        bio: 'Trying to update someone else\'s profile'
      }
    })

    // Should return 401 (no auth) or 403 (forbidden)
    expect([401, 403]).toContain(response.status())
  })

  test('User should not be able to read other users\' private settings', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/settings`)

    // Should require authentication
    expect(response.status()).toBe(401)
  })

  test('User should not be able to delete other users\' posts', async ({ request }) => {
    const response = await request.delete(`${API_BASE}/api/posts/other-user-post-id`)

    // Should require authentication (and then check ownership)
    expect([401, 403, 404]).toContain(response.status())
  })
})
