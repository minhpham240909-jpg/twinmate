# Clerva App - Audit Issues Report

This document contains all HIGH priority and PERFORMANCE issues identified during the comprehensive app audit.

---

## HIGH Priority Issues

### 1. Authentication & User Management

#### H1: Session Token Refresh Edge Case
**Location:** `src/lib/supabase/middleware.ts`
**Issue:** Token refresh may fail silently if Supabase service is temporarily unavailable during refresh window.
**Impact:** Users may be unexpectedly logged out during peak usage.
**Recommendation:** Add retry logic with exponential backoff for token refresh failures. Consider implementing a token refresh queue.

#### H2: Profile Update Race Condition
**Location:** `src/app/api/profile/route.ts`
**Issue:** Concurrent profile updates from multiple devices could cause data inconsistency.
**Impact:** User data may be overwritten unexpectedly.
**Recommendation:** Implement optimistic locking using `updatedAt` timestamp comparison or use database-level row locking.

---

### 2. Study Sessions

#### H3: Session State Synchronization
**Location:** `src/components/study-sessions/VideoCall.tsx`
**Issue:** When network interruption occurs, participant state may become desynchronized between Agora and database.
**Impact:** Ghost participants or incorrect participant counts.
**Recommendation:** Implement periodic state reconciliation between Agora channel state and database. Add heartbeat mechanism for active participants.

#### H4: Session Cleanup on Browser Close
**Location:** `src/hooks/useStudySession.ts`
**Issue:** If user closes browser during active session, their participant record may remain in "JOINED" status.
**Impact:** Stale participant data affecting session counts and matching.
**Recommendation:** Implement `beforeunload` event handler to attempt cleanup. Add server-side cron job to clean stale participants (e.g., no activity for 5+ minutes).

---

### 3. Chat & Messaging

#### H5: Message Ordering in High-Latency Scenarios
**Location:** `src/components/messages/ChatWindow.tsx`
**Issue:** Optimistic message insertion may cause visual reordering when server response arrives with different timestamp.
**Impact:** Messages may appear to "jump" in the conversation.
**Recommendation:** Use client-generated temporary IDs and implement proper reconciliation when server confirms message creation.

#### H6: Unread Count Accuracy
**Location:** `src/lib/supabase/realtime.ts` - `subscribeToUnreadMessages`
**Issue:** Realtime subscription may miss messages during brief disconnections, leading to inaccurate unread counts.
**Impact:** Users may miss important messages or see incorrect badge counts.
**Recommendation:** Implement periodic polling fallback (every 30s) to reconcile unread counts. Add reconnection logic with count refresh.

---

### 4. AI Partner

#### H7: Context Window Management
**Location:** `src/lib/ai-partner/openai.ts`
**Issue:** Long conversations may exceed token limits causing API errors or truncated context.
**Impact:** AI responses may lose important conversation context.
**Recommendation:** Implement sliding window context management with intelligent summarization of older messages. Add token counting before API calls.

#### H8: Rate Limiting Bypass Risk
**Location:** `src/app/api/ai-partner/chat/route.ts`
**Issue:** Rate limiting is per-user but doesn't account for rapid requests during page refresh cycles.
**Impact:** Users could exhaust their quota unintentionally through rapid navigation.
**Recommendation:** Add debouncing on client-side and implement a short grace period for duplicate requests (within 500ms).

---

### 5. Groups

#### H9: Member Permission Caching
**Location:** `src/app/api/groups/[groupId]/*`
**Issue:** Permission checks query database on every request without caching.
**Impact:** Increased database load and latency for group operations.
**Recommendation:** Cache member permissions in Redis or use stale-while-revalidate pattern with 30-second TTL.

#### H10: Concurrent Join Requests
**Location:** `src/app/api/groups/[groupId]/join/route.ts`
**Issue:** Race condition when multiple users join simultaneously near member limit.
**Impact:** Group may exceed intended member limit.
**Recommendation:** Use database transaction with SELECT FOR UPDATE to prevent race condition. Add unique constraint check.

---

### 6. Community/Posts

