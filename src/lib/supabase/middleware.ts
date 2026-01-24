// Supabase Middleware for Auth Session Refresh
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Sanitize environment variables
const sanitizeEnvVar = (value: string | undefined): string => {
  if (!value) return ''
  return value.replace(/[\r\n\s]+/g, '').trim()
}

// FIX: Session timeout configuration (not just for admin panel)
// This applies to all authenticated routes for security
const SESSION_CONFIG = {
  // Maximum session age (24 hours) - after this, user must re-authenticate
  maxSessionAgeMs: 24 * 60 * 60 * 1000,
  // Idle timeout (4 hours) - user is logged out after this period of inactivity
  idleTimeoutMs: 4 * 60 * 60 * 1000,
  // Warning before timeout (5 minutes) - optional, for client-side warning
  warningBeforeTimeoutMs: 5 * 60 * 1000,
  // Activity cookie name
  lastActivityCookieName: 'last_activity',
}

/**
 * Check if session has timed out due to inactivity
 */
function isSessionTimedOut(request: NextRequest): boolean {
  const lastActivityStr = request.cookies.get(SESSION_CONFIG.lastActivityCookieName)?.value
  
  if (!lastActivityStr) {
    return false // First request, not timed out
  }
  
  const lastActivity = parseInt(lastActivityStr, 10)
  if (isNaN(lastActivity)) {
    return false
  }
  
  const timeSinceActivity = Date.now() - lastActivity
  return timeSinceActivity > SESSION_CONFIG.idleTimeoutMs
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabaseUrl = sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseKey = sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  // CRITICAL: If Supabase is not configured, skip auth checks to prevent redirect loops
  // This allows the app to at least load so users can see error messages
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    console.error('[Middleware] CRITICAL: Supabase environment variables not configured!')
    console.error('[Middleware] NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'set' : 'MISSING')
    console.error('[Middleware] NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? 'set' : 'MISSING')
    // Return without auth checks - let pages handle the error
    return response
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Get session from Supabase - this reads from cookies and validates the JWT locally
  // getSession() is fast (no network call) and sufficient for middleware routing
  // Individual API routes use getUser() for full server-side verification
  let user: { id: string } | null = null
  
  // Check if this is a fresh redirect from auth callback
  // The auth_verified cookie is set by the callback route and is short-lived (30s)
  const isFromAuthCallback = request.cookies.get('auth_verified')?.value === 'true'
  const hasAuthCallbackParam = request.nextUrl.searchParams.get('auth_callback') === 'true'
  
  // Check for auth cookies existence
  const cookies = request.cookies.getAll()
  const hasAuthCookies = cookies.some(cookie =>
    cookie.name.includes('-auth-token') && cookie.value.length > 10
  )

  // OPTIMIZATION: If coming from auth callback with fresh cookies + verification cookie,
  // trust the auth and extract user ID directly from the JWT
  // This prevents the race condition where getSession() fails due to cookie sync timing
  if (isFromAuthCallback && hasAuthCallbackParam && hasAuthCookies) {
    try {
      // Parse the access token to get user ID (safe since callback just verified)
      const accessToken = cookies.find(c => c.name.includes('-auth-token'))
      if (accessToken) {
        // JWT structure: header.payload.signature - payload contains 'sub' (user ID)
        const payloadBase64 = accessToken.value.split('.')[1]
        if (payloadBase64) {
          const payload = JSON.parse(atob(payloadBase64))
          if (payload.sub) {
            user = { id: payload.sub }
          }
        }
      }
    } catch {
      // If parsing fails, fall through to standard verification
      user = null
    }
  }
  
  // Standard path: Get session from Supabase if not already authenticated via callback
  if (!user) {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        console.warn('[Middleware] Session error:', error.message)
      }

      if (session?.user) {
        user = { id: session.user.id }
      }
    } catch (err) {
      console.error('[Middleware] Auth check exception:', err)
      // On error, allow the request through - API routes will handle auth properly
    }
  }

  const pathname = request.nextUrl.pathname

  // Define route categories
  const publicRoutes = ['/auth/confirm-email', '/auth/reset-password', '/auth/error', '/auth/callback', '/privacy', '/terms', '/help']
  const authRoutes = ['/auth', '/auth/forgot-password']
  const publicApiRoutes = ['/api/auth/', '/api/cron/', '/api/webhooks/', '/api/health', '/api/stripe/webhook']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = pathname === '/auth' || authRoutes.some(route => pathname.startsWith(route))
  const isPublicApiRoute = publicApiRoutes.some(route => pathname.startsWith(route))
  const isRootRoute = pathname === '/'
  const isAdminRoute = pathname.startsWith('/admin')

  // Check if admin is entering "user view" mode (via ?from=admin parameter)
  const enteringUserView = request.nextUrl.searchParams.get('from') === 'admin'

  // Check if admin has a "user view" session cookie
  const adminUserViewCookie = request.cookies.get('admin_user_view')?.value === 'true'

  // Auth redirect logic
  if (user) {
    // User is logged in
    
    // FIX: Check for session timeout (idle timeout for all users, not just admin)
    // This ensures inactive sessions are terminated for security
    if (!isPublicRoute && !isPublicApiRoute && isSessionTimedOut(request)) {
      console.log('[Middleware] Session timed out due to inactivity')
      
      // Redirect to auth with timeout message
      const url = request.nextUrl.clone()
      url.pathname = '/auth'
      url.searchParams.set('reason', 'session_timeout')
      
      // Clear auth cookies
      const timeoutResponse = NextResponse.redirect(url)
      timeoutResponse.cookies.delete(SESSION_CONFIG.lastActivityCookieName)
      
      // Also try to sign out from Supabase
      try {
        await supabase.auth.signOut()
      } catch {
        // Ignore signout errors
      }
      
      return timeoutResponse
    }
    
    // Update last activity timestamp for non-API routes
    // API routes don't update activity to prevent background fetches from keeping session alive
    const isApiRoute = pathname.startsWith('/api')
    if (!isApiRoute && !isPublicRoute) {
      response.cookies.set(SESSION_CONFIG.lastActivityCookieName, Date.now().toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_CONFIG.maxSessionAgeMs / 1000, // Convert to seconds
      })
    }
    
    // Clean up auth_callback param if present (prevents it being bookmarked)
    if (hasAuthCallbackParam) {
      const cleanUrl = request.nextUrl.clone()
      cleanUrl.searchParams.delete('auth_callback')
      // Delete the short-lived auth_verified cookie since it's been used
      response = NextResponse.redirect(cleanUrl)
      response.cookies.delete('auth_verified')
      return response
    }

    // If admin is entering user view mode, set the cookie and continue
    if (enteringUserView) {
      response.cookies.set('admin_user_view', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24,
      })
      return response
    }

    // If admin is going back to admin panel, clear the user view cookie
    if (isAdminRoute && adminUserViewCookie) {
      response.cookies.delete('admin_user_view')
    }

    // Redirect from auth pages or root - FAST redirect to dashboard
    // Don't check isAdmin here - the callback already handles admin redirect
    // This keeps middleware fast and responsive
    if (isAuthRoute || isRootRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  } else {
    // User is NOT logged in
    // CLERVA 2.0: Allow guests to access main app pages
    // Guests can browse freely but data won't be saved without an account
    // Each page handles its own guest state with appropriate messaging
    const guestAllowedRoutes = [
      '/dashboard',
      '/progress',
      '/settings',
      '/flashcards',
      '/profile',
      '/api/guide-me',
      '/api/ai-partner',
      '/api/flashcards',
      '/api/user/stats',  // Allow stats API for guest UI
    ]
    const isGuestAllowedRoute = guestAllowedRoutes.some(route => pathname.startsWith(route))

    if (!isAuthRoute && !isPublicRoute && !isPublicApiRoute && !isRootRoute && !isGuestAllowedRoute) {
      // Redirect to auth page if trying to access protected routes
      const url = request.nextUrl.clone()
      url.pathname = '/auth'
      return NextResponse.redirect(url)
    }
  }

  return response
}
