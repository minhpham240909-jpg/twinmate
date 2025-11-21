# Sentry Error Tracking Setup

## Status: ✅ CONFIGURED

Sentry is already installed and configured for error tracking across all environments (client, server, and edge).

## Configuration Files

- **`sentry.client.config.ts`** - Client-side error tracking
- **`sentry.server.config.ts`** - Server-side error tracking  
- **`sentry.edge.config.ts`** - Edge runtime error tracking

## Environment Variables Required

Add to `.env.local` for development and production:

```bash
# Sentry DSN (Data Source Name)
NEXT_PUBLIC_SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id

# Optional: Auth token for source maps upload
SENTRY_AUTH_TOKEN=your-auth-token

# Optional: Organization and project
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

## Getting Your Sentry DSN

1. Sign up at [sentry.io](https://sentry.io) (free tier available)
2. Create a new project or use existing one
3. Go to **Settings > Projects > [Your Project] > Client Keys (DSN)**
4. Copy the DSN value
5. Add to your environment variables

## Features Configured

### Client-Side (`sentry.client.config.ts`)
- ✅ Session replay on errors (100% of errors)
- ✅ Session replay sampling (10% of sessions)
- ✅ Privacy: masks all text and blocks all media in replays
- ✅ Filters out browser extension errors
- ✅ Filters out network errors
- ✅ Only enabled in production
- ✅ Removes sensitive data (cookies, headers)

### Server-Side (`sentry.server.config.ts`)
- ✅ Tracks server errors
- ✅ Filters out network timeouts and connection errors
- ✅ Removes query parameters (may contain sensitive data)
- ✅ Removes cookies and headers
- ✅ Only enabled in production

### Edge Runtime (`sentry.edge.config.ts`)
- ✅ Tracks middleware and edge function errors
- ✅ Only enabled in production

## Current Settings

| Setting | Value | Notes |
|---------|-------|-------|
| Traces Sample Rate | 100% | Adjust to 10% in production for high-traffic apps |
| Replays on Error | 100% | Captures replay for every error |
| Replays Session Rate | 10% | Captures 10% of sessions regardless of errors |
| Environment | Auto-detected | Uses `process.env.NODE_ENV` |
| Enabled | Production only | Disabled in development |

## Recommended Production Settings

For high-traffic production apps, adjust sample rates in config files:

```typescript
// Lower sample rates for cost efficiency
tracesSampleRate: 0.1,  // 10% of transactions
replaysSessionSampleRate: 0.01,  // 1% of sessions
```

## Ignored Errors

Already configured to ignore:
- Browser extension errors
- Network connectivity issues
- CORS errors
- Connection timeouts
- Socket hang ups
- Non-actionable errors

## Manual Error Reporting

### Client-Side
```typescript
import * as Sentry from '@sentry/nextjs'

try {
  // Your code
} catch (error) {
  Sentry.captureException(error)
}
```

### Server-Side API Routes
```typescript
import * as Sentry from '@sentry/nextjs'

export async function POST(req: NextRequest) {
  try {
    // Your code
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Adding Context
```typescript
Sentry.setUser({
  id: user.id,
  // Don't include email for privacy
})

Sentry.setContext('additional_info', {
  feature: 'study-sessions',
  action: 'create',
})

Sentry.captureException(error)
```

## Testing Sentry

### Test Client-Side Error
Add a test button in development:
```typescript
<button onClick={() => {
  throw new Error('Test Sentry Error')
}}>
  Test Sentry
</button>
```

### Test Server-Side Error
Create a test API route:
```typescript
// app/api/sentry-test/route.ts
export async function GET() {
  throw new Error('Test server error')
}
```

## Source Maps Upload

To get detailed stack traces, upload source maps to Sentry:

1. Add to `next.config.js`:
```javascript
const { withSentryConfig } = require('@sentry/nextjs')

module.exports = withSentryConfig(
  {
    // Your Next.js config
  },
  {
    // Sentry webpack plugin options
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
  }
)
```

2. Source maps will be automatically uploaded during build

## Monitoring & Alerts

### Recommended Alerts to Set Up

1. **High Error Rate**: Alert when error rate exceeds threshold
2. **New Issue**: Notify on first occurrence of new error
3. **Regression**: Alert when resolved issue reoccurs
4. **Performance**: Alert on slow API responses

### Setting Up Alerts

1. Go to Sentry dashboard
2. Navigate to **Alerts** > **Create Alert**
3. Choose alert type and configure conditions
4. Set notification channels (email, Slack, etc.)

## Privacy & Compliance

- ✅ User emails are filtered out
- ✅ Cookies and headers are removed
- ✅ Query parameters are stripped
- ✅ Session replays mask text and media
- ✅ Only enabled in production
- ✅ No PII (Personally Identifiable Information) sent

## Performance Monitoring

Sentry also tracks:
- Page load times
- API response times
- Database query performance
- React component render times

View in Sentry dashboard under **Performance** tab.

## Cost Optimization

Free tier includes:
- 5,000 errors/month
- 500 replays/month
- 10,000 performance transactions/month

To stay within limits:
- Use appropriate sample rates
- Filter out non-actionable errors
- Focus on production monitoring

## Troubleshooting

### "Sentry not capturing errors"
1. Check `NEXT_PUBLIC_SENTRY_DSN` is set
2. Ensure `NODE_ENV=production`
3. Verify error is not in `ignoreErrors` list
4. Check Sentry dashboard quota

### "Too many events"
1. Lower sample rates
2. Add more errors to `ignoreErrors`
3. Use `beforeSend` to filter more aggressively

### "Source maps not working"
1. Verify `SENTRY_AUTH_TOKEN` is set
2. Check build logs for upload errors
3. Ensure correct org/project in config

## Next Steps

1. ✅ Sentry is configured
2. ⚠️ **TODO**: Add `NEXT_PUBLIC_SENTRY_DSN` to environment variables
3. ⚠️ **TODO**: Test error reporting in staging/production
4. ⚠️ **TODO**: Set up alert rules in Sentry dashboard
5. ⚠️ **TODO**: Configure team notifications

## Resources

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Dashboard](https://sentry.io)
- [Best Practices](https://docs.sentry.io/product/best-practices/)
