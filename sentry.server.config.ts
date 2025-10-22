// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Only enable Sentry in production
  enabled: process.env.NODE_ENV === 'production',

  // Ignore specific errors
  ignoreErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'socket hang up',
  ],

  // Filter sensitive data
  beforeSend(event, hint) {
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
      } catch (e) {
        // Invalid URL, leave as is
      }
    }

    return event
  },
})
