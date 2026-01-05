'use client'

import dynamic from 'next/dynamic'

// Dynamically import Analytics with no SSR to avoid webpack issues
const Analytics = dynamic(
  () => import('@vercel/analytics/react').then((mod) => mod.Analytics),
  { ssr: false }
)

export default function AnalyticsProvider() {
  return <Analytics />
}
