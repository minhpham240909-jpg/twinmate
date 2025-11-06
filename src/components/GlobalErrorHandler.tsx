'use client'

import { useEffect } from 'react'

/**
 * GlobalErrorHandler - Client-side component for handling global errors
 * 
 * This component handles:
 * - className.split TypeError from third-party libraries
 * - Unhandled WebSocket/connection promise rejections
 * - Agora RTC connection errors
 */
export default function GlobalErrorHandler() {
  useEffect(() => {
    // Global error handler for className.split TypeError
    const handleError = (event: ErrorEvent) => {
      if (
        event.message &&
        event.message.includes('className.split') &&
        event.message.includes('is not a function')
      ) {
        console.error('className.split error detected - this is likely from a third-party library:', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        })
        // Prevent the error from breaking the app
        event.preventDefault()
        return true
      }
      
      // Check for CSP violations in error messages
      if (event.message && typeof event.message === 'string') {
        const msg = event.message.toLowerCase()
        if (
          msg.includes('content security policy') ||
          msg.includes('violates the following content security policy directive') ||
          (msg.includes('refused to connect') && msg.includes('wss://'))
        ) {
          console.error('CSP violation detected:', event.message)
          // Don't prevent default - let the app handle it through Agora error handlers
        }
      }
      
      return false
    }

    // Handle unhandled promise rejections related to WebSocket/connection errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason
      if (error && typeof error === 'object') {
        // Check for WebSocket/connection errors
        const errorMessage = error.message || error.toString() || ''
        const isWebSocketError =
          errorMessage.includes('WebSocket') ||
          errorMessage.includes('401') ||
          errorMessage.includes('refused') ||
          errorMessage.includes('connection') ||
          error.code === 'PERMISSION_DENIED' ||
          error.name === 'NotAllowedError' ||
          error.name === 'NetworkError'

        if (isWebSocketError) {
          console.error('Unhandled WebSocket/connection error:', error)
          // Log but don't break the app - let our error handlers deal with it
          event.preventDefault()
        }
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  // This component doesn't render anything
  return null
}

