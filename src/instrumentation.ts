/**
 * Next.js Instrumentation
 *
 * This file runs ONCE when the server starts.
 * Used for:
 * - Environment validation
 * - Sentry initialization
 * - Global error handlers
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

    // =========================================================================
    // GLOBAL ERROR HANDLERS - Prevent server crashes from unhandled errors
    // =========================================================================

    // Track if handlers are already registered (prevent duplicates on hot reload)
    const globalWithHandlers = global as typeof globalThis & {
      __unhandledRejectionHandlerRegistered?: boolean
      __uncaughtExceptionHandlerRegistered?: boolean
    }

    // Handle unhandled promise rejections
    if (!globalWithHandlers.__unhandledRejectionHandlerRegistered) {
      process.on('unhandledRejection', async (reason: unknown, promise: Promise<unknown>) => {
        console.error('🔴 [UNHANDLED REJECTION] Promise rejected without .catch():', reason)

        // Log to Sentry if available
        try {
          if (process.env.SENTRY_DSN) {
            const Sentry = await import('@sentry/nextjs')
            Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)), {
              tags: {
                type: 'unhandled_rejection',
              },
              extra: {
                promise: String(promise),
              },
            })
          }
        } catch {
          // Sentry logging failed, already logged to console
        }

        // In development, log stack trace for debugging
        if (process.env.NODE_ENV === 'development' && reason instanceof Error) {
          console.error('Stack trace:', reason.stack)
        }
      })
      globalWithHandlers.__unhandledRejectionHandlerRegistered = true
      console.log('✅ Unhandled rejection handler registered')
    }

    // Handle uncaught exceptions (last resort - should rarely fire)
    if (!globalWithHandlers.__uncaughtExceptionHandlerRegistered) {
      process.on('uncaughtException', async (error: Error) => {
        console.error('🔴 [UNCAUGHT EXCEPTION] Error escaped all handlers:', error.message)
        console.error('Stack:', error.stack)

        // Log to Sentry if available
        try {
          if (process.env.SENTRY_DSN) {
            const Sentry = await import('@sentry/nextjs')
            Sentry.captureException(error, {
              tags: {
                type: 'uncaught_exception',
                fatal: 'true',
              },
            })
            // Flush Sentry events before potential crash
            await Sentry.flush(2000)
          }
        } catch {
          // Sentry logging failed
        }

        // Don't exit in development to allow debugging
        // In production, the process manager (PM2/Docker) will restart
        if (process.env.NODE_ENV === 'production') {
          console.error('🔴 Server will continue running but may be in unstable state')
        }
      })
      globalWithHandlers.__uncaughtExceptionHandlerRegistered = true
      console.log('✅ Uncaught exception handler registered')
    }

    // =========================================================================
    // ENVIRONMENT VALIDATION
    // =========================================================================

    // Validate environment variables - LOG but don't exit
    // This allows the app to start so we can debug issues
    const results = validateEnvironment()
    logValidationResults(results)

    if (!results.valid) {
      console.warn('⚠️  Some environment variables are missing - app may have limited functionality')
      console.warn('   Missing:', results.missing.join(', '))

      // Critical security warning in production
      if (process.env.NODE_ENV === 'production' && results.criticalMissing.length > 0) {
        console.error('')
        console.error('🔴 ════════════════════════════════════════════════════════')
        console.error('🔴  CRITICAL SECURITY WARNING - PRODUCTION MODE')
        console.error('🔴 ════════════════════════════════════════════════════════')
        console.error('🔴  Missing security variables:', results.criticalMissing.join(', '))
        console.error('🔴  The application may be INSECURE without these variables!')
        console.error('🔴 ════════════════════════════════════════════════════════')
        console.error('')
      }
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

    // =========================================================================
    // SENTRY INITIALIZATION
    // =========================================================================

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
        console.error('🔴 [CRITICAL] Failed to initialize Sentry:', error)
        console.error('   Error monitoring will NOT be available!')
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️  SENTRY_DSN not configured - error monitoring disabled in production')
    }

    console.log('✅ Server initialization complete\n')
  }
}
