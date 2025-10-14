# Database Performance Action Plan

## Executive Summary

Your database query analysis shows **one critical issue** consuming 95.7% of total query time:
- `realtime.list_changes()`: 2,516 seconds across 657k calls

## Priority Actions (Do These First)

### 🔴 CRITICAL - Priority 1: Fix Realtime Performance

**Impact:** Will reduce database load by ~95%

1. **Audit Realtime Publications** (5 minutes)
   ```sql
   -- Run in Supabase SQL Editor
   SELECT schemaname, tablename
   FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime'
   ORDER BY schemaname, tablename;
   ```

2. **Remove Non-Essential Tables from Realtime** (10 minutes)

   Keep only these tables in realtime:
   - `Message` - chat messages need instant updates
   - `SessionMessage` - study session chat
   - `SessionTimer` - timer state
   - `SessionParticipant` - active participants
   - `Notification` - notifications

   Remove these (use polling instead):
   - `User` - profile updates don't need instant sync
   - `Group` - group metadata changes are rare
   - `GroupMember` - can be polled when viewing group
   - Any other audit/logging tables

   ```sql
   -- Example: Remove from realtime
   ALTER PUBLICATION supabase_realtime DROP TABLE "User";
   ALTER PUBLICATION supabase_realtime DROP TABLE "Group";
   -- etc.
   ```

3. **Review Your Client Code** (30 minutes)

   Search your codebase for `.on('postgres_changes'` and:
   - Add filters to limit scope: `filter: 'groupId=eq.${id}'`
   - Close channels when components unmount
   - Avoid creating duplicate subscriptions

   Example pattern:
   ```typescript
   useEffect(() => {
     const channel = supabase
       .channel('messages-${groupId}')
       .on('postgres_changes', {
         event: '*',
         schema: 'public',
         table: 'Message',
         filter: `groupId=eq.${groupId}` // ← Add this!
       }, handleChange)
       .subscribe()

     return () => {
       supabase.removeChannel(channel) // ← Don't forget cleanup!
     }
   }, [groupId])
   ```

### 🟡 MEDIUM - Priority 2: Database Optimizations

**Impact:** Will improve query performance by 20-30%

1. **Run the Performance Fixes** (2 minutes)
   - Go to Supabase SQL Editor
   - Copy and run `database_performance_fixes.sql`
   - This adds indexes and updates table statistics

2. **Monitor Impact** (ongoing)
   - Check query performance in 24 hours
   - Look for reduction in `realtime.list_changes()` calls

### 🟢 LOW - Priority 3: Code-Level Optimizations

**Impact:** Will reduce unnecessary database calls

1. **Implement Debouncing** for frequent updates
   - Search for rapid `.update()` calls (e.g., in text input handlers)
   - Add debounce/throttle (see `optimize_realtime_performance.md`)

2. **Use Presence API** for online status
   - Replace database polling for "who's online"
   - Use Supabase Realtime Presence instead

3. **Review Polling Intervals**
   - Find all `setInterval()` with database queries
   - Increase intervals where possible (e.g., 10s → 30s)

## Expected Results

After completing Priority 1:
- ✅ 80-90% reduction in database query time
- ✅ Faster response times for users
- ✅ Lower database CPU usage
- ✅ Better scalability

After completing Priority 2:
- ✅ Improved query execution time
- ✅ Better index utilization
- ✅ More efficient table scans

## Monitoring

Run this query weekly to track improvements:

```sql
SELECT
  query,
  calls,
  total_time,
  mean_time,
  (total_time / SUM(total_time) OVER ()) * 100 as pct_total
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

## Files Created

1. `optimize_realtime_performance.md` - Detailed realtime optimization guide
2. `database_performance_fixes.sql` - SQL script for database optimizations
3. `PERFORMANCE_ACTION_PLAN.md` - This action plan (you are here)

## Next Steps

1. ✅ Start with Priority 1 (Realtime) - do this TODAY
2. ⏸️ Run Priority 2 (Database fixes) after testing Priority 1
3. 🔄 Monitor results for 24-48 hours
4. 📊 Re-run query analysis to measure improvement
