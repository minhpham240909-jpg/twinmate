// Next.js Middleware - Simplified for Vercel Edge Runtime
import { NextResponse } from 'next/server'

// Configure Edge Runtime for Vercel
export const runtime = 'edge'

export async function middleware() {
  // Simple pass-through middleware
  // Supabase auth refresh will happen client-side instead
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}