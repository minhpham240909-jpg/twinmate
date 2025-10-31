-- Database Performance Profiling Queries
-- Run these in Supabase SQL Editor to identify slow queries and optimization opportunities

-- ==========================================
-- ENABLE pg_stat_statements (if not already enabled)
-- ==========================================

-- Check if extension is installed
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';

-- If not installed, enable it (requires superuser - contact Supabase support or use dashboard)
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Reset statistics (optional - only if you want fresh data)
-- SELECT pg_stat_statements_reset();

-- ==========================================
-- FIND SLOW QUERIES
-- ==========================================

-- Top 20 slowest queries by average execution time
SELECT 
  substring(query, 1, 100) as short_query,
  calls,
  round(total_exec_time::numeric, 2) as total_time_ms,
  round(mean_exec_time::numeric, 2) as avg_time_ms,
  round(max_exec_time::numeric, 2) as max_time_ms,
  round((100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric, 2) as cache_hit_ratio
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND calls > 10  -- Only queries called more than 10 times
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Queries with highest total execution time (most impactful to optimize)
SELECT 
  substring(query, 1, 100) as short_query,
  calls,
  round(total_exec_time::numeric, 2) as total_time_ms,
  round(mean_exec_time::numeric, 2) as avg_time_ms,
  round((total_exec_time / sum(total_exec_time) OVER ()) * 100, 2) as pct_of_total
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- ==========================================
-- CHECK INDEX USAGE
-- ==========================================

-- Indexes with low usage (candidates for removal)
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan < 100  -- Less than 100 scans
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC
LIMIT 20;

-- Tables with high sequential scan ratio (need indexes)
SELECT 
  schemaname,
  tablename,
  seq_scan as sequential_scans,
  seq_tup_read as rows_read_seq,
  idx_scan as index_scans,
  idx_tup_fetch as rows_read_idx,
  CASE 
    WHEN seq_scan + idx_scan > 0 
    THEN round((100.0 * idx_scan / (seq_scan + idx_scan))::numeric, 2)
    ELSE 0
  END as index_usage_percent,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC
LIMIT 20;

-- ==========================================
-- TABLE SIZE AND BLOAT
-- ==========================================

-- Table sizes (identify largest tables)
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size,
  pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC
LIMIT 20;

-- Row counts for all tables
SELECT 
  schemaname,
  tablename,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  round((n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0))::numeric, 2) as dead_row_percent,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- ==========================================
-- CACHE HIT RATIO
-- ==========================================

-- Overall cache hit ratio (should be > 99%)
SELECT 
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) as cache_hit_ratio,
  CASE 
    WHEN sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) > 0.99 
    THEN '✓ Excellent (> 99%)'
    WHEN sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) > 0.95
    THEN '⚠ Good (95-99%)'
    ELSE '✗ Poor (< 95%) - Consider increasing shared_buffers'
  END as status
FROM pg_statio_user_tables;

-- Per-table cache hit ratio
SELECT 
  schemaname,
  tablename,
  heap_blks_read,
  heap_blks_hit,
  CASE 
    WHEN heap_blks_hit + heap_blks_read > 0
    THEN round((heap_blks_hit * 100.0 / (heap_blks_hit + heap_blks_read))::numeric, 2)
    ELSE 100
  END as cache_hit_percent
FROM pg_statio_user_tables
WHERE schemaname = 'public'
  AND (heap_blks_read + heap_blks_hit) > 0
ORDER BY heap_blks_read DESC;

-- ==========================================
-- N+1 QUERY DETECTION
-- ==========================================

-- Detect potential N+1 queries (same query called many times)
SELECT 
  substring(query, 1, 150) as query_pattern,
  calls,
  round(mean_exec_time::numeric, 2) as avg_time_ms,
  round(total_exec_time::numeric, 2) as total_time_ms,
  CASE 
    WHEN calls > 100 AND mean_exec_time < 10 THEN '⚠ Potential N+1'
    WHEN calls > 1000 THEN '✗ Likely N+1!'
    ELSE 'OK'
  END as status
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND calls > 50
ORDER BY calls DESC
LIMIT 30;

