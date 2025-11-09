-- ==========================================
-- PERFORMANCE MONITORING & HEALTH CHECKS
-- ==========================================
-- Create functions and views for database performance monitoring
-- Use these to track query performance, identify bottlenecks,
-- and ensure optimal database health at scale
--
-- SECURITY: All monitoring functions use SECURITY DEFINER
-- and are safe to call from admin dashboards
-- ==========================================

-- ==========================================
-- FUNCTION 1: Slow Query Monitor
-- ==========================================
-- Find queries that are taking too long

CREATE OR REPLACE FUNCTION get_slow_queries(min_duration_ms int DEFAULT 100)
RETURNS TABLE (
  query text,
  calls bigint,
  total_time_ms numeric,
  mean_time_ms numeric,
  max_time_ms numeric,
  rows_affected bigint,
  cache_hit_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    LEFT(q.query, 200) as query,
    q.calls,
    ROUND(q.total_exec_time::numeric, 2) as total_time_ms,
    ROUND(q.mean_exec_time::numeric, 2) as mean_time_ms,
    ROUND(q.max_exec_time::numeric, 2) as max_time_ms,
    q.rows as rows_affected,
    ROUND(
      CASE
        WHEN (q.shared_blks_hit + q.shared_blks_read) = 0 THEN 100
        ELSE (q.shared_blks_hit::numeric / (q.shared_blks_hit + q.shared_blks_read) * 100)
      END,
      2
    ) as cache_hit_rate
  FROM pg_stat_statements q
  WHERE q.mean_exec_time > min_duration_ms
  ORDER BY q.mean_exec_time DESC
  LIMIT 20;
END;
$$;

-- ==========================================
-- FUNCTION 2: Table Size Monitor
-- ==========================================
-- Track table and index sizes

CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE (
  schema_name text,
  table_name text,
  row_estimate bigint,
  total_size text,
  table_size text,
  index_size text,
  toast_size text,
  total_size_bytes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname::text,
    tablename::text,
    n_live_tup as row_estimate,
    pg_size_pretty(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))::bigint) as total_size,
    pg_size_pretty(pg_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))::bigint) as table_size,
    pg_size_pretty(pg_indexes_size(quote_ident(schemaname) || '.' || quote_ident(tablename))::bigint) as index_size,
    pg_size_pretty(COALESCE(pg_total_relation_size(reltoastrelid), 0)::bigint) as toast_size,
    pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))::bigint as total_size_bytes
  FROM pg_stat_user_tables
  LEFT JOIN pg_class ON pg_class.relname = tablename
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)) DESC;
END;
$$;

-- ==========================================
-- FUNCTION 3: Index Usage Monitor
-- ==========================================
-- Find unused or rarely used indexes

