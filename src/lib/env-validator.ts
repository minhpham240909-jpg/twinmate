/**
 * Environment Variable Validator
 * Validates required environment variables on application startup
 * Prevents runtime errors from missing configuration
 *
 * CRITICAL: This must be called during server startup to prevent
 * security vulnerabilities from missing secrets
 */

import logger from './logger'

interface EnvConfig {
  name: string
  required: boolean
  requiredInProduction: boolean
  description: string
  validationFn?: (value: string) => boolean
  minLength?: number
}

const isProduction = process.env.NODE_ENV === 'production'

const ENV_SCHEMA: EnvConfig[] = [
  // ==========================================
  // CRITICAL SECURITY - Required in Production
  // ==========================================
  {
    name: 'ENCRYPTION_KEY',
    required: false,
    requiredInProduction: true,
    description: 'Encryption key for sensitive data (generate with: openssl rand -base64 32)',
    minLength: 32,
  },
  {
    name: 'CSRF_SECRET',
    required: false,
    requiredInProduction: true,
    description: 'CSRF protection secret (generate with: openssl rand -base64 32)',
    minLength: 32,
  },

  // ==========================================
  // Database - Always Required
  // ==========================================
  {
    name: 'DATABASE_URL',
    required: true,
    requiredInProduction: true,
    description: 'PostgreSQL database connection URL',
    validationFn: (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
  },

  // ==========================================
  // Supabase - Always Required
  // ==========================================
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    requiredInProduction: true,
    description: 'Supabase project URL',
    validationFn: (v) => v.startsWith('https://') && v.includes('supabase'),
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    requiredInProduction: true,
    description: 'Supabase anonymous key',
    minLength: 100,
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: false,
    requiredInProduction: true,
    description: 'Supabase service role key for admin operations',
    minLength: 100,
  },

  // ==========================================
  // Redis - Required in Production for Rate Limiting
  // ==========================================
  {
    name: 'UPSTASH_REDIS_REST_URL',
    required: false,
    requiredInProduction: true,
    description: 'Upstash Redis URL for rate limiting and caching',
    validationFn: (v) => v.startsWith('https://'),
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    required: false,
    requiredInProduction: true,
    description: 'Upstash Redis token',
    minLength: 20,
  },

  // ==========================================
  // Monitoring - Required in Production
  // ==========================================
  {
    name: 'SENTRY_DSN',
    required: false,
    requiredInProduction: true,
    description: 'Sentry DSN for error tracking',
    validationFn: (v) => v.startsWith('https://') && v.includes('sentry'),
  },
  {
    name: 'NEXT_PUBLIC_SENTRY_DSN',
    required: false,
    requiredInProduction: true,
    description: 'Public Sentry DSN for client-side error tracking',
    validationFn: (v) => v.startsWith('https://') && v.includes('sentry'),
  },

  // ==========================================
  // Application URLs
  // ==========================================
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: true,
    requiredInProduction: true,
    description: 'Public application URL',
    validationFn: (v) => v.startsWith('http://') || v.startsWith('https://'),
  },
  {
    name: 'NEXTAUTH_URL',
    required: false,
    requiredInProduction: true,
    description: 'NextAuth URL (usually same as app URL)',
    validationFn: (v) => v.startsWith('http://') || v.startsWith('https://'),
  },

  // ==========================================
  // Authentication - Required in Production
  // ==========================================
  {
    name: 'NEXTAUTH_SECRET',
    required: false,
    requiredInProduction: true,
    description: 'NextAuth secret for JWT signing',
    minLength: 32,
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    required: false,
    requiredInProduction: false,
    description: 'Google OAuth client ID',
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: false,
    requiredInProduction: false,
    description: 'Google OAuth client secret',
  },

  // ==========================================
  // AI Services - Optional
  // ==========================================
  {
    name: 'OPENAI_API_KEY',
    required: false,
    requiredInProduction: false,
    description: 'OpenAI API key for AI features',
    validationFn: (v) => v.startsWith('sk-'),
  },

  // ==========================================
  // Video/Audio - Optional
  // ==========================================
  {
    name: 'NEXT_PUBLIC_AGORA_APP_ID',
    required: false,
    requiredInProduction: false,
    description: 'Agora App ID for video calls',
  },

  // ==========================================
  // Email Service - Optional (app works without email)
  // ==========================================
  {
    name: 'RESEND_API_KEY',
    required: false,
    requiredInProduction: false, // Made optional - email features will be disabled without it
    description: 'Resend API key for email notifications',
    validationFn: (v) => v.startsWith('re_'),
  },

  // ==========================================
  // Cron Jobs - Required in Production
  // ==========================================
  {
    name: 'CRON_SECRET',
    required: false,
    requiredInProduction: true,
    description: 'Secret for authenticating cron job requests',
    minLength: 32,
  },
]

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  missing: string[]
  invalid: string[]
  criticalMissing: string[]
}

