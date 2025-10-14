# What's Wrong: Performance Diagnosis

## 🔴 THE MAIN PROBLEM (95.7% of Your Database Time)

### Query: `realtime.list_changes()`
- **Calls:** 657,521 times
- **Total Time:** 2,516 seconds (42 MINUTES!)
- **Percentage:** 95.7% of ALL database time
- **Average:** 3.8ms per call

### What This Means:
Your Supabase Realtime system is absolutely **CRUSHING** your database. Almost ALL of your database time is spent on this one function.

---

## Why Is This Happening?

### Likely Causes:

1. **Too Many Tables in Realtime Publication**
   - You probably have most/all tables publishing to realtime
   - Every table change triggers realtime processing
   - This creates massive overhead

2. **Too Many Active Subscriptions**
   - Multiple users with open realtime channels
   - Each subscription polls for changes constantly
   - No filters = checking ALL rows for every subscription

3. **Unfiltered Subscriptions**
   - Subscriptions without `filter: 'id=eq.${id}'` clauses
   - Database checks every row to see if it matches
   - Extremely inefficient at scale

4. **Memory Leaks in Client Code**
   - Subscriptions not being cleaned up on unmount
   - Duplicate channels being created
   - Exponential growth of subscriptions

---

## Visual Breakdown of Your Database Time

```
95.7% ████████████████████████████████████████  realtime.list_changes()
0.9%  ██                                        SELECT timezone_names
0.2%  █                                         Other dashboard queries
3.2%  ███                                       Everything else
```

**THIS IS NOT NORMAL.** A healthy database should have realtime taking <10% of time.

---

## What Happens When 95.7% is Realtime?

### Current State (BAD):
- 🐌 Slow response times for users
- 💰 High database costs (if usage-based billing)
- 🔥 High CPU usage on database
- 📈 Poor scalability (can't handle more users)
- ⚠️ Risk of hitting connection limits

### Expected State (GOOD):
- ⚡ Fast response times
- 💵 Lower database costs
- 🆒 Normal CPU usage
- 📊 Can handle 10x more users
- ✅ Stable performance

---

## Quick Test: Find the Problem in Your Code

### Step 1: Search for Realtime Subscriptions

Search your codebase for these patterns:

```bash
# In your clerva-app directory
grep -r "\.on('postgres_changes'" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"
```

### Step 2: Look for These RED FLAGS:

❌ **BAD - No Filter:**
```typescript
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'Message'  // ← Listening to ALL messages!
}, callback)
```

❌ **BAD - No Cleanup:**
```typescript
useEffect(() => {
  const channel = supabase.channel('messages')
    .on('postgres_changes', { ... })
    .subscribe()
  // ← No cleanup! Memory leak!
})
```

❌ **BAD - Multiple Subscriptions:**
```typescript
// Component re-renders and creates new subscription each time
const channel = supabase.channel('messages')
  .on('postgres_changes', { ... })
  .subscribe()
```

✅ **GOOD - With Filter:**
```typescript
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'Message',
  filter: `groupId=eq.${currentGroupId}`  // ← Only this group!
}, callback)
```

✅ **GOOD - With Cleanup:**
```typescript
useEffect(() => {
  const channel = supabase.channel('messages')
    .on('postgres_changes', { ... })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)  // ← Cleanup!
  }
}, [dependency])
```

---

## Immediate Actions (Do This NOW)

### Action 1: Check Realtime Publication (2 minutes)

Run this in Supabase SQL Editor:

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
```

**What to look for:**
- How many tables are listed?
- Are tables like `User`, `Profile`, `Badge` included? (They shouldn't be!)

**Expected Result:**
Should only have 4-6 tables:
- `Message`
- `SessionMessage`
- `SessionTimer`
- `SessionParticipant`
- `Notification`
- Maybe `StudySession`

If you have MORE than this, that's your problem!

### Action 2: Remove Unnecessary Tables (5 minutes)

For each table that doesn't need INSTANT updates:

```sql
-- Example: User profile changes don't need instant updates
ALTER PUBLICATION supabase_realtime DROP TABLE "User";
ALTER PUBLICATION supabase_realtime DROP TABLE "Profile";
ALTER PUBLICATION supabase_realtime DROP TABLE "Badge";
ALTER PUBLICATION supabase_realtime DROP TABLE "UserBadge";
ALTER PUBLICATION supabase_realtime DROP TABLE "Match";
ALTER PUBLICATION supabase_realtime DROP TABLE "Group";
ALTER PUBLICATION supabase_realtime DROP TABLE "GroupMember";
-- etc.
```

### Action 3: Check Active Connections (1 minute)

```sql
SELECT COUNT(*) as active_realtime_connections
FROM pg_stat_activity
WHERE usename = 'supabase_admin'
AND state = 'active';
```

**What to expect:**
- <10 connections: Normal
- 10-50 connections: High but manageable
- >50 connections: Problem! Memory leak likely

---

## Expected Impact After Fixes

### Before (Current):
- `realtime.list_changes()`: 2,516 seconds (95.7%)
- Database barely usable for other queries
- High costs, slow performance

### After (Fixed):
- `realtime.list_changes()`: ~250 seconds (10-15%)
- **90% reduction in realtime overhead**
- Fast response times
- Can handle 10x more users
- Lower costs

---

## Timeline to Fix

| Priority | Action | Time | Impact |
|----------|--------|------|--------|
| 🔴 CRITICAL | Audit realtime publication | 2 min | Identify problem |
| 🔴 CRITICAL | Remove unnecessary tables | 5 min | 70-80% improvement |
| 🟡 HIGH | Add filters to subscriptions | 30 min | 10-15% improvement |
| 🟡 HIGH | Fix subscription cleanup | 20 min | Prevent future issues |
| 🟢 MEDIUM | Run index optimizations | 2 min | 5-10% improvement |

**Total Time to Fix:** ~1 hour
**Expected Improvement:** 80-90% reduction in database load

---

## Bottom Line

**Your database is spending 42 minutes out of every 44 minutes just on realtime polling.**

This is like having a car where 95% of the engine power is used to run the air conditioning, leaving only 5% to actually drive the car.

**Fix this TODAY** - it's your #1 performance issue by a massive margin. Everything else is noise compared to this.

Start with `optimize_realtime_performance.md` and follow the steps. This will have the biggest impact on your app's performance.
