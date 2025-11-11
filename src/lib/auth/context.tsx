'use client'

// Auth Context for Client-Side Authentication State
import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export interface UserProfile {
  id: string
  email: string
  name: string
  role: 'FREE' | 'PREMIUM'
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
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // Note: Presence heartbeat is handled by PresenceProvider in root layout

  const fetchProfile = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`)
      if (response.ok) {
        const data = await response.json()
        // Merge user data with profile data
        // Ensure we have at least basic user info even if profile is null
        if (data.user) {
          setProfile({
            ...data.user,
            ...(data.profile || {}), // Use empty object if profile is null
          })
        }
      } else {
        // Log error but don't throw - let the UI handle it
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Error fetching profile:', response.status, errorData)
        // Set a minimal profile with just user info if we have it
        // This prevents blank page but shows error state
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      // Network error - don't set profile, let UI show error
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
    // Get initial session
    const initAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        await fetchProfile(user.id)
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

    // Sign out via API (this will mark presence as offline)
    await fetch('/api/auth/signout', { method: 'POST' })
    
    // Clear local state
    setUser(null)
    setProfile(null)
    
    // Redirect to home
    router.push('/')
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshUser }}>
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