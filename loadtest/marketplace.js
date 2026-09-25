/**
 * k6 load test for the two marketplace discovery endpoints named in the
 * issue: browse (GET /api/v1/marketplace) and search (GET /api/v1/search).
 *
 * Encodes the issue's acceptance criteria as k6 thresholds, so a run
 * fails automatically if they're not met:
 *   - marketplace: 100 concurrent users, p95 < 500ms
 *   - search:      50 concurrent users, p95 < 1000ms
 *
 * Run against a live instance (not executed as part of this change — no
 * server/DB/Redis is running in this environment):
 *
 *   k6 run --env BASE_URL=http://localhost:3000 loadtest/marketplace.js
 *
 * `k6 run` prints p50/p95/p99 for http_req_duration per scenario at the
 * end of the run; watch RSS/heap on the API process alongside it to check
 * for a memory leak under sustained load (the "no memory leaks" criterion
 * isn't something k6 itself measures).
 */

import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const CATEGORIES = [
  'ART',
  'ILLUSTRATION',
  'PHOTOGRAPHY',
  'DIGITAL_PAINTING',
  'MUSIC',
];
const SEARCH_TERMS = ['sunset', 'portrait', 'abstract', 'landscape', 'character design'];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export const options = {
  scenarios: {
    marketplace_browse: {
      executor: 'constant-vus',
      vus: 100,
      duration: '2m',
      exec: 'browseMarketplace',
    },
    search: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
      exec: 'searchMarketplace',
      startTime: '2m',
    },
  },
  thresholds: {
    'http_req_duration{scenario:marketplace_browse}': ['p(95)<500'],
    'http_req_duration{scenario:search}': ['p(95)<1000'],
  },
};

export function browseMarketplace() {
  const params = new URLSearchParams({
    category: pick(CATEGORIES),
    sort: pick(['newest', 'price_asc', 'price_desc']),
    limit: '20',
  });
  const res = http.get(`${BASE_URL}/api/v1/marketplace?${params.toString()}`);
  check(res, { 'marketplace: status is 200': (r) => r.status === 200 });
}

export function searchMarketplace() {
  const params = new URLSearchParams({ q: pick(SEARCH_TERMS), limit: '20' });
  const res = http.get(`${BASE_URL}/api/v1/search?${params.toString()}`);
  check(res, { 'search: status is 200': (r) => r.status === 200 });
}