#### H11: Feed Pagination Consistency
**Location:** `src/app/api/posts/route.ts`
**Issue:** Cursor-based pagination may return duplicate or missing posts if new posts are created during pagination.
**Impact:** Poor user experience with duplicate content or missed posts.
**Recommendation:** Use stable cursor (combination of createdAt + id) and implement deduplication on client-side.

#### H12: Media Upload Error Recovery
**Location:** `src/components/community/PostComposer.tsx`
**Issue:** Failed media uploads don't have retry mechanism, requiring full post re-creation.
**Impact:** Lost user content and frustration.
**Recommendation:** Implement upload retry with exponential backoff. Store draft content locally until successful submission.

---

### 7. Notifications

#### H13: Notification Delivery Guarantee
**Location:** `src/lib/notifications/send.ts`
**Issue:** Failed notification creation doesn't have retry mechanism.
**Impact:** Users may miss important notifications.
**Recommendation:** Implement notification queue with retry logic. Consider using database triggers as backup notification mechanism.

#### H14: Push Notification Token Staleness
**Location:** `src/hooks/useNotificationPermission.ts`
**Issue:** Push notification tokens may become stale without automatic refresh.
**Impact:** Push notifications stop working for affected users.
**Recommendation:** Implement token refresh on app launch and periodic validation. Add token expiry tracking.

---

### 8. Search

#### H15: Search Query Injection
**Location:** `src/app/api/search/route.ts`
**Issue:** User search queries should be sanitized more thoroughly for special characters.
**Impact:** Potential for unexpected search behavior or errors.
**Recommendation:** Implement comprehensive query sanitization. Escape all special characters for database search.

---

### 9. Profile & Settings

#### H16: Avatar Upload Size Validation
**Location:** `src/app/api/profile/avatar/route.ts`
**Issue:** Large avatar files may cause memory issues during processing.
**Impact:** Server performance degradation.
**Recommendation:** Implement streaming upload with size limit enforcement before processing. Add image compression pipeline.

---

## PERFORMANCE Issues

### P1: Database Query Optimization

#### P1.1: N+1 Query in Posts Feed
**Location:** `src/app/api/posts/route.ts`
**Issue:** Post feed fetches user data and engagement counts in separate queries.
**Impact:** High database load, slow feed loading.
**Recommendation:** Use Prisma's `include` with selective field selection. Consider denormalizing engagement counts.

```typescript
// Current (N+1)
const posts = await prisma.post.findMany({...})
// Then separate queries for each post's likes, comments, reposts

// Recommended
const posts = await prisma.post.findMany({
  include: {
    user: { select: { id: true, name: true, avatarUrl: true } },
    _count: { select: { likes: true, comments: true, reposts: true } }
  }
})
```

#### P1.2: Unbounded Group Member Queries
**Location:** `src/app/api/groups/[groupId]/members/route.ts`
**Issue:** Fetching all group members without pagination for large groups.
**Impact:** Slow response times, high memory usage.
**Recommendation:** Implement pagination with cursor-based approach. Default limit of 50 members per request.

#### P1.3: Study Session Search Without Index
**Location:** `src/app/api/study-sessions/route.ts`
**Issue:** Session filtering queries may not utilize optimal indexes.
**Impact:** Slow session discovery during peak hours.
**Recommendation:** Add composite index on (status, startTime, isPublic). Review query explain plans.

---

### P2: Caching Strategy

#### P2.1: Missing API Response Caching
**Location:** Various API routes
**Issue:** Frequently accessed, rarely changing data not cached (e.g., user profiles, group info).
**Impact:** Unnecessary database queries.
**Recommendation:** Implement Redis caching for:
- User profiles (TTL: 5 min)
- Group details (TTL: 2 min)
- Popular posts (TTL: 1 min)

#### P2.2: Client-Side Cache Invalidation
**Location:** `src/lib/api.ts`
**Issue:** No intelligent cache invalidation strategy for React Query.
**Impact:** Stale data or excessive refetching.
**Recommendation:** Implement optimistic updates with proper invalidation. Use mutation callbacks to invalidate related queries.

---

### P3: Real-Time Optimization

