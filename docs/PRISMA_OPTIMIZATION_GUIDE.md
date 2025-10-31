# Prisma Query Optimization Guide

## Overview

This guide provides patterns for optimizing Prisma queries in the Clerva app. Following these patterns will reduce database load, decrease API response times, and improve overall performance.

## Key Principles

1. **Fetch only what you need** - Use `.select()` instead of fetching all fields
2. **Paginate everything** - Always use `.take()` on list queries
3. **Avoid N+1 queries** - Use `.include()` or manual joins instead of loops
4. **Count efficiently** - Use `_count` instead of fetching all records
5. **Filter in the database** - Use `where` clauses, not JavaScript filtering

## Common Anti-Patterns & Fixes

### ❌ Anti-Pattern 1: Fetching All Fields

```typescript
// BAD: Fetches ALL fields including large text fields
const users = await prisma.user.findMany()
```

```typescript
// GOOD: Fetch only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    avatarUrl: true,
  },
})
```

### ❌ Anti-Pattern 2: No Pagination

```typescript
// BAD: Could return thousands of records
const posts = await prisma.post.findMany({
  where: { isDeleted: false },
})
```

```typescript
// GOOD: Paginate results
const posts = await prisma.post.findMany({
  where: { isDeleted: false },
  take: 50,
  skip: page * 50,
  orderBy: { createdAt: 'desc' },
})
```

### ❌ Anti-Pattern 3: N+1 Query Pattern

```typescript
// BAD: Makes 1 query + N queries (one per post)
const posts = await prisma.post.findMany({ take: 50 })
for (const post of posts) {
  post.author = await prisma.user.findUnique({
    where: { id: post.userId },
  })
}
```

```typescript
// GOOD: Single query with join
const posts = await prisma.post.findMany({
  take: 50,
  include: {
    author: {
      select: { id: true, name: true, avatarUrl: true },
    },
  },
})
```

### ❌ Anti-Pattern 4: Fetching to Count

```typescript
// BAD: Fetches all records just to count
const allLikes = await prisma.postLike.findMany({
  where: { postId },
})
const likeCount = allLikes.length
```

```typescript
// GOOD: Count in database
const likeCount = await prisma.postLike.count({
  where: { postId },
})

// EVEN BETTER: Use _count in the main query
const post = await prisma.post.findUnique({
  where: { id: postId },
  select: {
    id: true,
    content: true,
    _count: {
      select: {
        likes: true,
        comments: true,
      },
    },
  },
})
```

### ❌ Anti-Pattern 5: Fetching All Related Records

```typescript
// BAD: Loads ALL user's posts (could be thousands)
const user = await prisma.user.findUnique({
  where: { id },
  include: {
    posts: true,  // All posts!
    sentMessages: true,  // All messages!
    studySessions: true,  // All sessions!
  },
})
```

```typescript
// GOOD: Just get counts or limited recent items
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    email: true,
    avatarUrl: true,
    profile: true,
    _count: {
      select: {
        posts: true,
        sentMessages: true,
        studySessions: true,
      },
    },
    // Optional: Get recent posts
    posts: {
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: { isDeleted: false },
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
    },
  },
})
```

## Optimization Patterns by Feature

### User Profile Loading

```typescript
// Optimized user profile query
export async function getUserProfile(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      // Basic info
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      role: true,
      
      // Profile data
      profile: {
        select: {
          bio: true,
          subjects: true,
          interests: true,
          goals: true,
          onlineStatus: true,
          studyStreak: true,
          totalStudyHours: true,
        },
      },
      
      // Counts only (not full data)
      _count: {
        select: {
          posts: true,
          studySessions: true,
          badges: true,
        },
      },
      
      // Recent activity (limited)
      posts: {
        take: 3,
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          createdAt: true,
          _count: {
            select: { likes: true, comments: true },
          },
        },
      },
    },
  })
}
```

### Community Feed

```typescript
// Optimized post feed query
export async function getPostFeed(page: number = 0, pageSize: number = 20) {
  return await prisma.post.findMany({
    where: { isDeleted: false },
    take: pageSize,
    skip: page * pageSize,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
      imageUrls: true,
      createdAt: true,
      
      // Author info (limited fields)
      author: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
      
      // Counts (not full lists)
      _count: {
        select: {
          likes: true,
          comments: true,
          reposts: true,
        },
      },
    },
  })
}
```

### Message Loading (DM or Group)

```typescript
// Optimized message query
export async function getMessages(
  conversationId: string,
  conversationType: 'dm' | 'group',
  page: number = 0
) {
  const where = conversationType === 'dm'
    ? {
        OR: [
          { senderId: conversationId },
          { recipientId: conversationId },
        ],
        deletedAt: null,
      }
    : {
        groupId: conversationId,
        deletedAt: null,
      }

  return await prisma.message.findMany({
    where,
    take: 50,
    skip: page * 50,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
      type: true,
      createdAt: true,
      isRead: true,
      
      // Sender info (limited)
      sender: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
      
      // Call metadata (if CALL type)
      callType: true,
      callDuration: true,
      callStatus: true,
    },
  })
}
```

### Study Session Dashboard

```typescript
// Optimized active sessions query
export async function getActiveSessions(userId: string) {
  return await prisma.studySession.findMany({
    where: {
      OR: [
        { createdBy: userId },
        { participants: { some: { userId } } },
      ],
      status: { in: ['WAITING', 'ACTIVE'] },
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      type: true,
      startedAt: true,
      
      // Creator info
      creator: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
      
      // Participant count (not full list)
      _count: {
        select: { participants: true },
      },
      
      // Recent participants (limited)
      participants: {
        take: 5,
        where: { status: { in: ['INVITED', 'JOINED'] } },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          status: true,
        },
      },
    },
  })
}
```

