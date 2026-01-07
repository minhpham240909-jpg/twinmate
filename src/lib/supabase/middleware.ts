// Supabase Middleware for Auth Session Refresh
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Sanitize environment variables
const sanitizeEnvVar = (value: string | undefined): string => {
  if (!value) return ''
  return value.replace(/[\r\n\s]+/g, '').trim()
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
    if (!isAuthRoute && !isPublicRoute && !isPublicApiRoute && !isRootRoute) {
      // Redirect to auth page if trying to access protected routes
      const url = request.nextUrl.clone()
      url.pathname = '/auth'
      return NextResponse.redirect(url)
    }
  }

  return response
}
