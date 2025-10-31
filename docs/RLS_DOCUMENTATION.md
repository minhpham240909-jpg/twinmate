# Row Level Security (RLS) Documentation

## Overview

Row Level Security (RLS) is enabled on all critical tables in the Clerva database to provide defense-in-depth security. Even if someone gains access to the database connection string, they cannot access user data without proper authentication.

## Security Strategy

**Approach**: Service Role Bypass Pattern

- Our Next.js API routes use the `service_role` key which bypasses RLS
- Direct database access (psql, SQL clients) is blocked by RLS policies
- This protects against credential theft and unauthorized direct access
- Application functionality is unaffected

## Protected Tables

The following tables have RLS enabled:

### Core User Data
- `User` - User accounts and authentication
- `Profile` - User profiles and preferences
- `LearningProfile` - Learning analytics and preferences

### Communication
- `Message` - Direct and group messages
- `SessionMessage` - Study session chat messages
- `Notification` - User notifications

### Social & Community
- `Post` - Community posts
- `PostComment` - Post comments
- `PostLike` - Post likes
- `PostRepost` - Post reposts
- `Match` - Study partner matches

### Groups & Sessions
- `Group` - Study groups
- `GroupMember` - Group membership
- `GroupInvite` - Group invitations
- `StudySession` - Study sessions
- `SessionParticipant` - Session participants
- `SessionGoal` - Session goals

### Gamification
- `Badge` - Achievement badges
- `UserBadge` - User-earned badges

## RLS Policies

### Current Policy: Service Role Full Access

All protected tables have a single policy:

```sql
CREATE POLICY "Allow service role full access to [TABLE]" ON "[TABLE]"
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

**What this means:**
- Only connections using the `service_role` key can access data
- Our Next.js API routes use this key via Prisma
- Direct database access is blocked unless using `service_role`

## Testing RLS

### Automated Testing

Run the RLS test suite:

```bash
npm run test:rls
# or
npx tsx scripts/test-rls.ts
```

This tests:
- Anonymous access is blocked on all protected tables
- Service role can access all tables
- Cross-user data access is prevented
- Anonymous write operations are blocked

### Manual Testing in Supabase

1. Go to Supabase SQL Editor
2. Run the verification script:

```bash
cat scripts/verify-rls.sql
```

3. Check the results:
   - All critical tables should show `rls_enabled = true`
   - Each table should have at least one policy
   - Test queries as `anon` role should return 0 rows

### Quick Verification Query

```sql
SELECT 
  tablename, 
  rowsecurity as rls_enabled,
  CASE WHEN rowsecurity THEN '✓' ELSE '✗ VULNERABLE' END
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('User', 'Profile', 'Message', 'StudySession')
ORDER BY tablename;
```

## Applying RLS Policies

### Initial Setup

If RLS is not yet enabled, run the existing script:

```bash
# In Supabase SQL Editor
# Run: clerva-app/enable_rls_security.sql
```

### Verifying After Setup

```bash
# 1. Verify RLS is enabled
npx tsx scripts/test-rls.ts

# 2. Check specific tables in SQL Editor
SELECT * FROM verify_rls.sql
```

## Security Best Practices

### Do's ✅

- Always use Prisma/service_role for database access in API routes
- Test RLS after any database schema changes
- Keep `SUPABASE_SERVICE_ROLE_KEY` secure and out of git
- Run RLS tests before major deployments
- Document any new RLS policies

### Don'ts ❌

- Never expose `service_role` key to client-side code
- Don't bypass RLS for "convenience" in development
- Don't commit database credentials to version control
- Don't grant public SELECT access to sensitive tables
- Don't assume API-level auth is enough (defense-in-depth)

## Troubleshooting

### API Routes Return "permission denied"

**Cause**: API route is not using service_role connection

**Solution**:
```typescript
// Wrong - uses anon key
import { createClient } from '@/lib/supabase/client'

// Correct - uses service_role
import { createClient } from '@/lib/supabase/server'
```

### RLS Test Fails: "Anonymous users can access data"

**Cause**: RLS not enabled or policy misconfigured

**Solution**:
1. Run `enable_rls_security.sql` in Supabase
2. Verify with `scripts/verify-rls.sql`
3. Check policy is created correctly

### Service Role Cannot Access Data

**Cause**: Overly restrictive policy or RLS blocking service_role

**Solution**:
1. Check policy allows `service_role`: `auth.role() = 'service_role'`
2. Verify connection string uses correct key
3. Test connection: `SELECT auth.role();`

### Table Not Listed in RLS Tests

**Cause**: Table not added to test suite

**Solution**:
1. Add table to `CRITICAL_TABLES` array in `scripts/test-rls.ts`
2. Add corresponding policy in `enable_rls_security.sql`
3. Rerun tests

## Future Enhancements

### Planned Improvements

1. **Granular Policies** (Post-Launch)
   - User can only read/write their own data
   - Group members can access group messages
   - Study session participants can access session data

2. **Authenticated User Policies**
   - Allow authenticated users direct client-side access
   - Would reduce API route overhead
   - Requires careful policy design

3. **Performance Optimization**
   - Add indexes to support RLS policy queries
   - Monitor query performance with RLS enabled
   - Optimize policies based on slow query logs

### Why Not Now?

For MVP launch, service_role bypass pattern is:
- Simpler to implement and test
- No risk of policy bugs affecting users
- Better for rapid iteration
- Can be enhanced after launch with real usage data

## Monitoring

### Regular Checks

**Weekly:**
- Run `npx tsx scripts/test-rls.ts`
- Review Supabase logs for unauthorized access attempts

**Monthly:**
- Audit RLS policies for new tables
- Review access patterns in Supabase dashboard
- Update documentation for schema changes

**After Schema Changes:**
- Run RLS tests immediately
- Add new tables to protected list
- Create appropriate policies

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Guide](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- Internal: `enable_rls_security.sql`
- Internal: `scripts/test-rls.ts`
- Internal: `scripts/verify-rls.sql`

## Support

If you encounter RLS-related issues:

1. Check this documentation
2. Run diagnostic scripts
3. Review Supabase logs
4. Check policy configuration in SQL Editor

For security concerns, treat as P0 and investigate immediately.

