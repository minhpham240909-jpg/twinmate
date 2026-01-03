'use client'

import { Component, ErrorInfo, ReactNode } from 'react'
import { usePresence } from '@/hooks/usePresence'

// Error boundary wrapper to prevent presence errors from crashing the app
class PresenceErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error for debugging but don't crash the app
    console.error('[PresenceProvider] Error caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // Silently fail - presence is non-critical functionality
      // The app should continue working without presence tracking
      return this.props.children
    }

    return this.props.children
  }
}

// Inner component that uses the presence hook
function PresenceTracker({ children }: { children: ReactNode }) {
  // Automatically start heartbeat when component mounts
  // Wrapped in try-catch to prevent hook errors from propagating
  try {
    usePresence()
  } catch (error) {
    // Silently fail - presence is non-critical
    console.error('[PresenceProvider] Hook error:', error)
  }

  return <>{children}</>
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  return (
    <PresenceErrorBoundary>
      <PresenceTracker>{children}</PresenceTracker>
    </PresenceErrorBoundary>
  )
}
