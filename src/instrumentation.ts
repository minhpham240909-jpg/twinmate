/**
 * Next.js Instrumentation
 *
 * This file runs ONCE when the server starts.
 * Used for:
 * - Environment validation
 * - Sentry initialization
 * - Other startup tasks
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import dynamically to avoid client-side issues
    const { validateEnvironment, logValidationResults, getEnvironmentInfo } = await import('./lib/env-validator')

    console.log('\n🚀 Starting Clerva Server...\n')

    // Validate environment variables - LOG but don't exit
    // This allows the app to start so we can debug issues
    const results = validateEnvironment()
    logValidationResults(results)

    if (!results.valid) {
      console.warn('⚠️  Some environment variables are missing - app may have limited functionality')
      console.warn('   Missing:', results.missing.join(', '))
    }

    // Log environment info (sanitized)
    const envInfo = getEnvironmentInfo()
    console.log('📦 Environment Configuration:')
    console.log(`   - Mode: ${envInfo.nodeEnv}`)
    console.log(`   - Database: ${envInfo.hasDatabase ? '✓' : '✗'}`)
    console.log(`   - Supabase: ${envInfo.hasSupabase ? '✓' : '✗'}`)
    console.log(`   - Redis: ${envInfo.hasRedis ? '✓' : '✗'}`)
    console.log(`   - Sentry: ${envInfo.hasSentry ? '✓' : '✗'}`)
    console.log(`   - Email: ${envInfo.hasEmail ? '✓' : '✗'}`)
    console.log(`   - OpenAI: ${envInfo.hasOpenAI ? '✓' : '✗'}`)
    console.log(`   - Agora: ${envInfo.hasAgora ? '✓' : '✗'}`)
    console.log('')

    // Initialize Sentry for server-side error tracking
    if (process.env.SENTRY_DSN) {
      try {
        const Sentry = await import('@sentry/nextjs')
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV,
          tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
          debug: process.env.NODE_ENV === 'development',
        })
        console.log('✅ Sentry initialized for server-side error tracking\n')
      } catch (error) {
        console.warn('⚠️  Failed to initialize Sentry:', error)
      }
    }

    console.log('✅ Server initialization complete\n')
  }
}
