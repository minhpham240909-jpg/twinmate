'use client'

// Auth Context for Client-Side Authentication State
import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && key && !url.includes('placeholder') && url.startsWith('https://')
}

// Fetch with timeout to prevent infinite loading
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`)
    }
    throw error
  }
}

export interface UserProfile {
  id: string
  email: string
  name: string
  role: 'FREE' | 'PREMIUM'
  // Profile role/position (e.g., 'Student', 'Professional', 'Teacher')
  // Separate from subscription role ('FREE'/'PREMIUM')
  profileRole?: string | null
  isAdmin?: boolean
  avatarUrl?: string | null
  bio?: string | null
  subjects?: string[]
  interests?: string[]
  goals?: string[]
  skillLevel?: string
  skillLevelCustomDescription?: string | null
  studyStyle?: string
  studyStyleCustomDescription?: string | null
  availableDays?: string[]
  availableHours?: string[]
  availabilityCustomDescription?: string | null
  subjectCustomDescription?: string | null
  interestsCustomDescription?: string | null
  // Gamification fields from Profile
  studyStreak?: number
  totalStudyHours?: number
  lastStudyDate?: Date | string | null
  // Other profile fields
  age?: number | null
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  configError: boolean
  profileError: string | null
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [configError, setConfigError] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Note: Presence heartbeat is handled by PresenceProvider in root layout

  const fetchProfile = async (userId: string) => {
    setProfileError(null)
    try {
      // Add cache: 'no-store' to bypass any caching and get fresh profile data
      // Use fetchWithTimeout to prevent infinite loading in production
      const response = await fetchWithTimeout(`/api/users/${userId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      }, 15000) // 15 second timeout
      if (response.ok) {
        const data = await response.json()
        // Debug logging to diagnose production issue
        console.log('[AuthContext] API response:', {
          hasUser: !!data.user,
          hasProfile: !!data.profile,
          userRole: data.user?.role,
          profileRole: data.profile?.role,
          profileBio: data.profile?.bio ? 'has bio' : 'no bio',
          profileSubjects: data.profile?.subjects?.length || 0,
        })

        // Merge user data with profile data
        // Ensure we have at least basic user info even if profile is null
        if (data.user) {
          // Extract Profile.role as profileRole (user position like 'Student', 'Professional')
          // This is separate from User.role which is subscription type ('FREE'/'PREMIUM')
          const profileRole = data.profile?.role || null

          const mergedProfile = {
            ...data.user,
            ...(data.profile || {}), // Use empty object if profile is null
            // Ensure subscription role is preserved from user data
            role: data.user.role,
            // Map Profile.role to profileRole to avoid confusion
            profileRole,
          }

          console.log('[AuthContext] Merged profile:', {
            role: mergedProfile.role,
            profileRole: mergedProfile.profileRole,
          })

          setProfile(mergedProfile)
        }
      } else {
        // Log error but don't throw - let the UI handle it
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Error fetching profile:', response.status, errorData)
        setProfileError(`Failed to load profile: ${errorData.error || 'Server error'}`)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (errorMessage.includes('timed out')) {
        setProfileError('Connection timed out. Please check your internet connection.')
      } else {
        setProfileError(`Failed to load profile: ${errorMessage}`)
      }
    }
  }

  const refreshUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (user) {
      await fetchProfile(user.id)
    } else {
      setProfile(null)
    }
  }

  useEffect(() => {
    // Get initial session with timeout to prevent infinite loading
    const initAuth = async () => {
      // Check if Supabase is properly configured
      if (!isSupabaseConfigured()) {
        console.error('[AuthContext] Supabase is not configured. Check environment variables.')
        setConfigError(true)
        setLoading(false)
        return
      }

      // Create a timeout promise that rejects after 10 seconds
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Auth initialization timed out')), 10000)
      })

      try {
        // Race between auth check and timeout
        const result = await Promise.race([
          supabase.auth.getUser(),
          timeoutPromise
        ]) as { data: { user: any }, error: any }

        const { data: { user }, error } = result
        if (error) {
          console.error('[AuthContext] Error getting user:', error.message)
          // Don't set configError for auth errors (user just not logged in)
        }
        setUser(user)
        if (user) {
          await fetchProfile(user.id)
        }
      } catch (err) {
        console.error('[AuthContext] Failed to initialize auth:', err)
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        if (errorMessage.includes('timed out')) {
          setProfileError('Connection timed out. Please refresh the page.')
        }
      }
      setLoading(false)
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)

        // Refresh router on sign in/out
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          router.refresh()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router, supabase])

  const signOut = async () => {
    // Confirm before signing out
    if (!confirm('Are you sure you want to log out?')) {
      return
    }

    try {
      // Sign out via API (this will mark presence as offline)
      await fetch('/api/auth/signout', { method: 'POST' })

      // Also sign out from client-side Supabase to clear cookies properly
      await supabase.auth.signOut()

      // Clear local state
      setUser(null)
      setProfile(null)

      // Use window.location for a full page reload to ensure clean state
      // This ensures all cached auth state is cleared
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
      // Still try to redirect even if there's an error
      window.location.href = '/'
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, configError, profileError, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}