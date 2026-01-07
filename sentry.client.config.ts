// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

// Only initialize if DSN is provided
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Lower sample rate in production to control costs
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Session Replay DISABLED - Using PostHog for session recordings instead
    // This prevents "Multiple Sentry Session Replay instances" error
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,

    // No replay integration - PostHog handles session recordings
    integrations: [],

    // Only enable Sentry in production
    enabled: process.env.NODE_ENV === 'production',

    // Ignore specific errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Random plugins/extensions
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      // Facebook borked
      'fb_xd_fragment',
      // Network errors
      'NetworkError',
      'Non-Error promise rejection captured',
      // Chunk loading errors (common in SPAs)
      'Loading chunk',
      'ChunkLoadError',
    ],

    // Filter sensitive data
    beforeSend(event) {
      // Don't send events if user is in development
      if (process.env.NODE_ENV !== 'production') {
        return null
      }

      // Remove sensitive data
      if (event.request) {
        delete event.request.cookies
        delete event.request.headers
      }

      return event
    },
  })
}
