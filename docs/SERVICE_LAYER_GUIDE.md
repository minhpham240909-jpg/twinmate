# Service Layer Architecture Guide

## Overview

The service layer provides a consistent interface for all database operations with built-in retry logic, error handling, and performance tracking.

## Why Use Services?

### Before (Direct Database Access)
```typescript
// API Route: /app/api/users/[id]/route.ts
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: params.id },
  })

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json(dbUser)
}
```

**Problems:**
- Auth logic repeated in every route
- No retry on transient failures
- Inconsistent error handling
- No performance tracking
- Hard to test

### After (With Services)
```typescript
// API Route: /app/api/users/[id]/route.ts
import { authService, NotFoundError } from '@/services'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Auth check (consistent across all routes)
  const currentUser = await authService.getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user (with automatic retry, error handling)
  const user = await authService.getUserById(params.id)
  
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json(user)
}
```

**Benefits:**
- ✅ Consistent auth checks
- ✅ Automatic retry on failures
- ✅ Typed errors
- ✅ Performance tracking
- ✅ Easy to test
- ✅ Single source of truth for business logic

## Service Architecture

```
src/services/
├── base.service.ts          # Base class with retry logic
├── auth.service.ts          # Authentication operations
├── user.service.ts          # User CRUD operations
├── session.service.ts       # Study session operations
├── message.service.ts       # Messaging operations
└── index.ts                 # Central exports
```

## Base Service Features

### 1. Automatic Retry Logic

```typescript
// Automatically retries on transient failures
const user = await authService.getUserById(userId)

// Behind the scenes:
// - Retry up to 3 times on network errors
// - Exponential backoff (100ms, 200ms, 400ms)
// - Jitter to prevent thundering herd
// - Only retries on retryable errors
```

### 2. Transaction Support

```typescript
// Multiple operations in a transaction with retry
await this.withTransaction(async (tx) => {
  await tx.user.create({ data: { ... } })
  await tx.profile.create({ data: { ... } })
  // Both succeed or both fail
})
```

### 3. Typed Errors

```typescript
import { NotFoundError, UnauthorizedError, ValidationError } from '@/services'

try {
  const user = await authService.getUserById(userId)
} catch (error) {
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
  // Unexpected error
  throw error
}
```

### 4. Health Checks

```typescript
// Check if database is accessible
const isHealthy = await authService.healthCheck()

// Get connection info
const info = await authService.getConnectionInfo()
// { connected: true, activeConnections: 5 }
```

## Creating a New Service

### 1. Extend DatabaseService

```typescript
// src/services/user.service.ts
import { DatabaseService, NotFoundError, ValidationError } from './base.service'

export class UserService extends DatabaseService {
  /**
   * Get user profile with related data
   */
  async getProfile(userId: string) {
    // withRetry automatically handles transient failures
    return await this.withRetry(async () => {
      const user = await this.db.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      })

      if (!user) {
        throw new NotFoundError('User', userId)
      }

      return user
    })
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: { name?: string; bio?: string }) {
    if (!data.name && !data.bio) {
      throw new ValidationError('No data provided to update')
    }

    return await this.withRetry(async () => {
      // Update in transaction if updating multiple tables
      return await this.withTransaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: userId },
          data: { name: data.name },
        })

        if (data.bio) {
          await tx.profile.update({
            where: { userId },
            data: { bio: data.bio },
          })
        }

        return user
      })
    })
  }
}

// Export singleton
export const userService = new UserService()
```

### 2. Add to index.ts

```typescript
// src/services/index.ts
export { UserService, userService } from './user.service'
```

### 3. Use in API Routes

```typescript
// src/app/api/users/[id]/route.ts
import { userService, NotFoundError } from '@/services'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await userService.getProfile(params.id)
    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    throw error
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  
  try {
    const user = await userService.updateProfile(params.id, body)
    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }
}
```

## Error Handling Patterns

### Service-Level Errors

```typescript
// In your service
async getUser(userId: string) {
  const user = await this.db.user.findUnique({ where: { id: userId } })
  
  if (!user) {
    // Throw typed error
    throw new NotFoundError('User', userId)
  }
  
  if (!user.emailVerified) {
    throw new UnauthorizedError('Email not verified')
  }
  
  return user
}
```

