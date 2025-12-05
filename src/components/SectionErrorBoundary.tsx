'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  children: ReactNode
  section: 'chat' | 'sessions' | 'groups' | 'community' | 'profile' | 'settings' | 'generic'
  fallbackMessage?: string
  onRetry?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Section-Specific Error Boundary
 * 
 * Catches errors in specific feature sections without crashing the entire page.
 * Each section can have its own themed fallback UI.
 * 
 * Usage:
 * ```tsx
 * <SectionErrorBoundary section="chat">
 *   <ChatComponent />
 * </SectionErrorBoundary>
 * ```
 */
export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${this.props.section.toUpperCase()}] Error:`, error, errorInfo)
    }

    // Report to Sentry with section context
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
        section: {
          name: this.props.section,
        },
      },
      tags: {
        section: this.props.section,
        errorType: 'component_error',
      },
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  // Get section-specific styling and messaging
  getSectionConfig() {
    const configs = {
      chat: {
        icon: '💬',
        title: 'Chat Unavailable',
        description: 'We couldn\'t load the chat. Your messages are safe.',
        color: 'blue',
        bgClass: 'bg-blue-50 dark:bg-blue-900/20',
        borderClass: 'border-blue-200 dark:border-blue-800',
        textClass: 'text-blue-700 dark:text-blue-300',
        buttonClass: 'bg-blue-600 hover:bg-blue-700',
      },
      sessions: {
        icon: '📚',
        title: 'Study Sessions Error',
        description: 'There was a problem loading your study sessions.',
        color: 'purple',
        bgClass: 'bg-purple-50 dark:bg-purple-900/20',
        borderClass: 'border-purple-200 dark:border-purple-800',
        textClass: 'text-purple-700 dark:text-purple-300',
        buttonClass: 'bg-purple-600 hover:bg-purple-700',
      },
      groups: {
        icon: '👥',
        title: 'Groups Error',
        description: 'We couldn\'t load the groups section.',
        color: 'green',
        bgClass: 'bg-green-50 dark:bg-green-900/20',
        borderClass: 'border-green-200 dark:border-green-800',
        textClass: 'text-green-700 dark:text-green-300',
        buttonClass: 'bg-green-600 hover:bg-green-700',
      },
      community: {
        icon: '🌐',
        title: 'Community Error',
        description: 'The community section encountered an error.',
        color: 'orange',
        bgClass: 'bg-orange-50 dark:bg-orange-900/20',
        borderClass: 'border-orange-200 dark:border-orange-800',
        textClass: 'text-orange-700 dark:text-orange-300',
        buttonClass: 'bg-orange-600 hover:bg-orange-700',
      },
      profile: {
        icon: '👤',
        title: 'Profile Error',
        description: 'We couldn\'t load your profile information.',
        color: 'cyan',
        bgClass: 'bg-cyan-50 dark:bg-cyan-900/20',
        borderClass: 'border-cyan-200 dark:border-cyan-800',
        textClass: 'text-cyan-700 dark:text-cyan-300',
        buttonClass: 'bg-cyan-600 hover:bg-cyan-700',
      },
      settings: {
        icon: '⚙️',
        title: 'Settings Error',
        description: 'There was a problem loading settings.',
        color: 'gray',
        bgClass: 'bg-gray-50 dark:bg-gray-900/20',
        borderClass: 'border-gray-200 dark:border-gray-800',
        textClass: 'text-gray-700 dark:text-gray-300',
        buttonClass: 'bg-gray-600 hover:bg-gray-700',
      },
      generic: {
        icon: '⚠️',
        title: 'Something Went Wrong',
        description: 'This section encountered an error.',
        color: 'red',
        bgClass: 'bg-red-50 dark:bg-red-900/20',
        borderClass: 'border-red-200 dark:border-red-800',
        textClass: 'text-red-700 dark:text-red-300',
        buttonClass: 'bg-red-600 hover:bg-red-700',
      },
    }

    return configs[this.props.section] || configs.generic
  }

  render() {
    if (this.state.hasError) {
      const config = this.getSectionConfig()
      const message = this.props.fallbackMessage || config.description

      return (
        <div className={`rounded-xl p-6 border ${config.bgClass} ${config.borderClass}`}>
          <div className="flex items-start gap-4">
            <div className="text-3xl">{config.icon}</div>
            <div className="flex-1">
              <h3 className={`font-semibold text-lg ${config.textClass}`}>
                {config.title}
              </h3>
              <p className={`mt-1 text-sm ${config.textClass} opacity-80`}>
                {message}
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-3">
                  <summary className={`text-sm cursor-pointer ${config.textClass} opacity-70 hover:opacity-100`}>
                    Show error details
                  </summary>
                  <pre className="mt-2 p-3 bg-black/10 dark:bg-white/10 rounded text-xs overflow-x-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}

              <div className="mt-4 flex gap-3">
                <button
                  onClick={this.handleRetry}
                  className={`px-4 py-2 text-sm text-white rounded-lg transition ${config.buttonClass}`}
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 text-sm bg-white/50 dark:bg-black/20 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white/70 dark:hover:bg-black/30 transition"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Convenience wrappers for each section
export function ChatErrorBoundary({ children }: { children: ReactNode }) {
  return <SectionErrorBoundary section="chat">{children}</SectionErrorBoundary>
}

export function SessionsErrorBoundary({ children }: { children: ReactNode }) {
  return <SectionErrorBoundary section="sessions">{children}</SectionErrorBoundary>
}

export function GroupsErrorBoundary({ children }: { children: ReactNode }) {
  return <SectionErrorBoundary section="groups">{children}</SectionErrorBoundary>
}

export function CommunityErrorBoundary({ children }: { children: ReactNode }) {
  return <SectionErrorBoundary section="community">{children}</SectionErrorBoundary>
}

