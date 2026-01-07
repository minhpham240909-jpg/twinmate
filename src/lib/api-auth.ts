/**
 * API Route Authorization Utilities
 *
 * Provides server-side authentication and authorization for API routes.
 * Ensures users can only access their own data and prevents unauthorized access.
 *
 * Usage:
 * ```typescript
 * import { withAuth, withOwnership, withAdmin } from '@/lib/api-auth'
 *
 * // Require authentication
 * export const GET = withAuth(async (request, { user }) => {
 *   return NextResponse.json({ userId: user.id })
 * })
 *
 * // Require ownership of a resource
 * export const PUT = withOwnership(
 *   async (request, { user, resourceOwnerId }) => {
 *     // User is verified to own this resource
 *     return NextResponse.json({ success: true })
 *   },
 *   { getOwnerId: async (req) => req.params.userId }
 * )
 *
 * // Require admin role
 * export const DELETE = withAdmin(async (request, { user }) => {
 *   return NextResponse.json({ deleted: true })
 * })
 * ```
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// Types
export interface AuthenticatedUser {
  id: string
  email: string
  role?: string
  isAdmin?: boolean
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
  allowAdmin?: boolean // If true, admins can access any resource
}

/**
 * Get the current authenticated user from Supabase session
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    // Get user info from database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        role: true,
        isAdmin: true,
        deactivatedAt: true,
      },
    })

    // Check if user is deactivated
    if (dbUser?.deactivatedAt) {
      return null
    }

    return {
      id: user.id,
      email: user.email || '',
      role: dbUser?.role || 'FREE',
      isAdmin: dbUser?.isAdmin ?? false,
    }
  } catch (error) {
    console.error('[API Auth] Error getting current user:', error)
    return null
  }
}

/**
 * Wrapper that requires authentication for an API route
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const supabase = await createClient()
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      )
    }

    // Get full user info including role
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Account not found or deactivated' },
        { status: 401 }
      )
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
    const supabase = await createClient()
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Account not found or deactivated' },
        { status: 401 }
      )
    }

    // Get the resource owner ID
    const resourceOwnerId = await options.getOwnerId(request)

    if (!resourceOwnerId) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      )
    }

    // Check ownership or admin access
    const isOwner = user.id === resourceOwnerId
    const isAdminAllowed = options.allowAdmin && user.isAdmin

    if (!isOwner && !isAdminAllowed) {
      // Log unauthorized access attempt for security monitoring
      console.warn(`[API Auth] Unauthorized access attempt: User ${user.id} tried to access resource owned by ${resourceOwnerId}`)

      return NextResponse.json(
        { error: 'Forbidden - You do not have permission to access this resource' },
        { status: 403 }
      )
    }

    return handler(request, { user, supabase, resourceOwnerId })
  }
}

/**
 * Wrapper that requires admin role
 */
export function withAdmin(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const supabase = await createClient()
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Account not found or deactivated' },
        { status: 401 }
      )
    }

    if (!user.isAdmin) {
      // Log unauthorized admin access attempt
      console.warn(`[API Auth] Non-admin user ${user.id} attempted to access admin route: ${request.url}`)

      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    return handler(request, { user, supabase })
  }
}

/**
 * Combined wrapper with both CSRF and authentication
 */
export function withSecureAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Import CSRF dynamically to avoid circular dependencies
    const { validateCsrfToken, shouldSkipCsrfProtection } = await import('@/lib/csrf')

    const method = request.method.toUpperCase()
    const pathname = new URL(request.url).pathname

    // Check CSRF for state-changing methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      if (!shouldSkipCsrfProtection(pathname)) {
        const isValidCsrf = await validateCsrfToken(request)
        if (!isValidCsrf) {
          return NextResponse.json(
            { error: 'Invalid or missing CSRF token' },
            { status: 403 }
          )
        }
      }
    }

    // Then check authentication
    const supabase = await createClient()
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Account not found or deactivated' },
        { status: 401 }
      )
    }

    return handler(request, { user, supabase })
  }
}

/**
 * Helper to extract user ID from URL path
 * Useful for routes like /api/users/[userId]/...
 */
export function getUserIdFromPath(request: NextRequest, paramName = 'userId'): string | null {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')

  // Find the index of the param in common patterns
  // /api/users/[userId] -> userId is at index 3
  // /api/users/[userId]/profile -> userId is at index 3

  const usersIndex = pathParts.indexOf('users')
  if (usersIndex !== -1 && pathParts[usersIndex + 1]) {
    return pathParts[usersIndex + 1]
  }

  return null
}

/**
 * Helper to extract resource ID from request body
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
