// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

// Only initialize if DSN is provided
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Lower sample rate in production to control costs
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Only enable Sentry in production
    enabled: process.env.NODE_ENV === 'production',

    // Environment tag
    environment: process.env.NODE_ENV,

    // Ignore specific errors
    ignoreErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'socket hang up',
    ],

    // Filter sensitive data
    beforeSend(event) {
      // Don't send events if in development
      if (process.env.NODE_ENV !== 'production') {
        return null
      }

      // Remove sensitive data
      if (event.request) {
        delete event.request.cookies
        delete event.request.headers
      }

      // Remove query parameters that might contain sensitive data
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url)
          url.search = '' // Remove all query parameters
          event.request.url = url.toString()
        } catch {
          // Invalid URL, leave as is
        }
      }

      return event
    },
  })
} else if (process.env.NODE_ENV === 'production') {
  console.warn('⚠️  Sentry DSN not configured - error tracking disabled')
}