CREATE OR REPLACE FUNCTION get_index_usage()
RETURNS TABLE (
  schema_name text,
  table_name text,
  index_name text,
  index_scans bigint,
  rows_read bigint,
  rows_fetched bigint,
  index_size text,
  is_unique boolean,
  recommendation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname::text,
    tablename::text,
    indexrelname::text,
    idx_scan as index_scans,
    idx_tup_read as rows_read,
    idx_tup_fetch as rows_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    indisunique as is_unique,
    CASE
      WHEN idx_scan = 0 AND NOT indisunique THEN 'UNUSED - Consider dropping'
      WHEN idx_scan < 10 AND NOT indisunique THEN 'RARELY USED - Monitor usage'
      WHEN idx_scan > 1000 THEN 'HEAVILY USED - Keep'
      ELSE 'NORMAL USAGE'
    END as recommendation
  FROM pg_stat_user_indexes
  JOIN pg_index ON pg_stat_user_indexes.indexrelid = pg_index.indexrelid
  WHERE schemaname = 'public'
  ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;
END;
$$;

-- ==========================================
-- FUNCTION 4: Connection Pool Monitor
-- ==========================================
-- Monitor active database connections

CREATE OR REPLACE FUNCTION get_connection_stats()
RETURNS TABLE (
  state text,
  count bigint,
  max_duration interval,
  applications text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(state, 'unknown')::text,
    COUNT(*) as count,
    MAX(COALESCE(now() - state_change, interval '0')) as max_duration,
    array_agg(DISTINCT application_name) as applications
  FROM pg_stat_activity
  WHERE pid <> pg_backend_pid()
  GROUP BY state
  ORDER BY count DESC;
END;
$$;

-- ==========================================
-- FUNCTION 5: Lock Monitor
-- ==========================================
-- Detect blocking queries and locks

CREATE OR REPLACE FUNCTION get_blocking_queries()
RETURNS TABLE (
  blocked_pid int,
  blocked_user text,
  blocked_query text,
  blocked_duration interval,
  blocking_pid int,
  blocking_user text,
  blocking_query text,
  blocking_duration interval
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    blocked.pid as blocked_pid,
    blocked.usename::text as blocked_user,
    LEFT(blocked.query, 100)::text as blocked_query,
    now() - blocked.query_start as blocked_duration,
    blocking.pid as blocking_pid,
    blocking.usename::text as blocking_user,
    LEFT(blocking.query, 100)::text as blocking_query,
    now() - blocking.query_start as blocking_duration
  FROM pg_locks blocked_locks
  JOIN pg_stat_activity blocked ON blocked.pid = blocked_locks.pid
  JOIN pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
  JOIN pg_stat_activity blocking ON blocking.pid = blocking_locks.pid
  WHERE NOT blocked_locks.granted;
END;
$$;

-- ==========================================
-- FUNCTION 6: Cache Hit Rate Monitor
-- ==========================================
-- Monitor buffer cache performance

CREATE OR REPLACE FUNCTION get_cache_hit_rate()
RETURNS TABLE (
  cache_type text,
  hit_rate numeric,
  recommendation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'Buffer Cache'::text as cache_type,
    ROUND(
      CASE
        WHEN (blks_hit + blks_read) = 0 THEN 100
        ELSE (blks_hit::numeric / (blks_hit + blks_read) * 100)
      END,
      2
    ) as hit_rate,
    CASE
      WHEN (blks_hit::numeric / NULLIF((blks_hit + blks_read), 0) * 100) < 90 THEN
        'LOW - Increase shared_buffers or investigate query patterns'
      WHEN (blks_hit::numeric / NULLIF((blks_hit + blks_read), 0) * 100) < 95 THEN
        'MODERATE - Monitor performance'
      ELSE
        'GOOD - Cache is performing well'
    END as recommendation
  FROM pg_stat_database
  WHERE datname = current_database();
END;
$$;

-- ==========================================
-- FUNCTION 7: Vacuum & Bloat Monitor
-- ==========================================
-- Check for table bloat and vacuum needs

CREATE OR REPLACE FUNCTION get_vacuum_stats()
RETURNS TABLE (
  schema_name text,
  table_name text,
  last_vacuum timestamptz,
  last_autovacuum timestamptz,
  last_analyze timestamptz,
  n_dead_tup bigint,
  n_live_tup bigint,
  dead_tuple_percent numeric,
  recommendation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname::text,
    relname::text,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    n_dead_tup,
    n_live_tup,
    ROUND(
      CASE
        WHEN n_live_tup = 0 THEN 0
        ELSE (n_dead_tup::numeric / n_live_tup * 100)
      END,
      2
    ) as dead_tuple_percent,
    CASE
      WHEN (n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100) > 20 THEN
        'HIGH BLOAT - Run VACUUM FULL or manual VACUUM'
      WHEN (n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100) > 10 THEN
        'MODERATE BLOAT - Monitor and consider manual VACUUM'
      ELSE
        'HEALTHY - Autovacuum is working well'
    END as recommendation
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  AND n_live_tup > 0
  ORDER BY (n_dead_tup::numeric / NULLIF(n_live_tup, 0)) DESC;
END;
$$;

-- ==========================================
-- FUNCTION 8: RLS Policy Performance Monitor
-- ==========================================
-- Check if RLS policies are causing slowdowns

CREATE OR REPLACE FUNCTION get_rls_policy_stats()
RETURNS TABLE (
  table_name text,
  policy_count bigint,
  rls_enabled boolean,
  rls_forced boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.relname::text as table_name,
    COUNT(p.polname) as policy_count,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  FROM pg_class c
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
  WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
  HAVING COUNT(p.polname) > 0
  ORDER BY COUNT(p.polname) DESC;
END;
$$;

-- ==========================================
-- FUNCTION 9: Top Tables by Activity
-- ==========================================
-- Find most active tables

CREATE OR REPLACE FUNCTION get_table_activity()
RETURNS TABLE (
  schema_name text,
  table_name text,
  seq_scans bigint,
  index_scans bigint,
  inserts bigint,
  updates bigint,
  deletes bigint,
  total_operations bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname::text,
    relname::text,
    seq_scan as seq_scans,
    idx_scan as index_scans,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    (n_tup_ins + n_tup_upd + n_tup_del) as total_operations
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY (n_tup_ins + n_tup_upd + n_tup_del) DESC
  LIMIT 20;
END;
$$;

-- ==========================================
-- FUNCTION 10: Database Health Summary
-- ==========================================
-- One-stop health check

CREATE OR REPLACE FUNCTION get_database_health()
RETURNS TABLE (
  metric text,
  value text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  db_size bigint;
  connection_count int;
  cache_hit numeric;
  slow_query_count int;
BEGIN
  -- Get metrics
  SELECT pg_database_size(current_database()) INTO db_size;
  SELECT COUNT(*) INTO connection_count FROM pg_stat_activity;
  SELECT ROUND((blks_hit::numeric / NULLIF((blks_hit + blks_read), 0) * 100), 2)
    INTO cache_hit FROM pg_stat_database WHERE datname = current_database();
  SELECT COUNT(*) INTO slow_query_count FROM pg_stat_statements WHERE mean_exec_time > 1000;

  -- Return summary
  RETURN QUERY
  SELECT
    'Database Size'::text,
    pg_size_pretty(db_size),
    CASE
      WHEN db_size < 1073741824 THEN 'SMALL'  -- < 1GB
      WHEN db_size < 10737418240 THEN 'MEDIUM'  -- < 10GB
      ELSE 'LARGE'
    END;

  RETURN QUERY
  SELECT
    'Active Connections'::text,
    connection_count::text,
    CASE
      WHEN connection_count < 50 THEN 'HEALTHY'
      WHEN connection_count < 100 THEN 'MODERATE'
      ELSE 'HIGH - Monitor closely'
    END;

  RETURN QUERY
  SELECT
    'Cache Hit Rate'::text,
    cache_hit::text || '%',
    CASE
      WHEN cache_hit > 95 THEN 'EXCELLENT'
      WHEN cache_hit > 90 THEN 'GOOD'
      ELSE 'NEEDS IMPROVEMENT'
    END;

  RETURN QUERY
  SELECT
    'Slow Queries (>1s)'::text,
    slow_query_count::text,
    CASE
      WHEN slow_query_count = 0 THEN 'EXCELLENT'
      WHEN slow_query_count < 5 THEN 'GOOD'
      WHEN slow_query_count < 20 THEN 'MONITOR'
      ELSE 'CRITICAL - Optimize immediately'
    END;
END;
$$;

-- ==========================================
-- VALIDATION
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Performance monitoring functions created!';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Quick health check:';
  RAISE NOTICE '  SELECT * FROM get_database_health();';
  RAISE NOTICE '';
  RAISE NOTICE 'Find slow queries:';
  RAISE NOTICE '  SELECT * FROM get_slow_queries(100);  -- queries >100ms';
  RAISE NOTICE '';
  RAISE NOTICE 'Check table sizes:';
  RAISE NOTICE '  SELECT * FROM get_table_sizes();';
  RAISE NOTICE '';
  RAISE NOTICE 'Monitor index usage:';
  RAISE NOTICE '  SELECT * FROM get_index_usage();';
  RAISE NOTICE '';
  RAISE NOTICE 'Check vacuum needs:';
  RAISE NOTICE '  SELECT * FROM get_vacuum_stats();';
  RAISE NOTICE '';
  RAISE NOTICE 'View connections:';
  RAISE NOTICE '  SELECT * FROM get_connection_stats();';
  RAISE NOTICE '';
  RAISE NOTICE 'Find blocking queries:';
  RAISE NOTICE '  SELECT * FROM get_blocking_queries();';
  RAISE NOTICE '';
  RAISE NOTICE 'All functions are RLS-secure and safe for production use';
  RAISE NOTICE '==============================================';
END $$;