### Partner Search

```typescript
// Optimized partner search query
export async function searchPartners(
  subjects: string[],
  limit: number = 20
) {
  return await prisma.profile.findMany({
    where: {
      isLookingForPartner: true,
      onlineStatus: { in: ['ONLINE', 'LOOKING_FOR_PARTNER'] },
      subjects: { hasSome: subjects },
    },
    take: limit,
    select: {
      // Profile fields
      subjects: true,
      interests: true,
      skillLevel: true,
      studyStyle: true,
      bio: true,
      
      // User info
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          role: true,
        },
      },
      
      // Stats
      studyStreak: true,
      totalStudyHours: true,
    },
  })
}
```

## Cursor-Based Pagination (Advanced)

For infinite scroll or real-time feeds, use cursor-based pagination:

```typescript
// More efficient than offset pagination for large datasets
export async function getPostsCursor(
  cursor?: string,
  limit: number = 20
) {
  return await prisma.post.findMany({
    take: limit,
    ...(cursor && {
      skip: 1, // Skip the cursor
      cursor: { id: cursor },
    }),
    orderBy: { createdAt: 'desc' },
    where: { isDeleted: false },
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: {
        select: { id: true, name: true, avatarUrl: true },
      },
      _count: {
        select: { likes: true, comments: true },
      },
    },
  })
}
```

## Query Optimization Checklist

Before deploying a new API route, verify:

- [ ] Used `.select()` to limit fields
- [ ] Added `.take()` to limit results (max 100)
- [ ] Used `_count` instead of fetching arrays for counts
- [ ] Used `.include()` with `.select()` for related data
- [ ] Added proper `where` clauses for filtering
- [ ] Ordered results if needed
- [ ] Used cursor pagination for large datasets
- [ ] Tested with realistic data volume

## Measuring Query Performance

Use the timing middleware to measure queries:

```typescript
import { measureQuery } from '@/lib/middleware/timing'

export async function getUsers() {
  return await measureQuery(
    'Find all users',
    async () => {
      return await prisma.user.findMany({
        select: { id: true, name: true, email: true },
        take: 50,
      })
    },
    100 // Warn if > 100ms
  )
}
```

## Audit Your Existing Code

### Find queries without .select()

```bash
# Search for queries without select
grep -r "prisma\.\w*\.find" src/app/api --include="*.ts" | \
  grep -v "select:" | \
  head -20
```

### Find queries without .take()

```bash
# Search for findMany without take
grep -r "\.findMany(" src/app/api --include="*.ts" -A 5 | \
  grep -v "take:" | \
  head -20
```

### Find potential N+1 patterns

```bash
# Search for await inside loops
grep -r "for.*of\|for.*in" src/app/api --include="*.ts" -A 3 | \
  grep "await prisma"
```

## Gradual Migration Strategy

Don't optimize everything at once. Prioritize:

1. **High-traffic endpoints first**
   - `/api/posts` (community feed)
   - `/api/messages/conversations` (chat)
   - `/api/users/[userId]` (profiles)

2. **Slow queries** (use timing middleware to identify)

3. **New features** (apply patterns from the start)

4. **Low-traffic endpoints** (optimize when time permits)

## Before & After Examples

### Example 1: User Profile Page

**Before:**
```typescript
// Fetches everything, no limits
const user = await prisma.user.findUnique({
  where: { id },
  include: {
    profile: true,
    posts: true,
    studySessions: true,
    badges: true,
  },
})
```
**Query time**: ~500ms, **Data size**: ~2MB

**After:**
```typescript
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    email: true,
    avatarUrl: true,
    profile: {
      select: {
        bio: true,
        subjects: true,
        studyStreak: true,
      },
    },
    _count: {
      select: { posts: true, studySessions: true },
    },
    posts: {
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true, createdAt: true },
    },
  },
})
```
**Query time**: ~50ms, **Data size**: ~20KB (100x improvement!)

### Example 2: Post Feed

**Before:**
```typescript
const posts = await prisma.post.findMany({
  include: {
    author: true,  // All author fields
    likes: true,   // All like records
    comments: true, // All comments
    reposts: true, // All reposts
  },
})
```
**Query time**: ~2000ms, **Records**: 10,000+

**After:**
```typescript
const posts = await prisma.post.findMany({
  take: 50,
  where: { isDeleted: false },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    content: true,
    createdAt: true,
    author: {
      select: { id: true, name: true, avatarUrl: true },
    },
    _count: {
      select: { likes: true, comments: true, reposts: true },
    },
  },
})
```
**Query time**: ~100ms, **Records**: 50 (20x faster!)

## Resources

- [Prisma Performance Guide](https://www.prisma.io/docs/guides/performance-and-optimization)
- [Prisma Select API](https://www.prisma.io/docs/concepts/components/prisma-client/select-fields)
- [Prisma Pagination](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)
- Internal: `/docs/PERFORMANCE_MONITORING.md`

## Next Steps

1. Install timing middleware on high-traffic routes
2. Run profiling queries to identify slow endpoints
3. Apply optimizations to top 5 slowest routes
4. Set up regular performance monitoring
5. Update this guide with new patterns as you discover them

