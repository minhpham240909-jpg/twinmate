/**
 * Endurance Test - Sustained load over time
 *
 * Purpose: Detect memory leaks, connection pool exhaustion, stability issues
 * Duration: 30 minutes
 * Users: Sustained 200 concurrent users
 *
 * Run: k6 run scripts/load-test/endurance.js
 */

import {
  standardThresholds,
  simulateUserSession,
} from './common.js';

export const options = {
  stages: [
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '25m', target: 200 },  // Stay at 200 for 25 minutes
    { duration: '3m', target: 0 },     // Ramp down
  ],

  thresholds: {
    ...standardThresholds,
    // Endurance test should maintain performance over time
    'http_req_duration': ['p(95)<500', 'p(99)<1500'],
    'http_req_failed': ['rate<0.01'], // Less than 1% errors
    'checks': ['rate>0.95'],
  },
};

export default function () {
  simulateUserSession();
}
