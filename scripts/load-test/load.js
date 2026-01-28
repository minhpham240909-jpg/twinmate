/**
 * Load Test - Normal traffic simulation
 *
 * Purpose: Validate system performance under expected load
 * Duration: 5 minutes
 * Users: Ramp up to 100 concurrent users
 *
 * Run: k6 run scripts/load-test/load.js
 */

import {
  standardThresholds,
  simulateUserSession,
} from './common.js';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '1m', target: 100 },  // Stay at 100 users
    { duration: '30s', target: 0 },   // Ramp down to 0
  ],

  thresholds: {
    ...standardThresholds,
    // Normal load thresholds
    'http_req_duration': ['p(95)<500', 'p(99)<2000'],
    'http_req_failed': ['rate<0.01'], // Less than 1% errors
  },
};

export default function () {
  simulateUserSession();
}