#### P3.1: Excessive Realtime Subscriptions
**Location:** `src/lib/supabase/realtime.ts`
**Issue:** Each chat conversation creates separate subscription channels.
**Impact:** Connection overhead, potential hitting Supabase limits.
**Recommendation:** Consolidate subscriptions using single channel with client-side filtering for messages. Batch subscription setup.

#### P3.2: Presence Broadcast Frequency
**Location:** `src/components/study-sessions/VideoCall.tsx`
**Issue:** Presence updates broadcast too frequently during active sessions.
**Impact:** Bandwidth consumption, battery drain on mobile.
**Recommendation:** Throttle presence updates to every 30 seconds during stable state. Only broadcast on meaningful state changes.

---

### P4: Asset Optimization

#### P4.1: Image Loading Strategy
**Location:** `src/components/community/PostCard.tsx`
**Issue:** Post images loaded without lazy loading or progressive enhancement.
**Impact:** Slow initial page load, high bandwidth usage.
**Recommendation:** Implement Next.js Image component with:
- Lazy loading with placeholder
- Responsive srcset
- WebP format conversion
- Blur placeholder

#### P4.2: Avatar Image Sizes
**Location:** Multiple components
**Issue:** Full-size avatars loaded for thumbnail displays.
**Impact:** Unnecessary bandwidth consumption.
**Recommendation:** Generate multiple avatar sizes on upload (32px, 64px, 128px). Serve appropriate size based on display context.

---

### P5: Bundle Size

#### P5.1: AI Partner Code Splitting
**Location:** `src/components/ai-partner/AIPartnerChat.tsx`
**Issue:** AI Partner component and dependencies loaded on initial page load.
**Impact:** Larger initial bundle, slower first paint.
**Recommendation:** Dynamic import AI Partner component. Load only when user accesses the feature.

```typescript
const AIPartnerChat = dynamic(
  () => import('@/components/ai-partner/AIPartnerChat'),
  { loading: () => <Skeleton />, ssr: false }
)
```

#### P5.2: Video Call Dependencies
**Location:** `src/components/study-sessions/VideoCall.tsx`
**Issue:** Agora SDK loaded on pages that may not need video functionality.
**Impact:** Increased bundle size.
**Recommendation:** Already using dynamic import - verify it's working correctly. Consider preloading on session join intent.

---

### P6: API Response Times

#### P6.1: Feed API Latency
**Location:** `src/app/api/posts/route.ts`
**Target:** < 200ms for feed API responses
**Current Issue:** Complex queries with multiple joins may exceed target.
**Recommendation:**
- Add database query logging to identify slow queries
- Implement query result caching
- Consider read replicas for feed queries

#### P6.2: Search API Performance
**Location:** `src/app/api/search/route.ts`
**Target:** < 300ms for search results
**Current Issue:** Full-text search without proper indexing.
**Recommendation:**
- Add GIN/GiST indexes for text search columns
- Consider Elasticsearch for advanced search needs
- Implement search result caching

---

## Implementation Priority

### Immediate (This Sprint)
1. P1.1 - N+1 Query fix
2. H10 - Concurrent join race condition
3. H5 - Message ordering

### Short-term (Next 2 Sprints)
1. P2.1 - API Response Caching
2. H3 - Session state synchronization
3. H6 - Unread count accuracy
4. P3.1 - Realtime subscription consolidation

### Medium-term (Next Quarter)
1. H7 - Context window management
2. P4.1 - Image loading optimization
3. P5.1 - Code splitting improvements
4. H13 - Notification delivery guarantee

---

## Monitoring Recommendations

1. **Add APM Integration** - Implement application performance monitoring (e.g., Sentry Performance, Datadog) to track:
   - API response times
   - Database query durations
   - Error rates by endpoint

2. **Database Monitoring** - Set up alerts for:
   - Slow queries (> 500ms)
   - Connection pool exhaustion
   - Lock contention

3. **Real-time Health Checks** - Monitor:
   - Supabase realtime connection count
   - Subscription failure rates
   - Message delivery latency

---

*Generated: December 2024*
*Last Updated: December 2024*