### API Route Error Handling

```typescript
// Pattern 1: Try-catch with specific errors
try {
  const user = await userService.getUser(userId)
  return NextResponse.json(user)
} catch (error) {
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }
  // Log unexpected errors
  console.error('Unexpected error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

// Pattern 2: ServiceResult wrapper (functional approach)
import { toServiceResult } from '@/services'

const result = await toServiceResult(() => userService.getUser(userId))

if (result.success) {
  return NextResponse.json(result.data)
} else {
  return NextResponse.json(
    { error: result.error.message },
    { status: result.error.statusCode }
  )
}
```

## Testing Services

### Unit Testing

```typescript
// __tests__/services/user.service.test.ts
import { userService, NotFoundError } from '@/services'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

describe('UserService', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should get user profile', async () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
    }

    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)

    const user = await userService.getProfile('123')
    expect(user).toEqual(mockUser)
  })

  it('should throw NotFoundError when user not found', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(userService.getProfile('999')).rejects.toThrow(NotFoundError)
  })
})
```

## Migration Strategy

### Phase 1: Create Services (Week 5-6)
1. ✅ Create base service infrastructure
2. ✅ Create auth service
3. Create user service
4. Create session service
5. Create message service

### Phase 2: Refactor API Routes (Week 7-8)
1. Start with high-traffic routes:
   - `/api/auth/*` → use authService
   - `/api/users/*` → use userService
   - `/api/posts/*` → use postService (if created)
2. Gradually migrate other routes
3. Test thoroughly after each migration

### Phase 3: Remove Direct Prisma Access (Week 9+)
1. Once all routes use services, remove direct `prisma` imports from API routes
2. Services become the single source of truth
3. Easier to add caching, logging, monitoring

## Best Practices

### DO ✅

- Use services for all database operations
- Throw typed errors (NotFoundError, ValidationError, etc.)
- Use `withRetry` for operations that might fail transiently
- Use `withTransaction` for multi-step operations
- Keep services focused (Single Responsibility Principle)
- Write tests for service methods

### DON'T ❌

- Don't call Prisma directly from API routes (use services)
- Don't catch and swallow errors without logging
- Don't retry non-retryable errors (unique constraint violations, etc.)
- Don't put business logic in API routes (move to services)
- Don't create god services (keep them focused)

## Performance Considerations

### Retry Configuration

```typescript
// Default is good for most cases
await service.someMethod()

// Custom retry for critical operations
await this.withRetry(
  async () => { /* operation */ },
  {
    maxRetries: 5,
    initialDelayMs: 200,
    maxDelayMs: 10000,
  }
)

// No retry for operations that shouldn't be retried
await this.withRetry(
  async () => { /* operation */ },
  { maxRetries: 0 }  // Disable retry
)
```

### Transaction Guidelines

Only use transactions when you need atomicity:

```typescript
// GOOD: Multiple related writes
await this.withTransaction(async (tx) => {
  await tx.user.create({ ... })
  await tx.profile.create({ ... })
  await tx.notification.create({ ... })
})

// BAD: Single write (unnecessary transaction overhead)
await this.withTransaction(async (tx) => {
  await tx.user.update({ ... })
})

// GOOD: Just use withRetry
await this.withRetry(async () => {
  await this.db.user.update({ ... })
})
```

## Next Steps

1. **Create remaining services:**
   - user.service.ts
   - session.service.ts
   - message.service.ts
   - post.service.ts

2. **Migrate API routes:**
   - Start with auth routes
   - Then user routes
   - Then other features

3. **Add monitoring:**
   - Track service call durations
   - Log retry attempts
   - Alert on high error rates

4. **Document patterns:**
   - Update this guide with new patterns
   - Add examples from real code
   - Share with team (when you hire)

## Resources

- Base Service: `src/services/base.service.ts`
- Auth Service Example: `src/services/auth.service.ts`
- Prisma Docs: https://www.prisma.io/docs
- Error Handling: `/docs/ERROR_HANDLING.md` (TODO)

