/**
 * API Route Authorization Utilities
 *
 * STANDARDIZED AUTH PATTERN FOR CLERVA API ROUTES
 * ================================================
 *
 * This module provides server-side authentication and authorization for API routes.
 * All API routes should use these utilities for consistent auth handling.
 *
 * FEATURES:
 * - Request-scoped caching (eliminates N+1 queries)
 * - Deactivation checking
 * - Admin/ownership validation
 * - CSRF protection integration
 *
 * RECOMMENDED PATTERNS:
 *
 * 1. Simple authenticated route (RECOMMENDED):
 * ```typescript
 * import { getCurrentUser } from '@/lib/api-auth'
 *
 * export async function GET(request: NextRequest) {
 *   const user = await getCurrentUser()
 *   if (!user) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 *   }
 *   // ... handle request
 * }
 * ```
 *
 * 2. Using wrapper for cleaner code:
 * ```typescript
 * import { withAuth } from '@/lib/api-auth'
 *
 * export const GET = withAuth(async (request, { user }) => {
 *   return NextResponse.json({ userId: user.id })
 * })
 * ```
 *
 * 3. Admin-only routes:
 * ```typescript
 * import { withAdmin } from '@/lib/api-auth'
 *
 * export const DELETE = withAdmin(async (request, { user }) => {
 *   return NextResponse.json({ deleted: true })
 * })
 * ```
 *
 * 4. Resource ownership:
 * ```typescript
 * import { withOwnership } from '@/lib/api-auth'
 *
 * export const PUT = withOwnership(
 *   async (request, { user, resourceOwnerId }) => {
 *     return NextResponse.json({ success: true })
 *   },
 *   { getOwnerId: async (req) => req.params.userId }
 * )
 * ```
 *
 * AVOID:
 * - Direct use of `createClient` for auth in route handlers
 * - Inconsistent error responses for auth failures
 * - Missing deactivation checks
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { User as SupabaseUser } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

export interface AuthenticatedUser {
  id: string
  email: string
  role: string
  isAdmin: boolean
}

export interface AuthContext {
  user: AuthenticatedUser
  supabase: Awaited<ReturnType<typeof createClient>>
}

export interface OwnershipContext extends AuthContext {
  resourceOwnerId: string
}

type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse>

type OwnershipHandler = (
  request: NextRequest,
  context: OwnershipContext
) => Promise<NextResponse>

interface OwnershipOptions {
  getOwnerId: (request: NextRequest, params?: Record<string, string>) => Promise<string | null>
  allowAdmin?: boolean
}

// ============================================================================
// Request-scoped Auth Cache (eliminates N+1 queries)
// ============================================================================

// WeakMap ensures automatic garbage collection when request is done
const authCache = new WeakMap<
  object,
  {
    supabase: Awaited<ReturnType<typeof createClient>>
    supabaseUser: SupabaseUser | null
    dbUser: AuthenticatedUser | null
    resolved: boolean
  }
>()

// Symbol used as cache key for requests without object reference
const REQUEST_CACHE_SYMBOL = Symbol.for('clerva-auth-cache')

// In-memory cache for the current async context (fallback)
let currentRequestCache: {
  supabase?: Awaited<ReturnType<typeof createClient>>
  supabaseUser?: SupabaseUser | null
  dbUser?: AuthenticatedUser | null
  timestamp?: number
} = {}

/**
 * Get or create a cached auth context for the current request
 * This ensures we only make ONE Supabase call and ONE Prisma call per request
 */
