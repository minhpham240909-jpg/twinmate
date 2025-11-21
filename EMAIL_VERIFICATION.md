# Email Verification Implementation Guide

## Overview

Email verification enforcement has been implemented to require verified email addresses for critical features. Unverified users will be blocked from actions that could lead to spam or abuse.

## Architecture

### Server-Side Components

1. **`src/lib/email-verification.ts`** - Core utilities
   - `isEmailVerified()` - Check if user's email is verified
   - `requireEmailVerification()` - Middleware wrapper for route handlers
   - `resendVerificationEmail()` - Resend verification email
   - `getVerificationErrorMessage()` - Get user-friendly error messages

2. **`src/app/api/auth/verify-email/route.ts`** - Verification API
   - GET `/api/auth/verify-email` - Check verification status
   - POST `/api/auth/verify-email` - Resend verification email (rate-limited: 3/hour)

### Client-Side Components

1. **`src/components/EmailVerificationBanner.tsx`** - Verification banner
   - Displays at top of page when email is unverified
   - Provides "Resend Email" button
   - Can be dismissed temporarily

## Features Requiring Verification

The following features require email verification:

- ✅ Create study sessions
- ✅ Join study sessions
- ✅ Send messages
- ✅ Create groups
- ✅ Send connection requests
- ✅ Upload files (avatar, posts, etc.)
- ✅ Create posts
- ✅ Comment on posts

## Usage

### Protecting API Routes

Use the `requireEmailVerification` middleware to protect routes:

```typescript
import { requireEmailVerification } from '@/lib/email-verification'

export async function POST(req: NextRequest) {
  return requireEmailVerification(req, async () => {
    // Your protected route logic here
    const body = await req.json()
    // ... process request
    return NextResponse.json({ success: true })
  })
}
```

### Manual Verification Check

For more granular control:

```typescript
import { isEmailVerified, getVerificationErrorMessage } from '@/lib/email-verification'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const verified = await isEmailVerified(user.id)
  if (!verified) {
    return NextResponse.json(
      {
        error: 'Email verification required',
        message: getVerificationErrorMessage('CREATE_SESSION'),
        needsVerification: true,
      },
      { status: 403 }
    )
  }

  // Continue with protected logic...
}
```

### Adding Verification Banner

Add the banner to your layout to inform users:

```typescript
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner'

export default function Layout({ children }) {
  return (
    <>
      <EmailVerificationBanner />
      {children}
    </>
  )
}
```

## Implementation Status

### ✅ Completed

- Email verification utilities and middleware
- API endpoints for checking status and resending emails
- Verification banner component
- Rate limiting on resend requests (3/hour)
- Documentation

### ⚠️ TODO - Apply to Routes

Email verification needs to be applied to critical API routes:

**High Priority (Spam Prevention):**
- [ ] `/api/messages/send` - Prevent spam messages
- [ ] `/api/posts` - Prevent spam posts
- [ ] `/api/posts/[postId]/comments` - Prevent spam comments
- [ ] `/api/groups/create` - Prevent spam group creation
- [ ] `/api/connections/send` - Prevent spam connection requests
- [ ] `/api/upload/*` - All upload endpoints

**Medium Priority:**
- [ ] `/api/study-sessions/create` - Prevent fake sessions
- [ ] `/api/study-sessions/[sessionId]/join` - Prevent session spam
- [ ] `/api/groups/invite` - Prevent invite spam

### Adding Verification Banner to Layout

**TODO:** Add `<EmailVerificationBanner />` to `src/app/layout.tsx`:

```typescript
// In src/app/layout.tsx
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner'

// Inside the body:
<body>
  <EmailVerificationBanner />
  <Providers>
    {children}
  </Providers>
</body>
```

## How Verification Works

1. **Sign Up Flow:**
   - User signs up with email/password
   - Supabase sends verification email automatically
   - User's `emailVerified` field in database is `false`

2. **Verification:**
   - User clicks link in email
   - Supabase marks email as confirmed (`email_confirmed_at` set)
   - Next time user makes request, verification status is synced to database

