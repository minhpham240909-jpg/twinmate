/**
 * Common utilities for load testing
 */

import { check, sleep } from 'k6';
import http from 'k6/http';

// Configuration
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Standard headers
export function getHeaders(withAuth = true) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'k6-load-test/1.0',
  };

  if (withAuth && AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  return headers;
}

// Standard thresholds for all tests
export const standardThresholds = {
  // 95% of requests must complete within 500ms
  'http_req_duration': ['p(95)<500', 'p(99)<2000'],
  // Error rate must be below 1%
  'http_req_failed': ['rate<0.01'],
  // At least 95% of checks must pass
  'checks': ['rate>0.95'],
};

// Health check
export function healthCheck() {
  const response = http.get(`${BASE_URL}/api/health`, {
    headers: getHeaders(false),
    tags: { name: 'health_check' },
  });

  check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check is healthy': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'healthy' || body.status === 'degraded';
      } catch {
        return false;
      }
    },
    'health check response time < 200ms': (r) => r.timings.duration < 200,
  });

  return response;
}

// User stats endpoint (authenticated)
export function getUserStats() {
  const response = http.get(`${BASE_URL}/api/user/stats`, {
    headers: getHeaders(true),
    tags: { name: 'user_stats' },
  });

  check(response, {
    'user stats status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'user stats response time < 500ms': (r) => r.timings.duration < 500,
  });

  return response;
}

// Roadmap list endpoint
export function getRoadmapList() {
  const response = http.get(`${BASE_URL}/api/roadmap/list?limit=10`, {
    headers: getHeaders(true),
    tags: { name: 'roadmap_list' },
  });

  check(response, {
    'roadmap list status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'roadmap list response time < 500ms': (r) => r.timings.duration < 500,
  });

  return response;
}

// Flashcard decks endpoint
export function getFlashcardDecks() {
  const response = http.get(`${BASE_URL}/api/flashcards/decks?limit=10`, {
    headers: getHeaders(true),
    tags: { name: 'flashcard_decks' },
  });

  check(response, {
    'flashcard decks status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'flashcard decks response time < 500ms': (r) => r.timings.duration < 500,
  });

  return response;
}

// Guide Me endpoint (AI-powered, rate limited)
export function getGuidance(question = 'How do I learn JavaScript?') {
  const payload = JSON.stringify({
    question,
    actionType: 'roadmap',
  });

  const response = http.post(`${BASE_URL}/api/guide-me`, payload, {
    headers: getHeaders(true),
    tags: { name: 'guide_me' },
    timeout: '30s', // AI requests can take longer
  });

  check(response, {
    'guide me status is 200, 401, or 429': (r) =>
      r.status === 200 || r.status === 401 || r.status === 429,
    'guide me response time < 30s': (r) => r.timings.duration < 30000,
  });

  return response;
}

// Random sleep between requests (simulates real user behavior)
export function randomSleep(min = 1, max = 3) {
  sleep(min + Math.random() * (max - min));
}

// Simulate a typical user session
export function simulateUserSession() {
  // 1. Check health first
  healthCheck();
  randomSleep(0.5, 1);

  // 2. Load user stats (dashboard)
  getUserStats();
  randomSleep(1, 2);

  // 3. Browse roadmaps
  getRoadmapList();
  randomSleep(2, 4);

  // 4. Check flashcards
  getFlashcardDecks();
  randomSleep(1, 3);

  // 5. Maybe ask for guidance (10% chance - expensive operation)
  if (Math.random() < 0.1) {
    getGuidance();
    randomSleep(2, 5);
  }
}

// Export summary handler for nice output
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    [`results/summary_${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Simple text summary (k6 doesn't export textSummary by default)
function textSummary(data, options = {}) {
  const { indent = '', enableColors = false } = options;

  let output = '\n=== Load Test Summary ===\n\n';

  // Metrics
  if (data.metrics) {
    output += 'Metrics:\n';
    for (const [name, metric] of Object.entries(data.metrics)) {
      if (metric.values) {
        const values = metric.values;
        if (values.avg !== undefined) {
          output += `${indent}${name}: avg=${values.avg.toFixed(2)}ms, p95=${values['p(95)']?.toFixed(2) || 'N/A'}ms\n`;
        } else if (values.rate !== undefined) {
          output += `${indent}${name}: ${(values.rate * 100).toFixed(2)}%\n`;
        } else if (values.count !== undefined) {
          output += `${indent}${name}: ${values.count}\n`;
        }
      }
    }
  }

  // Thresholds
  if (data.thresholds) {
    output += '\nThresholds:\n';
    for (const [name, result] of Object.entries(data.thresholds)) {
      const status = result.ok ? '✓ PASS' : '✗ FAIL';
      output += `${indent}${name}: ${status}\n`;
    }
  }

  return output;
}
