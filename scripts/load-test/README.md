# Load Testing Infrastructure

This directory contains load testing scripts for Clerva using k6.

## Prerequisites

1. Install k6:
   ```bash
   # macOS
   brew install k6

   # Linux
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. Set environment variables:
   ```bash
   export BASE_URL="https://your-staging-domain.com"
   export AUTH_TOKEN="your-test-user-token"
   ```

## Running Tests

### Quick Smoke Test (5 users, 1 minute)
```bash
k6 run scripts/load-test/smoke.js
```

### Load Test (100 users, 5 minutes)
```bash
k6 run scripts/load-test/load.js
```

### Stress Test (500 users, 10 minutes)
```bash
k6 run scripts/load-test/stress.js
```

### Spike Test (ramp to 1000 users)
```bash
k6 run scripts/load-test/spike.js
```

### Endurance Test (sustained 200 users, 30 minutes)
```bash
k6 run scripts/load-test/endurance.js
```

## Test Scenarios

| Test | VUs | Duration | Purpose |
|------|-----|----------|---------|
| Smoke | 5 | 1m | Basic sanity check |
| Load | 100 | 5m | Normal load validation |
| Stress | 500 | 10m | Find breaking point |
| Spike | 1000 | 5m | Handle sudden traffic |
| Endurance | 200 | 30m | Memory leaks, stability |

## Key Metrics

- **http_req_duration**: Response time (p95 < 500ms target)
- **http_req_failed**: Error rate (< 1% target)
- **http_reqs**: Throughput (requests/second)
- **vus**: Virtual users active

## Thresholds

All tests include these thresholds:
- 95% of requests complete in < 500ms
- Error rate < 1%
- No request takes > 2000ms

## Output

Results are saved to `results/` directory with timestamp.

To generate HTML report:
```bash
k6 run --out json=results/test.json scripts/load-test/load.js
# Then use k6 HTML report generator
```

## Target Capacity

Clerva is designed for:
- **Normal load**: 2,000-3,000 concurrent users
- **Peak load**: 5,000 concurrent users
- **API throughput**: 10,000 requests/minute

## API Endpoints Tested

1. **Health Check** (`/api/health`) - System health
2. **Dashboard** (`/api/user/stats`) - User statistics
3. **Roadmap** (`/api/roadmap/list`) - Learning roadmaps
4. **Flashcards** (`/api/flashcards/decks`) - Flashcard decks
5. **Guide Me** (`/api/guide-me`) - AI guidance (rate limited)

## Notes

- Always test against staging, never production
- Rate limiting may affect results - adjust thresholds accordingly
- Monitor server resources during tests (CPU, memory, DB connections)