3. **Protected Actions:**
   - When user tries protected action, `isEmailVerified()` checks both Supabase and database
   - If unverified, request is rejected with 403 status
   - Frontend can detect `needsVerification: true` in response

4. **Resending Email:**
   - User clicks "Resend Email" in banner
   - POST to `/api/auth/verify-email`
   - Rate-limited to 3 attempts per hour
   - Supabase sends new verification email

## Client-Side Handling

### Detecting Verification Requirement

When making API requests, check for verification errors:

```typescript
const response = await fetch('/api/posts', {
  method: 'POST',
  body: JSON.stringify(data),
})

const result = await response.json()

if (response.status === 403 && result.needsVerification) {
  // Show verification prompt
  toast.error(result.message || 'Email verification required')
  // Optionally: show modal or redirect to settings
}
```

### Using the Hook

Create a custom hook for verification checks:

```typescript
// src/hooks/useEmailVerification.ts
import { useState, useEffect } from 'react'

export function useEmailVerification() {
  const [verified, setVerified] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkVerification() {
      try {
        const response = await fetch('/api/auth/verify-email')
        if (response.ok) {
          const data = await response.json()
          setVerified(data.verified)
        }
      } catch (error) {
        console.error('Error checking verification:', error)
      } finally {
        setLoading(false)
      }
    }

    checkVerification()
  }, [])

  return { verified, loading }
}
```

## Testing

### Test Verification Flow

1. **Sign up with new account:**
   ```bash
   # Sign up should send verification email
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
   ```

2. **Try protected action (should fail):**
   ```bash
   # Attempt to create post without verification
   curl -X POST http://localhost:3000/api/posts \
     -H "Content-Type: application/json" \
     -d '{"content":"Test post"}'
   ```

3. **Check verification status:**
   ```bash
   curl http://localhost:3000/api/auth/verify-email
   ```

4. **Resend verification email:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/verify-email
   ```

### Supabase Email Configuration

Ensure email settings are configured in Supabase dashboard:
- Go to Authentication > Email Templates
- Customize verification email template
- Set redirect URL: `https://yourdomain.com/auth/callback`

## Environment Variables

No additional environment variables needed. Verification uses existing Supabase configuration.

## Migration Strategy

### Phase 1: Soft Launch (Current)
- ✅ Verification infrastructure in place
- ⚠️ Not enforced on routes yet
- Banner shows but actions still allowed

### Phase 2: Gradual Enforcement
- Apply `requireEmailVerification` to high-priority routes first
- Monitor for issues
- Communicate changes to users

### Phase 3: Full Enforcement
- Apply to all critical routes
- Make verification banner more prominent if not verified
- Consider blocking certain features entirely

### Phase 4: Grace Period (Optional)
- Allow existing unverified users X days to verify
- After grace period, fully enforce verification
- Send reminder emails to unverified users

## Troubleshooting

### "Email verification required" error

**User not receiving emails?**
- Check spam folder
- Verify Supabase email settings
- Check Supabase email quotas (free tier limits)
- Try resending with rate limit consideration

**Already verified but still seeing error?**
- Clear browser cache
- Log out and log back in
- Check Supabase dashboard for user's email confirmation status
- Verify `emailVerified` field in database matches Supabase

### Rate limit exceeded

- Users can only resend verification email 3 times per hour
- Clear rate limit cache if needed (Redis or in-memory)
- Consider increasing limit for support cases

## Best Practices

1. **User Experience:**
   - Show clear messages about why verification is needed
   - Make resend button easily accessible
   - Don't completely block the user - let them explore non-critical features

2. **Security:**
   - Always check verification on server-side, never trust client
   - Rate limit resend requests to prevent abuse
   - Log verification attempts for monitoring

3. **Communication:**
   - Send welcome email with clear verification instructions
   - Remind users periodically if still unverified
   - Provide support contact for verification issues

4. **Development:**
   - In development, you may want to auto-verify test accounts
   - Consider a bypass flag for admin/test users
   - Document which features require verification

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Email Verification Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#email-verification)