/**
 * Validate all environment variables
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const missing: string[] = []
  const invalid: string[] = []
  const criticalMissing: string[] = []

  for (const config of ENV_SCHEMA) {
    const value = process.env[config.name]
    const isRequired = config.required || (isProduction && config.requiredInProduction)

    // Check if required variable is missing
    if (isRequired && !value) {
      missing.push(config.name)

      // Mark critical security variables
      if (['ENCRYPTION_KEY', 'CSRF_SECRET', 'NEXTAUTH_SECRET'].includes(config.name)) {
        criticalMissing.push(config.name)
        errors.push(`🔴 CRITICAL SECURITY: Missing ${config.name} - ${config.description}`)
      } else if (isProduction && config.requiredInProduction) {
        errors.push(`🟠 PRODUCTION REQUIRED: Missing ${config.name} - ${config.description}`)
      } else {
        errors.push(`Missing required: ${config.name} - ${config.description}`)
      }
      continue
    }

    // Warn about optional variables in production
    if (!isRequired && !value && isProduction) {
      warnings.push(`Optional variable not set: ${config.name}`)
      continue
    }

    // Skip validation if no value
    if (!value) continue

    // Validate value format if validation function provided
    if (config.validationFn && !config.validationFn(value)) {
      invalid.push(config.name)
      errors.push(`Invalid format for ${config.name} - ${config.description}`)
      continue
    }

    // Validate minimum length
    if (config.minLength && value.length < config.minLength) {
      invalid.push(config.name)
      errors.push(`${config.name} must be at least ${config.minLength} characters`)
    }
  }

  const valid = errors.length === 0

  return {
    valid,
    errors,
    warnings,
    missing,
    invalid,
    criticalMissing,
  }
}

/**
 * Log validation results
 */
export function logValidationResults(results: ValidationResult) {
  const divider = '═'.repeat(60)

  console.log('\n' + divider)
  console.log('  ENVIRONMENT VALIDATION')
  console.log(divider)

  if (results.valid) {
    console.log('✅ All required environment variables are set\n')

    if (results.warnings.length > 0) {
      console.log(`⚠️  ${results.warnings.length} optional variables not set:`)
      results.warnings.slice(0, 5).forEach((warning) => console.log(`   - ${warning}`))
      if (results.warnings.length > 5) {
        console.log(`   ... and ${results.warnings.length - 5} more`)
      }
      console.log('')
    }
  } else {
    console.log('❌ ENVIRONMENT VALIDATION FAILED\n')

    if (results.criticalMissing.length > 0) {
      console.log('🔴 CRITICAL SECURITY ISSUES:')
      results.criticalMissing.forEach((name) => {
        console.log(`   ✗ ${name} is missing - application may be insecure!`)
      })
      console.log('')
    }

    console.log(`📋 Summary: ${results.missing.length} missing, ${results.invalid.length} invalid\n`)

    results.errors.forEach((error) => console.log(`   ${error}`))
    console.log('')
  }

  console.log(divider + '\n')
}

/**
 * Validate and exit if critical errors in production
 */
export function validateOrExit(): ValidationResult {
  const results = validateEnvironment()
  logValidationResults(results)

  if (!results.valid) {
    console.error('🛑 Cannot start with missing required environment variables')
    console.error('📖 See .env.example for required configuration\n')

    if (isProduction) {
      // In production, ALWAYS exit on critical security issues
      if (results.criticalMissing.length > 0) {
        console.error('🔐 SECURITY: Critical secrets missing - refusing to start')
        process.exit(1)
      }

      // Exit on any missing production-required vars
      console.error('🔐 PRODUCTION: Required variables missing - refusing to start')
      process.exit(1)
    } else {
      // In development, warn about critical security issues but continue
      if (results.criticalMissing.length > 0) {
        console.warn('⚠️  DEVELOPMENT WARNING: Critical security variables missing')
        console.warn('   Some security features may not work correctly')
      }
      console.warn('⚠️  Running in development mode - continuing despite errors\n')
    }
  }

  return results
}

/**
 * Get environment info for debugging (sanitized - no secrets)
 */
export function getEnvironmentInfo() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction,
    hasDatabase: !!process.env.DATABASE_URL,
    hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAgora: !!process.env.NEXT_PUBLIC_AGORA_APP_ID,
    hasEmail: !!process.env.RESEND_API_KEY,
    hasRedis: !!process.env.UPSTASH_REDIS_REST_URL,
    hasStripe: !!process.env.STRIPE_SECRET_KEY,
    hasSentry: !!process.env.SENTRY_DSN,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
    hasCsrfSecret: !!process.env.CSRF_SECRET,
  }
}

/**
 * Quick check if all critical security variables are set
 */
export function hasAllSecuritySecrets(): boolean {
  return !!(
    process.env.ENCRYPTION_KEY &&
    process.env.CSRF_SECRET &&
    process.env.NEXTAUTH_SECRET
  )
}

/**
 * Export for use in instrumentation.ts
 */
export default {
  validateEnvironment,
  validateOrExit,
  logValidationResults,
  getEnvironmentInfo,
  hasAllSecuritySecrets,
}
