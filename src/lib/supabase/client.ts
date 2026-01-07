// Supabase Client for Client Components
import { createBrowserClient } from '@supabase/ssr'

// Sanitize environment variables to remove any newlines or extra whitespace
const sanitizeEnvVar = (value: string | undefined): string => {
  if (!value) return ''
  return value.replace(/[\r\n\s]+/g, '').trim()
}

export function createClient() {
  const supabaseUrl = sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseKey = sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  // During build time, use dummy values to allow build to complete
  // At runtime, the real values will be used
  const url = supabaseUrl || 'https://placeholder.supabase.co'
  const key = supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder'

  // CRITICAL: Use default cookie-based storage for SSR compatibility
  // The createBrowserClient automatically handles cookie storage which allows
  // the server middleware to read auth tokens and maintain session consistency
  // DO NOT use custom localStorage/sessionStorage - it breaks server-side auth checks
  return createBrowserClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
}