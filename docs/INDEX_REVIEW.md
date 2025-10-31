# Prisma Schema Index Review

## Review Date
2025-01-31

## Summary

**Overall Status**: ✅ Good - Indexes are well-designed for current query patterns

The Clerva schema has comprehensive indexes that should support the main query patterns efficiently. The Message table particularly stands out with excellent composite indexes.

## Detailed Analysis

### Message Table ✅ EXCELLENT

**Current Indexes:**
```prisma
@@index([senderId])
@@index([groupId])
@@index([recipientId])
@@index([createdAt])
@@index([deliveredAt])
@@index([deletedAt])
@@index([senderId, recipientId, createdAt]) // DM loading
@@index([groupId, createdAt]) // Group messages
@@index([recipientId, isRead]) // Unread counts
@@index([groupId, isRead]) // Group unread counts
@@index([senderId, recipientId, groupId]) // Message filtering
```

**Analysis:**
- ✅ Excellent composite indexes for DM and group message loading
- ✅ Unread count queries are well-optimized
- ✅ Message filtering with multiple criteria supported
- ✅ Soft delete queries (deletedAt) are indexed

**Query Patterns Supported:**
1. Load conversation between two users, ordered by date ✅
2. Count unread messages for a user ✅
3. Load group messages, ordered by date ✅
4. Filter messages by sender/recipient/group ✅
5. Query non-deleted messages ✅

**Recommendations:**
- No changes needed
- Monitor query performance with profiling queries
- If message archiving becomes common, consider: `@@index([recipientId, deletedAt, createdAt])`

### Profile Table ✅ GOOD

**Current Indexes:**
```prisma
@@index([userId])
@@index([subjects])
@@index([interests])
@@index([onlineStatus])
```

**Analysis:**
- ✅ Basic indexes cover common queries
- ✅ Array field indexes (subjects, interests) enable GIN index for partner matching

**Query Patterns Supported:**
1. Find profiles by subjects (partner matching) ✅
2. Find profiles by interests ✅
3. Filter by online status ✅
4. Lookup profile by userId ✅

**Recommendations:**
- ✅ Current indexes are sufficient
- 🔄 Consider adding if partner search is slow:
  ```prisma
  @@index([isLookingForPartner, onlineStatus]) // Active partner searchers
  @@index([skillLevel]) // If filtering by skill level is common
  ```
- Monitor array field query performance

### StudySession Table ✅ GOOD

**Current Indexes:**
```prisma
@@index([createdBy])
@@index([userId])
@@index([status])
@@index([type])
@@index([startedAt])
@@index([agoraChannel])
```

**Analysis:**
- ✅ Core fields are indexed
- ✅ Status filtering is optimized
- ✅ Agora channel lookup is indexed (unique constraint provides index)

**Query Patterns Supported:**
1. Find sessions by creator ✅
2. Filter sessions by status (ACTIVE, WAITING, etc.) ✅
3. Find sessions by type ✅
4. Order sessions by start time ✅
5. Lookup by Agora channel ✅

**Recommendations:**
- 🔄 Consider adding composite index for common dashboard queries:
  ```prisma
  @@index([status, createdAt]) // Recent active sessions
  @@index([createdBy, status]) // User's sessions by status
  ```
- ✅ Current indexes cover most use cases

### SessionParticipant Table ✅ GOOD

**Current Indexes:**
```prisma
@@unique([sessionId, userId]) // Composite unique provides index
@@index([userId])
@@index([sessionId])
@@index([status])
```

**Analysis:**
- ✅ Participant lookups are optimized
- ✅ Session participant queries are efficient
- ✅ Status filtering supported

**Query Patterns Supported:**
1. Find all participants in a session ✅
2. Find all sessions a user is participating in ✅
3. Check if user is in a session (unique constraint) ✅
4. Filter participants by status ✅

**Recommendations:**
- ✅ No changes needed
- Indexes are well-suited for common queries

### Post Table (Community Feature)

**Expected Indexes** (verify in schema):
```prisma
@@index([userId])
@@index([createdAt])
@@index([isDeleted])
@@index([userId, isDeleted, createdAt]) // User's active posts
```

**Recommendations:**
- Ensure composite index exists for feed queries
- If hashtag search is common, consider indexing tags/hashtags
- For popular/trending posts, consider materialized view

### User Table ✅ ADEQUATE

**Current Indexes:**
```prisma
@@index([email])
@@index([googleId])
@@index([role])
```

**Analysis:**
- ✅ Authentication lookups are fast (email, googleId)
- ✅ Role-based queries supported

**Recommendations:**
- ✅ Current indexes are sufficient
- Email is also unique, which provides an index
- No additional indexes needed for current use case

### Group Tables ✅ GOOD

**GroupMember:**
```prisma
@@unique([groupId, userId])
@@index([userId])
@@index([groupId])
```

**GroupInvite:**
```prisma
@@unique([groupId, inviteeId])
@@index([inviteeId, status])
@@index([groupId])
```

