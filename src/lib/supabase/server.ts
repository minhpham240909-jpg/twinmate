// Supabase Client for Server Components and API Routes
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Sanitize environment variables to remove any newlines or extra whitespace
const sanitizeEnvVar = (value: string | undefined): string => {
  if (!value) return ''
  return value.replace(/[\r\n\s]+/g, '').trim()
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL!),
    sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Admin client with service role key (use with caution)
export function createAdminClient() {
  return createServerClient(
    sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL!),
    sanitizeEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY!),
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // Admin client doesn't need to set cookies
        },
      },
    }
  )
}