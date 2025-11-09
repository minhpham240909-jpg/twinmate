'use client'

import { useEffect } from 'react'
import { initWebVitals } from '@/lib/monitoring/web-vitals'

/**
 * Client-side component to initialize Web Vitals reporting
 * Must be rendered in the root layout to track all page metrics
 */
export default function WebVitalsReporter() {
  useEffect(() => {
    initWebVitals()
  }, [])

  return null
}