**Analysis:**
- ✅ Group membership queries are optimized
- ✅ Invite lookups are efficient
- ✅ Composite indexes support common filters

**Recommendations:**
- ✅ No changes needed

## Missing Indexes (Potential)

### 1. SessionTimer Table

**If this table exists, ensure:**
```prisma
@@index([sessionId])
@@index([status]) // If querying active timers
```

### 2. Notification Table

**Verify indexes exist:**
```prisma
@@index([userId, isRead]) // Unread notifications
@@index([userId, createdAt]) // Recent notifications
@@index([type]) // If filtering by notification type
```

### 3. Post Interaction Tables

**PostLike:**
```prisma
@@index([postId]) // Count likes for a post
@@index([userId]) // User's liked posts
@@unique([postId, userId]) // Prevent duplicate likes
```

**PostComment:**
```prisma
@@index([postId, createdAt]) // Comments on a post, ordered
@@index([userId]) // User's comments
@@index([isDeleted]) // If soft deleting comments
```

**PostRepost:**
```prisma
@@unique([postId, userId]) // Prevent duplicate reposts
@@index([postId]) // Count reposts
@@index([userId, createdAt]) // User's reposts timeline
```

## Optimization Recommendations

### High Priority

None - current indexes are well-designed.

### Medium Priority

1. **Add composite index for active sessions dashboard:**
   ```prisma
   // In StudySession model
   @@index([status, createdAt])
   ```

2. **Add composite index for user's sessions:**
   ```prisma
   // In StudySession model
   @@index([createdBy, status])
   ```

3. **Verify Post feed indexes exist:**
   ```prisma
   // In Post model
   @@index([isDeleted, createdAt])
   @@index([userId, isDeleted, createdAt])
   ```

### Low Priority

1. **If partner search becomes slow, add:**
   ```prisma
   // In Profile model
   @@index([isLookingForPartner, onlineStatus])
   ```

2. **For notification performance:**
   ```prisma
   // In Notification model (if not already present)
   @@index([userId, isRead, createdAt])
   ```

## Index Monitoring

### How to Check Index Usage

Run this in Supabase SQL Editor:

```sql
-- Check which indexes are being used
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Find unused indexes (candidates for removal)
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan < 100
ORDER BY pg_relation_size(indexrelid) DESC;
```

### When to Add New Indexes

Add indexes when:
1. Query takes > 100ms consistently
2. EXPLAIN ANALYZE shows sequential scan on large table
3. Index usage monitoring shows missing index
4. New feature introduces new query patterns

### When to Remove Indexes

Consider removing when:
1. Index used < 100 times over 1 month
2. Index size is large (> 10MB) and rarely used
3. Query patterns have changed
4. Duplicate/redundant index exists

## Testing Indexes

### Before Adding an Index

```sql
-- Get current query time
EXPLAIN ANALYZE
SELECT * FROM "Message"
WHERE "recipientId" = 'user-id'
  AND "isRead" = false
ORDER BY "createdAt" DESC;

-- Note the execution time and plan
```

### After Adding an Index

```sql
-- Verify index is being used
EXPLAIN ANALYZE
SELECT * FROM "Message"
WHERE "recipientId" = 'user-id'
  AND "isRead" = false
ORDER BY "createdAt" DESC;

-- Should show "Index Scan" instead of "Seq Scan"
-- Execution time should be significantly lower
```

## Migration Strategy

### If You Need to Add Recommended Indexes

1. **Add to Prisma schema:**
   ```prisma
   model StudySession {
     // ... existing fields ...
     
     @@index([status, createdAt])  // NEW
     @@index([createdBy, status])  // NEW
   }
   ```

2. **Create migration:**
   ```bash
   npx prisma migrate dev --name add_study_session_composite_indexes
   ```

3. **Verify in production:**
   ```sql
   \d "StudySession"  -- Shows all indexes
   ```

4. **Monitor performance:**
   - Run profiling queries after 1 week
   - Check if new indexes are being used
   - Measure query performance improvement

## Index Maintenance

### Regular Maintenance Tasks

**Weekly:**
- Review slow query logs
- Check for queries doing sequential scans

**Monthly:**
- Run ANALYZE on all tables
- Review index usage statistics
- Clean up unused indexes

**Quarterly:**
- Full index audit
- Compare query patterns vs indexes
- Update this document with findings

### Maintenance Commands

```sql
-- Update table statistics (improves query planner decisions)
ANALYZE "Message";
ANALYZE "StudySession";
ANALYZE "Post";

-- Reindex if index bloat suspected (rarely needed)
REINDEX TABLE "Message";

-- Check index bloat
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Conclusion

**Current State**: ✅ Excellent

The Clerva database schema has well-thought-out indexes that should handle the expected query patterns efficiently. The Message table particularly shows excellent index design with appropriate composite indexes.

**Action Items:**
1. ✅ No critical changes needed
2. 🔄 Consider adding recommended composite indexes for StudySession
3. 📊 Set up regular index monitoring (monthly)
4. 📈 Run profiling queries after launch to validate assumptions

**Next Review**: 3 months after launch or when performance issues arise

