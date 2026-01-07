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

  const supabaseUrl = sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL) || 'https://placeholder.supabase.co'
  const supabaseKey = sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder'

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

  // SECURITY: Verify auth with Supabase - NEVER trust cookies alone
  // Cookies can be manipulated; only trust verified sessions
  let user: { id: string } | null = null

  // First, check if auth cookies exist (fast check - no network call)
  // Supabase sets cookies like 'sb-<project-ref>-auth-token'
  const cookies = request.cookies.getAll()
  const hasAuthCookies = cookies.some(cookie =>
    cookie.name.includes('-auth-token') && cookie.value.length > 10
  )

  if (hasAuthCookies) {
    // Auth cookies exist - MUST verify with Supabase
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser()
      if (!error && authUser) {
        // SECURITY: Only trust verified users from Supabase
        user = { id: authUser.id }
      }
      // SECURITY FIX: If getUser fails, treat as unauthenticated
      // Do NOT trust cookies alone - they could be forged or expired
      // The user will be redirected to login where they can re-authenticate
    } catch {
      // SECURITY FIX: Auth verification failed - treat as unauthenticated
      // This could be a network error, but it's safer to require re-login
      // than to trust unverified cookies
      user = null
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
