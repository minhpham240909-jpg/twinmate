/**
 * Environment Variable Validation
 * Validates all required environment variables at build time
 *
 * This prevents deployment with missing or invalid configuration
 */

import { z } from 'zod'

// Define the schema for environment variables
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  DIRECT_URL: z.string().url('DIRECT_URL must be a valid URL').optional(),

  // Supabase (Public - safe to expose)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),

  // Supabase (Private - server only)
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Authentication (optional - only needed if using NextAuth instead of Supabase Auth)
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL').optional(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Agora (Video/Audio)
  NEXT_PUBLIC_AGORA_APP_ID: z.string().optional(),
  AGORA_APP_CERTIFICATE: z.string().optional(),

  // Stripe (Optional - for premium features)
  STRIPE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PREMIUM_PRICE_ID: z.string().optional(),

  // Upstash Redis (Rate Limiting)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
})

// Type for validated environment variables
export type Env = z.infer<typeof envSchema>

/**
 * Validate environment variables
 * Call this at build time to ensure all required vars are present
 */
export function validateEnv(): Env {
  try {
    const parsed = envSchema.parse(process.env)
    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:')
      error.issues.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })

      console.error('\n📝 Please check your .env file and ensure all required variables are set.')
      console.error('📋 See .env.example for a complete list of required variables.\n')

      throw new Error('Environment validation failed')
    }
    throw error
  }
}

/**
 * Get validated environment variables
 * Safe to call on both client and server
 */
export function getEnv(): Env {
  // In development, validate on every access (shows errors immediately)
  if (process.env.NODE_ENV === 'development') {
    return validateEnv()
  }

  // In production, assume vars are already validated at build time
  return process.env as unknown as Env
}

/**
 * Check if a feature is enabled based on environment variables
 */
export const features = {
  googleOAuth: () => {
    const env = getEnv()
    return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
  },

  stripe: () => {
    const env = getEnv()
    return !!(env.STRIPE_SECRET_KEY && env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  },

  agora: () => {
    const env = getEnv()
    return !!(env.NEXT_PUBLIC_AGORA_APP_ID && env.AGORA_APP_CERTIFICATE)
  },

  redis: () => {
    const env = getEnv()
    return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)
  },

  sentry: () => {
    const env = getEnv()
    return !!env.SENTRY_DSN
  },
}

// Validate on module load in production build
if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  validateEnv()
}

/**
 * Get the correct application URL
 * Ensures we use the production domain (clerva.app) and not Vercel's default URL
 * This fixes issues where notifications show clerva-app.vercel.app instead of clerva.app
 */
export function getAppUrl(): string {
  // Production: Always use the official domain
  if (process.env.NODE_ENV === 'production') {
    return 'https://clerva.app'
  }

  // Development: Use NEXT_PUBLIC_APP_URL or fallback to localhost
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}
