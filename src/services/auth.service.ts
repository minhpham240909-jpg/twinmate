/**
 * Authentication Service
 * 
 * Centralized authentication logic using Supabase Auth
 * All auth operations should go through this service
 */

import { DatabaseService, NotFoundError, UnauthorizedError, ConflictError, ValidationError } from './base.service'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export interface SignUpData {
  email: string
  password: string
  name: string
}

export interface SignInData {
  email: string
  password: string
}

export interface AuthResult {
  user: User
  session: {
    access_token: string
    refresh_token: string
  }
}

export interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  avatarUrl?: string | null
  emailVerified: boolean
}

export class AuthService extends DatabaseService {
  /**
   * Sign up a new user with email and password
   */
  async signUp(data: SignUpData): Promise<AuthResult> {
    const { email, password, name } = data

    // Validate input
    if (!email || !password || !name) {
      throw new ValidationError('Email, password, and name are required')
    }

    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters')
    }

    return await this.withRetry(async () => {
      // Check if email already exists in database
      const existingUser = await this.db.user.findUnique({
        where: { email },
        select: { id: true, email: true },
      })

      if (existingUser) {
        throw new ConflictError(
          'An account with this email already exists',
          { email }
        )
      }

      // Create user in Supabase Auth
      const supabase = await createClient()
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
        },
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new ConflictError('Email already registered')
        }
        throw new Error(authError.message)
      }

      if (!authData.user) {
        throw new Error('Failed to create auth user')
      }

      // Store user to satisfy TypeScript null check
      const authUser = authData.user

      // Create user and profile in database (transaction)
      try {
        await this.withTransaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              id: authUser.id,
              email,
              name,
              role: 'FREE',
              emailVerified: false,
            },
          })

          await tx.profile.create({
            data: { userId: newUser.id },
          })
        })
      } catch (error) {
        // If database creation fails, clean up Supabase auth user
        // (in production, you might want to handle this differently)
        console.error('Failed to create database user, auth user may be orphaned:', error)
        throw error
      }

      if (!authData.session) {
        throw new Error('No session returned after signup')
      }

      return {
        user: authData.user,
        session: authData.session,
      }
    })
  }

  /**
   * Sign in an existing user
   */
  async signIn(data: SignInData): Promise<AuthResult> {
    const { email, password } = data

    if (!email || !password) {
      throw new ValidationError('Email and password are required')
    }

    return await this.withRetry(async () => {
      // Check if user exists in database first
      const existingUser = await this.db.user.findUnique({
        where: { email },
        select: { id: true, emailVerified: true },
      })

      if (!existingUser) {
        throw new NotFoundError('Account not found')
      }

      // Sign in with Supabase Auth
      const supabase = await createClient()
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        if (authError.message.includes('Email not confirmed')) {
          throw new UnauthorizedError(
            'Please confirm your email before signing in'
          )
        }
        if (authError.message.includes('Invalid login credentials')) {
          throw new UnauthorizedError('Invalid email or password')
        }
        throw new UnauthorizedError(authError.message)
      }

      if (!authData.user || !authData.session) {
        throw new UnauthorizedError('Authentication failed')
      }

      // Update last login time
      await this.db.user.update({
        where: { id: authData.user.id },
        data: { lastLoginAt: new Date() },
      }).catch((error) => {
        // Don't fail signin if this update fails
        console.error('Failed to update lastLoginAt:', error)
      })

      return {
        user: authData.user,
        session: authData.session,
      }
    })
  }

  /**
   * Get user by ID with profile
   */
  async getUserById(userId: string): Promise<UserProfile | null> {
    return await this.withRetry(async () => {
      const user = await this.db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          emailVerified: true,
        },
      })

      return user
    })
  }

  /**
   * Get current authenticated user from Supabase
   */
  async getCurrentUser(): Promise<User | null> {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    return user
  }

  /**
   * Verify user's email
   */
  async verifyEmail(userId: string): Promise<void> {
    await this.withRetry(async () => {
      await this.db.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      })
    })
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: Partial<{
    name: string
    avatarUrl: string
  }>): Promise<UserProfile> {
    return await this.withRetry(async () => {
      const updated = await this.db.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          emailVerified: true,
        },
      })

      return updated
    })
  }

  /**
   * Sign out user (handled client-side in most cases)
   */
  async signOut(): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Sign out error:', error)
      throw new Error('Failed to sign out')
    }
  }

  /**
   * Check if email is available
   */
  async isEmailAvailable(email: string): Promise<boolean> {
    const existing = await this.db.user.findUnique({
      where: { email },
      select: { id: true },
    })

    return !existing
  }

  /**
   * Resend email confirmation
   */
  async resendConfirmation(email: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    if (error) {
      throw new Error(error.message)
    }
  }
}

// Export singleton instance
export const authService = new AuthService()

