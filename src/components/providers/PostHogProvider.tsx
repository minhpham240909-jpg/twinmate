'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [posthogClient, setPosthogClient] = useState<any>(null)

  // Initialize PostHog on mount - dynamically import to avoid webpack issues
  useEffect(() => {
    if (typeof window === 'undefined') return

    import('@/lib/posthog/client').then(({ initPostHog, posthog }) => {
      initPostHog()
      setPosthogClient(posthog)
    }).catch((err) => {
      console.warn('[PostHog] Failed to load:', err)
    })
  }, [])

  // Track page views on route change
  useEffect(() => {
    if (pathname && posthogClient) {
      let url = window.origin + pathname
      if (searchParams?.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      posthogClient.capture('$pageview', {
        $current_url: url,
      })
    }
  }, [pathname, searchParams, posthogClient])

  return <>{children}</>
}
