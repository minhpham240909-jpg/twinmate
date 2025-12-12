// Supabase Middleware for Auth Session Refresh
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Sanitize environment variables
const sanitizeEnvVar = (value: string | undefined): string => {
  if (!value) return ''
  return value.replace(/[\r\n\s]+/g, '').trim()
}

/**
 * H1 FIX: Token refresh with retry logic and exponential backoff
 * Prevents silent token refresh failures during Supabase service unavailability
 */
async function refreshTokenWithRetry(
  supabase: ReturnType<typeof createServerClient>,
  maxRetries: number = 3,
  baseDelayMs: number = 500
): Promise<{ user: { id: string } | null }> {
  let lastError: { message?: string; status?: number } | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      // If successful or no token exists, return immediately
      if (!error || error.message?.includes('no session')) {
        return { user: user ? { id: user.id } : null }
      }
      
      // Check if error is retryable (network/service issues)
      const isRetryable = error.message?.includes('network') ||
                          error.message?.includes('timeout') ||
                          error.message?.includes('unavailable') ||
                          error.status === 503 ||
                          error.status === 502 ||
                          error.status === 500
      
      if (!isRetryable) {
        // Non-retryable error (e.g., invalid token) - return immediately
        return { user: null }
      }
      
      lastError = { message: error.message, status: error.status }
      
      // Exponential backoff with jitter for retryable errors
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100
        await new Promise(resolve => setTimeout(resolve, delay))
        console.log(`[Auth] Token refresh retry ${attempt + 1}/${maxRetries} after ${delay}ms`)
      }
    } catch (err) {
      lastError = { message: err instanceof Error ? err.message : 'Unknown error' }
      
      // On catch, retry with backoff
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100
        await new Promise(resolve => setTimeout(resolve, delay))
        console.log(`[Auth] Token refresh exception retry ${attempt + 1}/${maxRetries}`)
      }
    }
  }
  
  // All retries failed
  console.error('[Auth] Token refresh failed after all retries:', lastError?.message)
  return { user: null }
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

  // H1 FIX: Refreshing auth token with retry logic for resilience
  const { user } = await refreshTokenWithRetry(supabase)

  const pathname = request.nextUrl.pathname

  // Define route categories
  const publicRoutes = ['/auth/confirm-email', '/auth/reset-password', '/auth/error', '/auth/callback']
  const authRoutes = ['/auth/signin', '/auth/signup', '/auth/forgot-password']
  const publicApiRoutes = ['/api/auth/', '/api/cron/', '/api/webhooks/', '/api/health', '/api/stripe/webhook']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
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
      // Set cookie to remember user view mode
      response.cookies.set('admin_user_view', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      })
      return response
    }

    // If admin is going back to admin panel, clear the user view cookie
    if (isAdminRoute && adminUserViewCookie) {
      response.cookies.delete('admin_user_view')
    }

    // Redirect from auth pages or root
    if (isAuthRoute || isRootRoute) {
      // Check if user is admin - redirect to admin dashboard instead
      // BUT if admin has user view cookie, redirect to dashboard (user view mode)
      const { data: userData } = await supabase
        .from('User')
        .select('isAdmin')
        .eq('id', user.id)
        .single()

      const url = request.nextUrl.clone()
      if (userData?.isAdmin && !adminUserViewCookie) {
        // Admin without user view cookie -> go to admin dashboard
        url.pathname = '/admin'
      } else {
        // Regular user OR admin in user view mode -> go to user dashboard
        url.pathname = '/dashboard'
      }
      return NextResponse.redirect(url)
    }

    // Note: We no longer redirect admins away from dashboard routes
    // Admins can freely browse the app once they enter via "View as User"
    // They return to admin by clicking the admin link in their profile dropdown
  } else {
    // User is NOT logged in
    if (!isAuthRoute && !isPublicRoute && !isPublicApiRoute && !isRootRoute) {
      // Redirect to sign-in if trying to access protected routes
      const url = request.nextUrl.clone()
      url.pathname = '/auth/signin'
      return NextResponse.redirect(url)
    }
  }

  return response
}