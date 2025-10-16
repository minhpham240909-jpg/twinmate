// Sync Supabase session from localStorage to cookies for server-side access
'use client'

export function syncSessionToCookies() {
  if (typeof window === 'undefined') return

  try {
    // Get the Supabase session from localStorage
    const keys = Object.keys(localStorage).filter(key =>
      key.startsWith('sb-') && key.includes('-auth-token')
    )

    if (keys.length === 0) {
      // No session found, clear any existing cookies
      document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
      document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
      return
    }

    // Get the session data
    const sessionData = localStorage.getItem(keys[0])
    if (!sessionData) return

    const session = JSON.parse(sessionData)

    if (session?.access_token) {
      // Set access token as httpOnly=false cookie so server can read it
      const expires = new Date(session.expires_at * 1000).toUTCString()
      document.cookie = `sb-access-token=${session.access_token}; path=/; expires=${expires}; SameSite=Lax`

      if (session.refresh_token) {
        document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; expires=${expires}; SameSite=Lax`
      }
    }
  } catch (error) {
    console.error('Failed to sync session to cookies:', error)
  }
}

// Call this on app initialization and after signin
if (typeof window !== 'undefined') {
  // Sync on page load
  syncSessionToCookies()

  // Listen for storage changes (e.g., signin in another tab)
  window.addEventListener('storage', (e) => {
    if (e.key?.includes('auth-token')) {
      syncSessionToCookies()
    }
  })
}
