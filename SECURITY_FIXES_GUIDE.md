# Complete Security & Performance Fixes Guide

## Overview
This guide covers all the warnings from your Supabase dashboard and how to resolve them.

---

## ✅ Fixed Issues

### 1. SessionTimer RLS Performance Issues (FIXED)
**Status:** ✅ Resolved by running `fix_session_timer_rls_performance.sql`

All 4 SessionTimer RLS policies have been optimized to use a helper function that caches `auth.uid()` once per query instead of re-evaluating it for each row.

---

## 🔧 Issues to Fix Now

### 2. Materialized View Security Warning

**Issue:** The `common_timezones` materialized view is accessible via the public API, which is a security concern.

**Impact:** Low security risk (timezone data is not sensitive), but it's a best practice to restrict access.

**Fix:**

#### Option A: Restrict to Authenticated Users Only (Recommended)
Run this in Supabase SQL Editor:

```sql
-- Revoke public access
REVOKE ALL ON public.common_timezones FROM anon;
REVOKE ALL ON public.common_timezones FROM authenticated;

-- Grant SELECT only to authenticated users
GRANT SELECT ON public.common_timezones TO authenticated;
```

#### Option B: Remove API Access Completely
If you don't need this view accessible via the API:

```sql
-- Revoke all API access
REVOKE ALL ON public.common_timezones FROM anon;
REVOKE ALL ON public.common_timezones FROM authenticated;

-- The view will still be usable by database functions
```

#### Option C: Remove the View Entirely (If Not Needed)
If you're not actually using timezone queries frequently:

```sql
DROP MATERIALIZED VIEW IF EXISTS public.common_timezones;
```

**File to Run:** `fix_materialized_view_security.sql` (already created for you)

---

### 3. Leaked Password Protection (CONFIGURATION CHANGE)

**Issue:** Supabase's leaked password protection is disabled. This feature checks user passwords against the "Have I Been Pwned" database of compromised passwords.

**Impact:** Medium security risk - users could potentially use compromised passwords.

**Fix:** This is a configuration setting, not a SQL change.

#### Steps to Enable:

1. **Go to Supabase Dashboard**
2. **Navigate to:** Authentication → Policies (or Authentication → Settings)
3. **Find:** "Password Settings" or "Security Settings" section
4. **Look for:** "Leaked Password Protection" or "Check for compromised passwords"
5. **Toggle:** Turn it ON

#### What This Does:
- ✅ Checks new passwords during signup against HaveIBeenPwned.org
- ✅ Prevents users from using passwords that appear in known data breaches
- ✅ Checks passwords during password reset/change operations
- ✅ Improves overall account security

#### Note:
This is a **dashboard setting only** - it cannot be changed via SQL. You must enable it through the Supabase web interface.

---

## 🚀 Performance Optimizations (Already Applied)

### Database Indexes
**Status:** ✅ Applied via `database_performance_fixes.sql`

The following indexes have been created:
- ✅ Composite indexes for SessionMessage (sessionId + createdAt, senderId + createdAt)
- ✅ Composite indexes for Message (groupId + createdAt, senderId + createdAt)
- ✅ SessionTimer sessionId index
- ✅ SessionParticipant composite indexes
- ✅ Notification unread messages index
- ✅ Partial indexes for soft-deleted records

### Table Statistics
**Status:** ✅ Updated via `database_performance_fixes.sql`

ANALYZE has been run on all major tables to help PostgreSQL make better query plans.

---

## 📊 Critical Performance Issue (Action Required)

### Realtime Performance (95.7% of Database Time)

**Status:** ⚠️ REQUIRES CODE CHANGES

**Issue:** `realtime.list_changes()` is consuming 95.7% of your total database query time.

**Next Steps:**
1. Read `optimize_realtime_performance.md` for detailed guide
2. Follow `PERFORMANCE_ACTION_PLAN.md` for step-by-step actions
3. Review your client code for realtime subscriptions
4. Add filters to limit subscription scope
5. Remove unnecessary tables from realtime publication

**Expected Impact:** 80-90% reduction in database load

---

## Quick Action Checklist

Use this checklist to resolve all issues:

- [x] Fix SessionTimer RLS performance (already done)
- [x] Run database performance indexes (already done)
- [ ] Fix materialized view security warning
  - [ ] Run `fix_materialized_view_security.sql` in Supabase SQL Editor
- [ ] Enable leaked password protection
  - [ ] Go to Supabase Dashboard → Authentication → Settings
  - [ ] Enable "Leaked Password Protection"
- [ ] Optimize realtime performance (HIGH PRIORITY)
  - [ ] Audit realtime publications
  - [ ] Remove unnecessary tables
  - [ ] Add filters to client subscriptions
  - [ ] See `optimize_realtime_performance.md` for details

---

## Files Reference

1. ✅ `fix_session_timer_rls_performance.sql` - SessionTimer RLS optimization
2. ✅ `database_performance_fixes.sql` - Database indexes and optimizations
3. 🆕 `fix_materialized_view_security.sql` - Materialized view security fix
4. 📖 `optimize_realtime_performance.md` - Realtime optimization guide
5. 📖 `PERFORMANCE_ACTION_PLAN.md` - Step-by-step action plan
6. 📖 `SECURITY_FIXES_GUIDE.md` - This document

---

## Verification

After applying all fixes, check the Supabase dashboard:

### Security Tab → Linter
Expected result after fixes:
- ✅ No RLS performance warnings (SessionTimer policies optimized)
- ✅ No materialized view warnings (access restricted)
- ⚠️ Leaked password warning will remain until you enable it in dashboard settings

### Performance Tab → Query Performance
Expected result after optimizations:
- ✅ Reduced query times for indexed queries
- ⏳ Realtime performance improvements (after code changes)

---

## Support

If you encounter any issues:
1. Check the error message carefully
2. Verify column names match your schema
3. Ensure you're running queries in the correct order
4. Check that RLS policies don't conflict with your changes

All SQL scripts use `IF NOT EXISTS` and `IF EXISTS` clauses to be safe to run multiple times.
