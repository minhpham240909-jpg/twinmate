/**
 * Load Testing Utilities
 *
 * Configuration and utilities for load testing the Clerva application
 * to validate 1000-3000 concurrent user support.
 *
 * Usage:
 * - Run locally with k6: k6 run --vus 100 --duration 60s scripts/load-test.js
 * - Or use the built-in stress test endpoint (admin only)
 */

// =============================================================================
// LOAD TEST CONFIGURATION
// =============================================================================

export const LOAD_TEST_CONFIG = {
  // Target concurrent users
  targetUsers: {
    low: 100,
    medium: 500,
    high: 1500,
    extreme: 3000,
  },

  // Test scenarios
  scenarios: {
    // Simulate normal usage pattern
    normalUsage: {
      virtualUsers: 500,
      duration: '5m',
      rampUp: '1m',
      rampDown: '30s',
      endpoints: [
        { path: '/api/posts', weight: 30 },
        { path: '/api/connections', weight: 15 },
        { path: '/api/presence/heartbeat', weight: 20 },
        { path: '/api/ai-partner/sessions', weight: 10 },
        { path: '/api/notifications', weight: 15 },
        { path: '/api/health', weight: 10 },
      ],
    },

    // Spike test - sudden increase in traffic
    spikeTest: {
      virtualUsers: 3000,
      duration: '2m',
      rampUp: '10s', // Very fast ramp up
      rampDown: '30s',
      endpoints: [
        { path: '/api/posts', weight: 40 },
        { path: '/api/presence/heartbeat', weight: 30 },
        { path: '/api/ai-partner/chat', weight: 30 },
      ],
    },

    // Soak test - sustained load over time
    soakTest: {
      virtualUsers: 1000,
      duration: '30m',
      rampUp: '5m',
      rampDown: '2m',
      endpoints: [
        { path: '/api/posts', weight: 25 },
        { path: '/api/connections', weight: 15 },
        { path: '/api/presence/heartbeat', weight: 25 },
        { path: '/api/ai-partner/sessions', weight: 15 },
        { path: '/api/notifications', weight: 10 },
        { path: '/api/health', weight: 10 },
      ],
    },

    // AI Partner stress test
    aiPartnerStress: {
      virtualUsers: 500,
      duration: '5m',
      rampUp: '1m',
      rampDown: '30s',
      endpoints: [
        { path: '/api/ai-partner/chat', weight: 50 },
        { path: '/api/ai-partner/quiz', weight: 25 },
        { path: '/api/ai-partner/flashcards', weight: 25 },
      ],
    },
  },

  // Expected thresholds
  thresholds: {
    // 95th percentile response time should be under 2s
    p95ResponseTime: 2000,

    // 99th percentile should be under 5s
    p99ResponseTime: 5000,

    // Error rate should be under 1%
    maxErrorRate: 0.01,

    // Minimum throughput (requests per second)
    minThroughput: 100,

    // Maximum concurrent connections
    maxConnections: 3000,
  },
}

// =============================================================================
// STRESS TEST METRICS COLLECTOR
// =============================================================================

interface StressTestMetrics {
  startTime: Date
  endTime?: Date
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  avgResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  maxResponseTime: number
  minResponseTime: number
  requestsPerSecond: number
  errorsByType: Record<string, number>
  responseTimes: number[]
}

let currentTestMetrics: StressTestMetrics | null = null

export function startStressTest(): void {
  currentTestMetrics = {
    startTime: new Date(),
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
    requestsPerSecond: 0,
    errorsByType: {},
    responseTimes: [],
  }
}

export function recordRequest(
  success: boolean,
  responseTimeMs: number,
  errorType?: string
): void {
  if (!currentTestMetrics) return

  currentTestMetrics.totalRequests++
  currentTestMetrics.responseTimes.push(responseTimeMs)

  if (success) {
    currentTestMetrics.successfulRequests++
  } else {
    currentTestMetrics.failedRequests++
    if (errorType) {
      currentTestMetrics.errorsByType[errorType] =
        (currentTestMetrics.errorsByType[errorType] || 0) + 1
    }
  }

  // Update min/max
  currentTestMetrics.maxResponseTime = Math.max(
    currentTestMetrics.maxResponseTime,
    responseTimeMs
  )
  currentTestMetrics.minResponseTime = Math.min(
    currentTestMetrics.minResponseTime,
    responseTimeMs
  )
}

export function getStressTestResults(): StressTestMetrics | null {
  if (!currentTestMetrics) return null

  const metrics = { ...currentTestMetrics }
  metrics.endTime = new Date()

  // Calculate statistics
  const sortedTimes = [...metrics.responseTimes].sort((a, b) => a - b)
  const count = sortedTimes.length

  if (count > 0) {
    metrics.avgResponseTime =
      sortedTimes.reduce((a, b) => a + b, 0) / count

    metrics.p95ResponseTime =
      sortedTimes[Math.floor(count * 0.95)] || metrics.avgResponseTime

    metrics.p99ResponseTime =
      sortedTimes[Math.floor(count * 0.99)] || metrics.p95ResponseTime

    const durationSeconds =
      (metrics.endTime.getTime() - metrics.startTime.getTime()) / 1000
    metrics.requestsPerSecond = metrics.totalRequests / durationSeconds
  }

  // Clean up large array for response
  metrics.responseTimes = []

  return metrics
}

