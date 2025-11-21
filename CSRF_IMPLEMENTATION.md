# CSRF Protection Implementation Guide

## Overview

CSRF (Cross-Site Request Forgery) protection has been implemented using a token-based approach. All state-changing requests (POST, PUT, DELETE, PATCH) to API routes should include a CSRF token.

## Architecture

### Server-Side Components

1. **`src/lib/csrf.ts`** - Core CSRF utilities
   - `generateCsrfToken()` - Generate token for current session
   - `validateCsrfToken()` - Validate token from request
   - `withCsrfProtection()` - Middleware wrapper for route handlers

2. **`src/app/api/csrf/route.ts`** - Token endpoint
   - GET `/api/csrf` - Returns CSRF token for current session

3. **`middleware.ts`** - Global security headers
   - Adds security headers to all responses

### Client-Side Components

1. **`src/hooks/useCsrfToken.ts`** - React hook for token management
   - `useCsrfToken()` - Fetches and manages CSRF token
   - `addCsrfHeader()` - Helper to add token to fetch headers

## How It Works

1. **Token Generation**: Tokens are derived from the user's Supabase session token + server secret
2. **Token Transmission**: Client includes token in `x-csrf-token` header
3. **Token Validation**: Server validates token matches expected value for session
4. **Automatic Refresh**: Token automatically updates when user session changes

## Usage

### Option 1: Using the Hook (Recommended for React Components)

```typescript
import { useCsrfToken, addCsrfHeader } from '@/hooks/useCsrfToken'

function MyComponent() {
  const { csrfToken } = useCsrfToken()

  const handleSubmit = async () => {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: addCsrfHeader({
        'Content-Type': 'application/json',
      }, csrfToken),
      body: JSON.stringify({ content: 'Hello world' }),
    })
  }
}
```

### Option 2: Manual Token Fetching

```typescript
// Fetch token
const tokenResponse = await fetch('/api/csrf')
const { csrfToken } = await tokenResponse.json()

// Use in request
const response = await fetch('/api/posts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
  },
  body: JSON.stringify(data),
})
```

### Option 3: Applying to API Routes

To protect an API route, wrap the handler with `withCsrfProtection`:

```typescript
import { withCsrfProtection } from '@/lib/csrf'

export async function POST(req: NextRequest) {
  return withCsrfProtection(req, async () => {
    // Your route logic here
    const body = await req.json()
    // ... process request
    return NextResponse.json({ success: true })
  })
}
```

## Routes That Skip CSRF Protection

The following routes are excluded from CSRF validation:
- `/api/auth/google` - OAuth callbacks
- `/api/cron/*` - Scheduled tasks
- `/api/webhooks/*` - External webhooks
- `/api/health` - Health checks

To add more exceptions, edit `shouldSkipCsrfProtection()` in `src/lib/csrf.ts`.

## Current Implementation Status

### ✅ Completed
- CSRF token generation and validation utilities
- API endpoint for token retrieval
- Client-side React hook for token management
- Security headers middleware
- Documentation

### ⚠️ TODO - Apply to All Routes

CSRF protection needs to be applied to all state-changing API routes. The recommended approach is:

**Method 1: Wrap Individual Routes** (More Control)
Apply `withCsrfProtection` to each POST/PUT/DELETE/PATCH handler:

```typescript
export async function POST(req: NextRequest) {
  return withCsrfProtection(req, async () => {
    // handler logic
  })
}
```

**Method 2: Global Middleware** (Simpler)
Modify `middleware.ts` to validate CSRF tokens for all API routes automatically.

### Routes to Protect (Priority)

High Priority:
- [x] `/api/messages/send` - Already has rate limiting
- [x] `/api/posts` - Already has rate limiting
- [x] `/api/posts/[postId]/comments` - Already has rate limiting
- [x] `/api/groups/create` - Already has rate limiting
- [x] `/api/connections/send` - Already has rate limiting
- [ ] `/api/groups/[groupId]` - Update/delete
- [ ] `/api/posts/[postId]` - Update/delete
- [ ] `/api/posts/[postId]/like` - Like/unlike
- [ ] `/api/settings/*` - All settings updates
- [ ] `/api/profile/update` - Profile updates

Medium Priority:
- [ ] All other POST/PUT/DELETE/PATCH endpoints

## Environment Variables

Add to `.env.local`:

```bash
# CSRF Secret (change in production)
CSRF_SECRET=your-random-secret-here-min-32-chars
```

⚠️ **IMPORTANT**: Generate a strong random secret for production:
```bash
openssl rand -base64 32
```

## Testing

To test CSRF protection:

1. **Valid Request**:
   ```bash
   # Get token
   TOKEN=$(curl -s http://localhost:3000/api/csrf | jq -r '.csrfToken')
   
   # Make request with token
   curl -X POST http://localhost:3000/api/posts \
     -H "x-csrf-token: $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"content":"Test"}'
   ```

2. **Invalid Request** (should fail):
   ```bash
   curl -X POST http://localhost:3000/api/posts \
     -H "Content-Type: application/json" \
     -d '{"content":"Test"}'
   ```

## Security Considerations

1. **Token Lifetime**: Tokens are tied to the user session and expire when the session expires
2. **HTTPS Required**: CSRF protection is most effective when combined with HTTPS
3. **SameSite Cookies**: Supabase auth cookies should use `SameSite=Lax` or `SameSite=Strict`
4. **Origin Validation**: Consider adding origin header validation for extra protection
5. **Rate Limiting**: CSRF protection works alongside rate limiting (already implemented)

## Migration Strategy

To roll out CSRF protection without breaking existing functionality:

### Phase 1: Soft Launch (Current)
- CSRF infrastructure is ready
- Not enforced on routes yet
- Allows time for client-side integration

### Phase 2: Client Integration
- Update all fetch calls to include CSRF tokens
- Use `useCsrfToken` hook in components
- Test thoroughly in development

### Phase 3: Enforcement
- Apply `withCsrfProtection` to all routes
- Monitor error logs for any missed integrations
- Provide clear error messages to help debug issues

### Phase 4: Hardening
- Make CSRF_SECRET mandatory
- Add stricter validation
- Consider origin/referer header checks

## Troubleshooting

### "Invalid or missing CSRF token" error

1. **Check token is being fetched**: Use browser dev tools to verify `/api/csrf` call
2. **Verify header is sent**: Check request headers include `x-csrf-token`
3. **Check session is valid**: User must be authenticated
4. **Token mismatch**: Token must match current session (re-fetch after login/logout)

### Token not updating after login

- `useCsrfToken` hook depends on `useAuth().user` 
- Ensure AuthContext is properly updated on login/logout
- Check React component re-renders when user changes

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Double Submit Cookie Pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie)
