/**
 * Unit tests for AI Agent Chat API Route
 * Tests environment variable validation and error handling
 * @jest-environment node
 */

import { POST } from '../chat/route'

// Mock Next.js Request for Node environment
class MockNextRequest {
  private _body: string

  constructor(private options: { method: string; body: string; headers?: HeadersInit }) {
    this._body = options.body
  }

  async json() {
    return JSON.parse(this._body)
  }

  get headers() {
    return new Map(Object.entries(this.options.headers || {}))
  }

  get method() {
    return this.options.method
  }
}

// Helper to create mock requests
function createMockRequest(body: any) {
  return new MockNextRequest({
    method: 'POST',
    body: JSON.stringify(body),
  }) as any
}

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
    },
  })),
}))

// Mock Supabase client creation
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}))

// Store original env vars
const originalEnv = process.env

describe('AI Agent Chat API - Environment Variable Validation', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original env vars
    process.env = originalEnv
  })

  it('should return 503 when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    // Remove NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
    process.env.OPENAI_API_KEY = 'test-openai-key'

    const request = createMockRequest({ message: 'Hello' })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.error).toBe('Service unavailable')
    expect(data.message).toBe('AI agent is not properly configured')
    expect(data.missing).toContain('NEXT_PUBLIC_SUPABASE_URL')
  })

  it('should return 503 when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.OPENAI_API_KEY = 'test-openai-key'

    const request = createMockRequest({ message: 'Hello' })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.error).toBe('Service unavailable')
    expect(data.missing).toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('should return 503 when OPENAI_API_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
    delete process.env.OPENAI_API_KEY

    const request = createMockRequest({ message: 'Hello' })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.error).toBe('Service unavailable')
    expect(data.missing).toContain('OPENAI_API_KEY')
  })

  it('should return 503 with all missing env vars listed when multiple are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.OPENAI_API_KEY

    const request = createMockRequest({ message: 'Hello' })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.error).toBe('Service unavailable')
    expect(data.missing).toHaveLength(3)
    expect(data.missing).toContain('NEXT_PUBLIC_SUPABASE_URL')
    expect(data.missing).toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(data.missing).toContain('OPENAI_API_KEY')
  })

  it('should not call OpenAI when env vars are missing', async () => {
    // Mock fetch to track if OpenAI API is called
    const fetchMock = jest.spyOn(global, 'fetch')

    delete process.env.OPENAI_API_KEY
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

    const request = createMockRequest({ message: 'Hello' })

    await POST(request)

    // OpenAI API should NOT be called
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('openai.com'),
      expect.anything()
    )

    fetchMock.mockRestore()
  })

  it('should proceed normally when all required env vars are present', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
    process.env.OPENAI_API_KEY = 'test-openai-key'

    const request = createMockRequest({ message: 'Hello' })

    const response = await POST(request)

    // Should NOT be a 503 error
    expect(response.status).not.toBe(503)

    // Should proceed to next validation (rate limit, auth, etc.)
    // We expect it to fail at some other point (that's okay for this test)
    // The important thing is it passed env validation
  })
})

describe('AI Agent Chat API - Environment Validation Logging', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should log missing env vars server-side', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    delete process.env.OPENAI_API_KEY
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

    const request = createMockRequest({ message: 'Hello' })

    await POST(request)

    // Should log the missing variables
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[AI Agent] Missing required environment variables:',
      expect.arrayContaining(['OPENAI_API_KEY'])
    )

    consoleErrorSpy.mockRestore()
  })
})