-- ==========================================
-- SPECIFIC TABLE ANALYSIS
-- ==========================================

-- Analyze Message table (likely high-traffic)
ANALYZE "Message";

-- Get detailed query plan for Message queries
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT m.*, u.name as sender_name
FROM "Message" m
JOIN "User" u ON m."senderId" = u.id
WHERE m."recipientId" = 'sample-user-id'
  AND m."isDeleted" = false
ORDER BY m."createdAt" DESC
LIMIT 20;

-- Analyze Post table
ANALYZE "Post";

-- Get query plan for Post feed
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT p.*, u.name as author_name,
  (SELECT COUNT(*) FROM "PostLike" WHERE "postId" = p.id) as like_count,
  (SELECT COUNT(*) FROM "PostComment" WHERE "postId" = p.id) as comment_count
FROM "Post" p
JOIN "User" u ON p."userId" = u.id
WHERE p."isDeleted" = false
ORDER BY p."createdAt" DESC
LIMIT 50;

-- Analyze StudySession table
ANALYZE "StudySession";

-- Get query plan for active sessions
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT s.*, u.name as creator_name,
  (SELECT COUNT(*) FROM "SessionParticipant" WHERE "sessionId" = s.id) as participant_count
FROM "StudySession" s
JOIN "User" u ON s."creatorId" = u.id
WHERE s.status = 'ACTIVE'
ORDER BY s."createdAt" DESC;

-- ==========================================
-- CONNECTION POOL MONITORING
-- ==========================================

-- Current connections by state
SELECT 
  state,
  COUNT(*) as connection_count,
  MAX(EXTRACT(EPOCH FROM (now() - state_change))) as max_seconds_in_state
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state
ORDER BY connection_count DESC;

-- Long-running queries (> 5 seconds)
SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  state,
  substring(query, 1, 100) as query
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - pg_stat_activity.query_start > interval '5 seconds'
ORDER BY duration DESC;

-- ==========================================
-- RECOMMENDATIONS SUMMARY
-- ==========================================

-- Generate optimization recommendations
WITH table_stats AS (
  SELECT 
    schemaname || '.' || tablename as table_name,
    seq_scan,
    idx_scan,
    n_live_tup,
    CASE 
      WHEN idx_scan = 0 AND seq_scan > 100 THEN 'Add indexes'
      WHEN seq_scan > idx_scan * 2 AND n_live_tup > 1000 THEN 'Review indexes'
      ELSE 'OK'
    END as recommendation
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
)
SELECT * FROM table_stats
WHERE recommendation != 'OK'
ORDER BY seq_scan DESC;

-- ==========================================
-- MAINTENANCE COMMANDS
-- ==========================================

-- Run VACUUM ANALYZE on specific tables (do this during low traffic)
-- VACUUM ANALYZE "Message";
-- VACUUM ANALYZE "Post";
-- VACUUM ANALYZE "StudySession";

-- Reindex if needed (only if index bloat suspected)
-- REINDEX TABLE "Message";

-- ==========================================
-- MONITORING CHECKLIST
-- ==========================================

/*
Weekly Performance Review:
1. Check slow queries (avg_time_ms > 100ms)
2. Review cache hit ratio (should be > 99%)
3. Identify tables with high sequential scans
4. Check for N+1 query patterns
5. Monitor connection pool usage

Monthly Optimization:
1. ANALYZE all tables
2. VACUUM tables with high dead row percentage
3. Review and remove unused indexes
4. Update Prisma schema based on findings
5. Re-run these profiling queries and compare

Signs of Problems:
- Cache hit ratio < 95%
- Queries with avg_time > 500ms
- Sequential scans > index scans on large tables
- Dead row percentage > 10%
- Connection pool exhaustion
- Queries called > 1000 times (N+1 queries)
*/