export function stopStressTest(): StressTestMetrics | null {
  const results = getStressTestResults()
  currentTestMetrics = null
  return results
}

// =============================================================================
// CAPACITY ESTIMATOR
// =============================================================================

export interface CapacityEstimate {
  currentCapacity: number
  bottlenecks: string[]
  recommendations: string[]
  estimated: {
    database: number
    openai: number
    rateLimit: number
    memory: number
  }
}

export function estimateCapacity(
  metrics?: StressTestMetrics
): CapacityEstimate {
  const bottlenecks: string[] = []
  const recommendations: string[] = []

  // Database capacity (based on connection pool and query performance)
  const dbPoolSize = parseInt(process.env.DATABASE_POOL_SIZE || '25', 10)
  const dbCapacity = dbPoolSize * 100 // Rough estimate: 100 req/sec per connection

  // OpenAI capacity (based on rate limits)
  const openaiRPM = parseInt(
    process.env.OPENAI_REQUESTS_PER_MINUTE || '450',
    10
  )
  const openaiCapacity = openaiRPM * 60 // Per hour capacity

  // Rate limit capacity
  const rateLimitDefault = parseInt(
    process.env.RATE_LIMIT_DEFAULT || '60',
    10
  )
  const rateLimitCapacity = rateLimitDefault * 3000 // Assuming 3000 users

  // Memory estimate (Node.js heap)
  const memoryPerUser = 50 * 1024 // ~50KB per user session
  const availableMemory = 512 * 1024 * 1024 // Assume 512MB
  const memoryCapacity = Math.floor(availableMemory / memoryPerUser)

  // Identify bottlenecks
  const minCapacity = Math.min(
    dbCapacity,
    openaiCapacity,
    rateLimitCapacity,
    memoryCapacity
  )

  if (dbCapacity === minCapacity) {
    bottlenecks.push('Database connection pool')
    recommendations.push('Increase DATABASE_POOL_SIZE or use connection pooling (PgBouncer)')
  }

  if (openaiCapacity === minCapacity) {
    bottlenecks.push('OpenAI API rate limits')
    recommendations.push('Upgrade OpenAI tier or implement more aggressive caching')
  }

  if (rateLimitCapacity === minCapacity) {
    bottlenecks.push('API rate limiting')
    recommendations.push('Increase RATE_LIMIT_DEFAULT for verified users')
  }

  if (memoryCapacity === minCapacity) {
    bottlenecks.push('Server memory')
    recommendations.push('Increase instance memory or optimize session storage')
  }

  // Add recommendations based on metrics
  if (metrics) {
    if (metrics.p95ResponseTime > 2000) {
      recommendations.push('Optimize slow database queries (p95 > 2s)')
    }
    if (metrics.failedRequests / metrics.totalRequests > 0.01) {
      recommendations.push('Investigate high error rate (> 1%)')
    }
  }

  return {
    currentCapacity: minCapacity,
    bottlenecks,
    recommendations,
    estimated: {
      database: dbCapacity,
      openai: openaiCapacity,
      rateLimit: rateLimitCapacity,
      memory: memoryCapacity,
    },
  }
}

// =============================================================================
// K6 SCRIPT GENERATOR
// =============================================================================

export function generateK6Script(scenario: keyof typeof LOAD_TEST_CONFIG.scenarios): string {
  const config = LOAD_TEST_CONFIG.scenarios[scenario]
  const thresholds = LOAD_TEST_CONFIG.thresholds

  return `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '${config.rampUp}', target: ${config.virtualUsers} },
    { duration: '${config.duration}', target: ${config.virtualUsers} },
    { duration: '${config.rampDown}', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<${thresholds.p95ResponseTime}', 'p(99)<${thresholds.p99ResponseTime}'],
    errors: ['rate<${thresholds.maxErrorRate}'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN; // Set via environment

const endpoints = ${JSON.stringify(config.endpoints, null, 2)};

function selectEndpoint() {
  const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;

  for (const endpoint of endpoints) {
    random -= endpoint.weight;
    if (random <= 0) return endpoint.path;
  }

  return endpoints[0].path;
}

export default function() {
  const endpoint = selectEndpoint();
  const url = \`\${BASE_URL}\${endpoint}\`;

  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { 'Authorization': \`Bearer \${AUTH_TOKEN}\` } : {}),
    },
  };

  const res = http.get(url, params);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < ${thresholds.p95ResponseTime}ms': (r) => r.timings.duration < ${thresholds.p95ResponseTime},
  });

  errorRate.add(!success);

  // Think time between requests
  sleep(Math.random() * 2 + 1);
}
`;
}

export default {
  LOAD_TEST_CONFIG,
  startStressTest,
  recordRequest,
  getStressTestResults,
  stopStressTest,
  estimateCapacity,
  generateK6Script,
}
