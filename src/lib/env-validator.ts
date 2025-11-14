/**
 * Environment Variable Validator
 * Validates required environment variables on application startup
 * Prevents runtime errors from missing configuration
 */

import logger from './logger'

interface EnvConfig {
  name: string
  required: boolean
  description: string
  validationFn?: (value: string) => boolean
}

const ENV_SCHEMA: EnvConfig[] = [
  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL database connection URL',
    validationFn: (v) => v.startsWith('postgresql://'),
  },

  // Supabase
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
    validationFn: (v) => v.startsWith('https://') && v.includes('.supabase.co'),
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key',
  },

  // Authentication  
  {
    name: 'NEXTAUTH_SECRET',
    required: false, // Optional if using Supabase auth only
    description: 'NextAuth secret for JWT signing',
  },

  // Google OAuth (optional)
  {
    name: 'GOOGLE_CLIENT_ID',
    required: false,
    description: 'Google OAuth client ID',
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: false,
    description: 'Google OAuth client secret',
  },

  // Agora (Video/Audio)
  {
    name: 'NEXT_PUBLIC_AGORA_APP_ID',
    required: false, // Optional if video features are disabled
    description: 'Agora App ID for video calls',
  },

  // Email Service
  {
    name: 'RESEND_API_KEY',
    required: false, // Optional in development
    description: 'Resend API key for email notifications',
    validationFn: (v) => v.startsWith('re_'),
  },

  // Application
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: true,
    description: 'Public application URL',
    validationFn: (v) => v.startsWith('http://') || v.startsWith('https://'),
  },
]

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  missing: string[]
  invalid: string[]
}

/**
 * Validate all environment variables
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const missing: string[] = []
  const invalid: string[] = []

  for (const config of ENV_SCHEMA) {
    const value = process.env[config.name]

    // Check if required variable is missing
    if (config.required && !value) {
      missing.push(config.name)
      errors.push(`Missing required environment variable: ${config.name} - ${config.description}`)
      continue
    }

    // Warn about optional variables
    if (!config.required && !value) {
      warnings.push(`Optional environment variable not set: ${config.name} - ${config.description}`)
      continue
    }

    // Validate value format if validation function provided
    if (value && config.validationFn && !config.validationFn(value)) {
      invalid.push(config.name)
      errors.push(`Invalid format for ${config.name} - ${config.description}`)
    }
  }

  const valid = errors.length === 0

  return {
    valid,
    errors,
    warnings,
    missing,
    invalid,
  }
}

/**
 * Log validation results
 */
export function logValidationResults(results: ValidationResult) {
  if (results.valid) {
    logger.info('✅ Environment variables validated successfully')
    
    if (results.warnings.length > 0) {
      logger.warn(`⚠️  ${results.warnings.length} optional variables not set:`)
      results.warnings.forEach((warning) => logger.warn(`  - ${warning}`))
    }
  } else {
    logger.error('❌ Environment validation failed!')
    logger.error(`Missing: ${results.missing.length}, Invalid: ${results.invalid.length}`)
    
    results.errors.forEach((error) => logger.error(`  - ${error}`))
  }
}

/**
 * Validate and exit if critical errors
 */
export function validateOrExit() {
  const results = validateEnvironment()
  logValidationResults(results)

  if (!results.valid) {
    logger.error('🛑 Application cannot start with missing required environment variables')
    logger.error('Please check your .env.local file and ensure all required variables are set')
    logger.error('See .env.example for reference')
    
    // In development, just warn but continue
    if (process.env.NODE_ENV === 'development') {
      logger.warn('⚠️  Running in development mode - continuing despite errors')
    } else {
      // In production, exit with error
      process.exit(1)
    }
  }

  return results
}

/**
 * Get environment info for debugging
 */
export function getEnvironmentInfo() {
  return {
    nodeEnv: process.env.NODE_ENV,
    hasDatabase: !!process.env.DATABASE_URL,
    hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAgora: !!process.env.NEXT_PUBLIC_AGORA_APP_ID,
    hasEmail: !!process.env.RESEND_API_KEY,
    hasRedis: !!process.env.UPSTASH_REDIS_REST_URL,
    hasStripe: !!process.env.STRIPE_SECRET_KEY,
  }
}
