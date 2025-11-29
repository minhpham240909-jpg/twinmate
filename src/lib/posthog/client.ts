// PostHog Analytics Client
// This is your CEO analytics dashboard data source

import posthog from 'posthog-js'

// Initialize PostHog only on client side
export const initPostHog = () => {
  if (typeof window === 'undefined') return

  // Only initialize once
  if (posthog.__loaded) return

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

  if (!posthogKey) {
    console.warn('[PostHog] No API key found. Analytics disabled.')
    return
  }

  posthog.init(posthogKey, {
    api_host: posthogHost,
    person_profiles: 'identified_only', // Only track identified users
    capture_pageview: true, // Auto-capture page views
    capture_pageleave: true, // Track when users leave
    autocapture: true, // Auto-capture clicks, form submissions, etc.
    persistence: 'localStorage',
    disable_session_recording: false, // Enable session recordings
    session_recording: {
      maskAllInputs: false, // Don't mask inputs (adjust for privacy needs)
      maskInputOptions: {
        password: true, // Always mask passwords
      },
    },
    loaded: (posthog) => {
      // Enable debug mode in development
      if (process.env.NODE_ENV === 'development') {
        posthog.debug()
      }
    },
  })
}

// Identify user (call after login)
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  if (typeof window === 'undefined') return

  posthog.identify(userId, {
    ...properties,
    identified_at: new Date().toISOString(),
  })
}

// Reset user (call after logout)
export const resetUser = () => {
  if (typeof window === 'undefined') return
  posthog.reset()
}

// Track custom events
export const trackEvent = (
  eventName: string,
  properties?: Record<string, any>
) => {
  if (typeof window === 'undefined') return

  posthog.capture(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
  })
}

// =====================================================
// CEO METRICS - Key Events to Track
// =====================================================

// User lifecycle events
export const trackUserSignup = (userId: string, method: 'email' | 'google') => {
  trackEvent('user_signup', { user_id: userId, signup_method: method })
}

export const trackUserLogin = (userId: string, method: 'email' | 'google') => {
  trackEvent('user_login', { user_id: userId, login_method: method })
}

export const trackUserLogout = (userId: string) => {
  trackEvent('user_logout', { user_id: userId })
}

export const trackOnboardingComplete = (userId: string) => {
  trackEvent('onboarding_complete', { user_id: userId })
}

// Core feature events
export const trackMatchRequest = (senderId: string, receiverId: string) => {
  trackEvent('match_request_sent', { sender_id: senderId, receiver_id: receiverId })
}

export const trackMatchAccepted = (senderId: string, receiverId: string) => {
  trackEvent('match_accepted', { sender_id: senderId, receiver_id: receiverId })
}

export const trackMessageSent = (
  senderId: string,
  messageType: 'dm' | 'group',
  groupId?: string
) => {
  trackEvent('message_sent', {
    sender_id: senderId,
    message_type: messageType,
    group_id: groupId,
  })
}

export const trackCallStarted = (
  userId: string,
  callType: 'dm' | 'group' | 'study_session',
  participantCount: number
) => {
  trackEvent('call_started', {
    user_id: userId,
    call_type: callType,
    participant_count: participantCount,
  })
}

export const trackCallEnded = (
  userId: string,
  callType: 'dm' | 'group' | 'study_session',
  durationSeconds: number
) => {
  trackEvent('call_ended', {
    user_id: userId,
    call_type: callType,
    duration_seconds: durationSeconds,
  })
}

// Study session events
export const trackStudySessionCreated = (
  userId: string,
  sessionType: 'solo' | 'one_on_one' | 'group'
) => {
  trackEvent('study_session_created', {
    user_id: userId,
    session_type: sessionType,
  })
}

export const trackStudySessionJoined = (userId: string, sessionId: string) => {
  trackEvent('study_session_joined', {
    user_id: userId,
    session_id: sessionId,
  })
}

export const trackStudySessionEnded = (
  sessionId: string,
  durationMinutes: number,
  participantCount: number
) => {
  trackEvent('study_session_ended', {
    session_id: sessionId,
    duration_minutes: durationMinutes,
    participant_count: participantCount,
  })
}

// Group events
export const trackGroupCreated = (userId: string, groupId: string, privacy: string) => {
  trackEvent('group_created', {
    user_id: userId,
    group_id: groupId,
    privacy: privacy,
  })
}

export const trackGroupJoined = (userId: string, groupId: string) => {
  trackEvent('group_joined', { user_id: userId, group_id: groupId })
}

// Community/Social events
export const trackPostCreated = (userId: string, hasImage: boolean) => {
  trackEvent('post_created', { user_id: userId, has_image: hasImage })
}

export const trackPostLiked = (userId: string, postId: string) => {
  trackEvent('post_liked', { user_id: userId, post_id: postId })
}

// Subscription events (important for revenue!)
export const trackSubscriptionStarted = (userId: string, plan: string) => {
  trackEvent('subscription_started', { user_id: userId, plan: plan })
}

export const trackSubscriptionCancelled = (userId: string, plan: string, reason?: string) => {
  trackEvent('subscription_cancelled', {
    user_id: userId,
    plan: plan,
    cancellation_reason: reason,
  })
}

// Feature usage tracking
export const trackFeatureUsed = (userId: string, featureName: string) => {
  trackEvent('feature_used', { user_id: userId, feature: featureName })
}

// Error tracking
export const trackError = (
  errorType: string,
  errorMessage: string,
  userId?: string
) => {
  trackEvent('app_error', {
    error_type: errorType,
    error_message: errorMessage,
    user_id: userId,
  })
}

// Search tracking
export const trackSearch = (userId: string, searchQuery: string, resultCount: number) => {
  trackEvent('search_performed', {
    user_id: userId,
    search_query: searchQuery,
    result_count: resultCount,
  })
}

// Export posthog instance for advanced usage
export { posthog }
