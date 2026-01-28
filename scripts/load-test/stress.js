/**
 * Stress Test - Find breaking point
 *
 * Purpose: Determine system limits and breaking points
 * Duration: 10 minutes
 * Users: Ramp up to 500 concurrent users
 *
 * Run: k6 run scripts/load-test/stress.js
 */

import {
  standardThresholds,
  simulateUserSession,
} from './common.js';

export const options = {
  stages: [
    { duration: '1m', target: 100 },  // Warm up to 100 users
    { duration: '2m', target: 200 },  // Increase to 200 users
    { duration: '2m', target: 300 },  // Increase to 300 users
    { duration: '2m', target: 400 },  // Increase to 400 users
    { duration: '2m', target: 500 },  // Push to 500 users
    { duration: '1m', target: 0 },    // Ramp down
  ],

  thresholds: {
    // More lenient thresholds for stress test
    // We expect some degradation at high load
    'http_req_duration': ['p(95)<1000', 'p(99)<3000'],
    'http_req_failed': ['rate<0.05'], // Less than 5% errors
    'checks': ['rate>0.90'], // 90% of checks must pass
  },
};

export default function () {
  simulateUserSession();
}
