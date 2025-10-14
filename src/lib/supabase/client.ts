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

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createBrowserClient(supabaseUrl, supabaseKey)
}