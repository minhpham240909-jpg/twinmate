/**
 * Smoke Test - Basic sanity check
 *
 * Purpose: Verify the system works under minimal load
 * Duration: 1 minute
 * Users: 5 concurrent
 *
 * Run: k6 run scripts/load-test/smoke.js
 */

import { sleep } from 'k6';
import {
  standardThresholds,
  healthCheck,
  getUserStats,
  getRoadmapList,
  getFlashcardDecks,
  randomSleep,
} from './common.js';

export const options = {
  vus: 5, // 5 virtual users
  duration: '1m', // 1 minute

  thresholds: {
    ...standardThresholds,
    // Stricter thresholds for smoke test
    'http_req_duration': ['p(95)<300', 'p(99)<1000'],
    'http_req_failed': ['rate<0.001'], // Less than 0.1% errors
  },
};

export default function () {
  // Health check
  healthCheck();
  randomSleep(0.5, 1);

  // User stats
  getUserStats();
  randomSleep(0.5, 1);

  // Roadmap list
  getRoadmapList();
  randomSleep(0.5, 1);

  // Flashcards
  getFlashcardDecks();
  randomSleep(0.5, 1);
}
