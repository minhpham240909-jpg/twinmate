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

  // Refreshing the auth token and get user
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Define route categories
  const publicRoutes = ['/auth/confirm-email', '/auth/reset-password']
  const authRoutes = ['/auth/signin', '/auth/signup', '/auth/forgot-password']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  const isRootRoute = pathname === '/'
  const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/')

  // Check if user is coming from admin (wants to view regular dashboard)
  const fromAdmin = request.nextUrl.searchParams.get('from') === 'admin'

  // Auth redirect logic
  if (user) {
    // User is logged in
    if (isAuthRoute || isRootRoute) {
      // Check if user is admin - redirect to admin dashboard instead
      const { data: userData } = await supabase
        .from('User')
        .select('isAdmin')
        .eq('id', user.id)
        .single()

      const url = request.nextUrl.clone()
      if (userData?.isAdmin) {
        url.pathname = '/admin'
      } else {
        url.pathname = '/dashboard'
      }
      return NextResponse.redirect(url)
    }

    // If admin user is accessing dashboard (not from admin view), redirect to admin
    if (isDashboardRoute && !fromAdmin) {
      const { data: userData } = await supabase
        .from('User')
        .select('isAdmin')
        .eq('id', user.id)
        .single()

      if (userData?.isAdmin) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin'
        return NextResponse.redirect(url)
      }
    }
  } else {
    // User is NOT logged in
    if (!isAuthRoute && !isPublicRoute && !isRootRoute) {
      // Redirect to sign-in if trying to access protected routes
      const url = request.nextUrl.clone()
      url.pathname = '/auth/signin'
      return NextResponse.redirect(url)
    }
  }

  return response
}