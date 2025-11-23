// Supabase Client for Client Components
import { createBrowserClient } from '@supabase/ssr'

// Sanitize environment variables to remove any newlines or extra whitespace
const sanitizeEnvVar = (value: string | undefined): string => {
  if (!value) return ''
  return value.replace(/[\r\n\s]+/g, '').trim()
}

/**
 * Custom storage adapter that checks both localStorage and sessionStorage
 * This supports "Remember Me" functionality:
 * - If user checked "Remember me": session stored in localStorage (persists)
 * - If user unchecked "Remember me": session stored in sessionStorage (expires when browser closes)
 */
const createHybridStorage = () => {
  return {
    getItem: (key: string) => {
      // Check sessionStorage first (takes precedence for "Remember me" = false)
      if (typeof window !== 'undefined') {
        const sessionValue = sessionStorage.getItem(key)
        if (sessionValue) return sessionValue

        // Fallback to localStorage (for "Remember me" = true)
        const localValue = localStorage.getItem(key)
        if (localValue) return localValue
      }
      return null
    },
    setItem: (key: string, value: string) => {
      if (typeof window !== 'undefined') {
        // Default to localStorage unless explicitly using sessionStorage
        // The SignInForm will manually move to sessionStorage if needed
        localStorage.setItem(key, value)
      }
    },
    removeItem: (key: string) => {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(key)
        localStorage.removeItem(key)
      }
    },
  }
}

export function createClient() {
  const supabaseUrl = sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseKey = sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  // During build time, use dummy values to allow build to complete
  // At runtime, the real values will be used
  const url = supabaseUrl || 'https://placeholder.supabase.co'
  const key = supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder'

  // Create client with hybrid storage that checks both localStorage and sessionStorage
  // This enables "Remember Me" functionality to work seamlessly
  return createBrowserClient(url, key, {
    auth: {
      storage: createHybridStorage() as any,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}