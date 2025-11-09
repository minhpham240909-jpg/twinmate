/**
 * Web Vitals Monitoring
 * Tracks Core Web Vitals and reports to Sentry
 * 
 * Metrics tracked:
 * - LCP (Largest Contentful Paint) - Target < 2.5s
 * - INP (Interaction to Next Paint) - Target < 200ms
 * - CLS (Cumulative Layout Shift) - Target < 0.1
 * - FCP (First Contentful Paint) - Target < 1.8s
 * - TTFB (Time to First Byte) - Target < 600ms
 */

import * as Sentry from '@sentry/nextjs'
import type { Metric } from 'web-vitals'

/**
 * Report Web Vitals to Sentry
 * Called automatically by Next.js when metrics are available
 */
export function reportWebVitals(metric: Metric) {
  // Only report in production
  if (process.env.NODE_ENV !== 'production') {
    // Log to console in development
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
    })
    return
  }

  // Determine if metric is good, needs improvement, or poor
  const rating = metric.rating || getMetricRating(metric)
  
  // Report to Sentry with appropriate level
  const level = rating === 'good' ? 'info' : rating === 'needs-improvement' ? 'warning' : 'error'
  
  Sentry.addBreadcrumb({
    category: 'web-vitals',
    message: `${metric.name}: ${Math.round(metric.value)}`,
    level,
    data: {
      name: metric.name,
      value: metric.value,
      rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
    },
  })

  // For poor metrics, capture as Sentry message for alerting
  if (rating === 'poor') {
    Sentry.captureMessage(`Poor ${metric.name}: ${Math.round(metric.value)}`, {
      level: 'warning',
      tags: {
        metric_name: metric.name,
        metric_rating: rating,
      },
      extra: {
        value: metric.value,
        delta: metric.delta,
        id: metric.id,
      },
    })
  }
}

/**
 * Determine metric rating based on Web Vitals thresholds
 */
function getMetricRating(metric: Metric): 'good' | 'needs-improvement' | 'poor' {
  const { name, value } = metric
  
  switch (name) {
    case 'LCP':
      // Largest Contentful Paint
      if (value <= 2500) return 'good'
      if (value <= 4000) return 'needs-improvement'
      return 'poor'
      
    case 'INP':
      // Interaction to Next Paint
      if (value <= 200) return 'good'
      if (value <= 500) return 'needs-improvement'
      return 'poor'
      
    case 'CLS':
      // Cumulative Layout Shift
      if (value <= 0.1) return 'good'
      if (value <= 0.25) return 'needs-improvement'
      return 'poor'
      
    case 'FCP':
      // First Contentful Paint
      if (value <= 1800) return 'good'
      if (value <= 3000) return 'needs-improvement'
      return 'poor'
      
    case 'TTFB':
      // Time to First Byte
      if (value <= 600) return 'good'
      if (value <= 1800) return 'needs-improvement'
      return 'poor'
      
    default:
      return 'good'
  }
}

/**
 * Initialize Web Vitals reporting
 * Call this in your app entry point (_app.tsx or layout.tsx)
 */
export function initWebVitals() {
  if (typeof window === 'undefined') return
  
  // Dynamically import web-vitals to reduce initial bundle
  import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
    onCLS(reportWebVitals)
    onINP(reportWebVitals)
    onFCP(reportWebVitals)
    onLCP(reportWebVitals)
    onTTFB(reportWebVitals)
  })
}
