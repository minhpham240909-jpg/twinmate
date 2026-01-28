/**
 * Spike Test - Sudden traffic surge
 *
 * Purpose: Test system behavior during sudden traffic spikes
 * Duration: 5 minutes
 * Users: Sudden spike to 1000 users
 *
 * Run: k6 run scripts/load-test/spike.js
 */

import {
  standardThresholds,
  simulateUserSession,
} from './common.js';

export const options = {
  stages: [
    { duration: '10s', target: 50 },    // Warm up
    { duration: '30s', target: 50 },    // Normal load
    { duration: '10s', target: 1000 },  // SPIKE to 1000 users!
    { duration: '2m', target: 1000 },   // Stay at spike
    { duration: '10s', target: 50 },    // Scale down to normal
    { duration: '2m', target: 50 },     // Recovery period
    { duration: '10s', target: 0 },     // Ramp down
  ],

  thresholds: {
    // Spike test thresholds - we expect some failures during spike
    // Focus on recovery and graceful degradation
    'http_req_duration': ['p(95)<2000', 'p(99)<5000'],
    'http_req_failed': ['rate<0.10'], // Less than 10% errors (spike causes some)
    'checks': ['rate>0.80'], // 80% of checks must pass
  },
};

export default function () {
  simulateUserSession();
}