async function getAuthContext(requestKey?: object): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>
  supabaseUser: SupabaseUser | null
  user: AuthenticatedUser | null
}> {
  // Check WeakMap cache first (preferred for memory efficiency)
  if (requestKey) {
    const cached = authCache.get(requestKey)
    if (cached?.resolved) {
      return {
        supabase: cached.supabase,
        supabaseUser: cached.supabaseUser,
        user: cached.dbUser,
      }
    }
  }

  // Check in-memory cache (expires after 100ms to handle same-request scenarios)
  const now = Date.now()
  if (
    currentRequestCache.timestamp &&
    now - currentRequestCache.timestamp < 100 &&
    currentRequestCache.supabase
  ) {
    return {
      supabase: currentRequestCache.supabase,
      supabaseUser: currentRequestCache.supabaseUser ?? null,
      user: currentRequestCache.dbUser ?? null,
    }
  }

  // Create new auth context
  const supabase = await createClient()
  const { data: { user: supabaseUser }, error } = await supabase.auth.getUser()

  let dbUser: AuthenticatedUser | null = null

  if (!error && supabaseUser) {
    // Single optimized database query
    const userData = await prisma.user.findUnique({
      where: { id: supabaseUser.id },
      select: {
        id: true,
        email: true,
        role: true,
        isAdmin: true,
        deactivatedAt: true,
      },
    })

    // Check if user exists and is not deactivated
    if (userData && !userData.deactivatedAt) {
      dbUser = {
        id: userData.id,
        email: userData.email || supabaseUser.email || '',
        role: userData.role || 'FREE',
        isAdmin: userData.isAdmin ?? false,
      }
    }
  }

  // Cache the result
  const cacheEntry = {
    supabase,
    supabaseUser: supabaseUser ?? null,
    dbUser,
    resolved: true,
  }

  if (requestKey) {
    authCache.set(requestKey, cacheEntry)
  }

  // Also update in-memory cache
  currentRequestCache = {
    supabase,
    supabaseUser: supabaseUser ?? null,
    dbUser,
    timestamp: now,
  }

  return {
    supabase,
    supabaseUser: supabaseUser ?? null,
    user: dbUser,
  }
}

/**
 * Clear the request cache (call at end of request if needed)
 */
export function clearAuthCache(): void {
  currentRequestCache = {}
}

// ============================================================================
// Core Auth Functions
// ============================================================================

/**
 * Get the current authenticated user
 * Uses request-scoped caching to eliminate duplicate queries
 *
 * @returns AuthenticatedUser if authenticated and not deactivated, null otherwise
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const { user } = await getAuthContext()
    return user
  } catch (error) {
    console.error('[API Auth] Error getting current user:', error)
    return null
  }
}

/**
 * Get the current user with the Supabase client
 * Useful when you need both the user and supabase client
 */
export async function getCurrentUserWithClient(): Promise<{
  user: AuthenticatedUser | null
  supabase: Awaited<ReturnType<typeof createClient>>
}> {
  const { user, supabase } = await getAuthContext()
  return { user, supabase }
}

/**
 * Check if current user is an admin
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.isAdmin ?? false
}

// ============================================================================
// Auth Response Helpers
// ============================================================================

const AUTH_RESPONSES = {
  unauthorized: () =>
    NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    ),
  deactivated: () =>
    NextResponse.json(
      { error: 'Account deactivated', code: 'ACCOUNT_DEACTIVATED' },
      { status: 401 }
    ),
  forbidden: () =>
    NextResponse.json(
      { error: 'Forbidden', code: 'ACCESS_DENIED' },
      { status: 403 }
    ),
  adminRequired: () =>
    NextResponse.json(
      { error: 'Admin access required', code: 'ADMIN_REQUIRED' },
      { status: 403 }
    ),
  notFound: () =>
    NextResponse.json(
      { error: 'Resource not found', code: 'NOT_FOUND' },
      { status: 404 }
    ),
  csrfInvalid: () =>
    NextResponse.json(
      { error: 'Invalid or missing CSRF token', code: 'CSRF_INVALID' },
      { status: 403 }
    ),
} as const

// ============================================================================
// Auth Wrappers (Higher-Order Functions)
// ============================================================================

/**
 * Wrapper that requires authentication for an API route
 * Optimized to use cached auth context
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const { user, supabase } = await getAuthContext(request)

    if (!user) {
      return AUTH_RESPONSES.unauthorized()
    }

    return handler(request, { user, supabase })
  }
}

/**
 * Wrapper that requires admin role
 * Optimized to use cached auth context
 */
export function withAdmin(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const { user, supabase } = await getAuthContext(request)

    if (!user) {
      return AUTH_RESPONSES.unauthorized()
    }

    if (!user.isAdmin) {
      console.warn(
        `[API Auth] Non-admin user ${user.id} attempted admin access: ${request.url}`
      )
      return AUTH_RESPONSES.adminRequired()
    }

    return handler(request, { user, supabase })
  }
}

