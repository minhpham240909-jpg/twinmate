/**
 * Runtime Configuration Validator
 * Validates that required environment variables are properly configured
 */

interface ConfigValidationError {
  variable: string
  issue: string
}

/**
 * Validate required environment variables at runtime
 * Should be called in client-side code only (not during build)
 * @throws Error if required configuration is missing or invalid
 */
export function validateConfig(): void {
  // Only run validation in browser (skip during SSR/build)
  if (typeof window === 'undefined') {
    return
  }

  const errors: ConfigValidationError[] = []

  // Required environment variables
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_AGORA_APP_ID',
  ]

  // Check each required variable
  for (const varName of requiredVars) {
    const value = process.env[varName]

    if (!value) {
      errors.push({
        variable: varName,
        issue: 'Missing or undefined',
      })
    } else if (value.includes('placeholder')) {
      errors.push({
        variable: varName,
        issue: 'Using placeholder value - real configuration required',
      })
    } else if (value.trim().length === 0) {
      errors.push({
        variable: varName,
        issue: 'Empty value',
      })
    }
  }

  // If there are errors, throw with detailed message
  if (errors.length > 0) {
    const errorMessages = errors
      .map((err) => `  - ${err.variable}: ${err.issue}`)
      .join('\n')

    throw new Error(
      `❌ Configuration Error: Required environment variables are not properly configured.\n\n${errorMessages}\n\nPlease check your .env.local file and ensure all required variables are set with valid values.`
    )
  }

  console.log('✅ Configuration validated successfully')
}

/**
 * Validate configuration silently and return validation result
 * @returns Object with isValid flag and array of errors
 */
export function checkConfig(): {
  isValid: boolean
  errors: ConfigValidationError[]
} {
  if (typeof window === 'undefined') {
    return { isValid: true, errors: [] }
  }

  const errors: ConfigValidationError[] = []

  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_AGORA_APP_ID',
  ]

  for (const varName of requiredVars) {
    const value = process.env[varName]

    if (!value) {
      errors.push({ variable: varName, issue: 'Missing' })
    } else if (value.includes('placeholder')) {
      errors.push({ variable: varName, issue: 'Placeholder value' })
    } else if (value.trim().length === 0) {
      errors.push({ variable: varName, issue: 'Empty' })
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Get safe display value for environment variable (for debugging)
 * Masks most of the value for security
 */
export function getSafeEnvValue(varName: string): string {
  const value = process.env[varName]
  if (!value) return '❌ NOT SET'
  if (value.includes('placeholder')) return '⚠️  PLACEHOLDER'
  if (value.length <= 10) return '✓ SET'
  return `✓ ${value.substring(0, 8)}...${value.substring(value.length - 4)}`
}