/**
 * Wrapper that requires ownership of a resource
 * User must either own the resource or be an admin (if allowAdmin is true)
 */
export function withOwnership(handler: OwnershipHandler, options: OwnershipOptions) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const { user, supabase } = await getAuthContext(request)

    if (!user) {
      return AUTH_RESPONSES.unauthorized()
    }

    const resourceOwnerId = await options.getOwnerId(request)

    if (!resourceOwnerId) {
      return AUTH_RESPONSES.notFound()
    }

    const isOwner = user.id === resourceOwnerId
    const isAdminAllowed = options.allowAdmin && user.isAdmin

    if (!isOwner && !isAdminAllowed) {
      console.warn(
        `[API Auth] Unauthorized access: User ${user.id} -> resource owned by ${resourceOwnerId}`
      )
      return AUTH_RESPONSES.forbidden()
    }

    return handler(request, { user, supabase, resourceOwnerId })
  }
}

/**
 * Combined wrapper with both CSRF and authentication
 * For sensitive operations (password change, account deletion, etc.)
 */
export function withSecureAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const method = request.method.toUpperCase()
    const pathname = new URL(request.url).pathname

    // Check CSRF for state-changing methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const { validateCsrfToken, shouldSkipCsrfProtection } = await import(
        '@/lib/csrf'
      )

      if (!shouldSkipCsrfProtection(pathname)) {
        const isValidCsrf = await validateCsrfToken(request)
        if (!isValidCsrf) {
          return AUTH_RESPONSES.csrfInvalid()
        }
      }
    }

    // Use cached auth context
    const { user, supabase } = await getAuthContext(request)

    if (!user) {
      return AUTH_RESPONSES.unauthorized()
    }

    return handler(request, { user, supabase })
  }
}

/**
 * Optional auth wrapper - allows both authenticated and unauthenticated access
 * User will be null if not authenticated
 */
export function withOptionalAuth(
  handler: (
    request: NextRequest,
    context: { user: AuthenticatedUser | null; supabase: Awaited<ReturnType<typeof createClient>> }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const { user, supabase } = await getAuthContext(request)
    return handler(request, { user, supabase })
  }
}

// ============================================================================
// Utility Helpers
// ============================================================================

/**
 * Extract user ID from URL path
 * Useful for routes like /api/users/[userId]/...
 */
export function getUserIdFromPath(
  request: NextRequest,
  paramName = 'userId'
): string | null {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')

  const usersIndex = pathParts.indexOf('users')
  if (usersIndex !== -1 && pathParts[usersIndex + 1]) {
    return pathParts[usersIndex + 1]
  }

  return null
}

/**
 * Extract resource ID from request body
 */
export async function getResourceOwnerFromBody(
  request: NextRequest,
  field = 'userId'
): Promise<string | null> {
  try {
    const body = await request.clone().json()
    return body[field] || null
  } catch {
    return null
  }
}

/**
 * Create a standardized error response
 */
export function authError(
  message: string,
  status: number = 401,
  code?: string
): NextResponse {
  return NextResponse.json(
    { error: message, ...(code && { code }) },
    { status }
  )
}

// ============================================================================
// Batch Auth Check (for routes that need to check multiple users)
// ============================================================================

/**
 * Check if multiple user IDs are valid and not deactivated
 * Useful for batch operations
 */
export async function validateUserIds(userIds: string[]): Promise<{
  valid: string[]
  invalid: string[]
  deactivated: string[]
}> {
  if (userIds.length === 0) {
    return { valid: [], invalid: [], deactivated: [] }
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      deactivatedAt: true,
    },
  })

  const foundIds = new Set(users.map((u) => u.id))
  const deactivatedIds = new Set(
    users.filter((u) => u.deactivatedAt).map((u) => u.id)
  )

  return {
    valid: userIds.filter((id) => foundIds.has(id) && !deactivatedIds.has(id)),
    invalid: userIds.filter((id) => !foundIds.has(id)),
    deactivated: userIds.filter((id) => deactivatedIds.has(id)),
  }
}
