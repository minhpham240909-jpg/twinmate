# RLS Policy Verification Guide

## Overview
This guide will help you verify that all Row-Level Security (RLS) policies are correctly applied in your Supabase database.

## Step 1: Apply RLS Performance Optimizations

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to: **SQL Editor**
3. Create a new query
4. Copy the contents of `fix_rls_performance_v3_final.sql`
5. Click **Run** to execute
6. ✅ Expected result: "Success. No rows returned"

## Step 2: Fix Duplicate Policies

1. In the same SQL Editor
2. Create a new query
3. Copy the contents of `fix_duplicate_policies_v2_final.sql`
4. Click **Run** to execute
5. ✅ Expected result: "Success. No rows returned"

## Step 3: Verify All Policies Are Active

Run this verification query in the SQL Editor:

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
```

### Expected Tables with Policies:
- ✅ User (2-3 policies)
- ✅ Profile (3-4 policies)
- ✅ Match (4-6 policies)
- ✅ Message (4-6 policies)
- ✅ Notification (3-4 policies)
- ✅ Group (4-6 policies)
- ✅ GroupMember (4-6 policies)
- ✅ GroupInvite (4-6 policies)
- ✅ StudySession (4-6 policies)
- ✅ SessionParticipant (4-6 policies)
- ✅ SessionInvite (3-4 policies)
- ✅ SessionGoal (3-4 policies)

## Step 4: Run Database Linter

1. In Supabase Dashboard, go to: **Database** → **Linter**
2. Click **Refresh**
3. ✅ Expected result: **0 warnings** (previously had 54 warnings)

### Previous Warnings (Should All Be Gone):
- ❌ 26 `auth_rls_initplan` warnings → ✅ Fixed with `(SELECT auth.uid())::text` pattern
- ❌ 28 `multiple_permissive_policies` warnings → ✅ Fixed by consolidating duplicate policies

## Step 5: Test RLS in Production

Run these test queries to ensure policies work correctly:

### Test 1: Verify auth.uid() optimization
```sql
-- This should use the optimized pattern
EXPLAIN ANALYZE
SELECT * FROM "User"
WHERE id = (SELECT auth.uid())::text;
```
✅ Expected: Query plan shows efficient execution (not using "InitPlan")

### Test 2: Verify policy consolidation
```sql
-- Check for duplicate SELECT policies
SELECT tablename, COUNT(*) as select_policies
FROM pg_policies
WHERE schemaname = 'public' AND cmd = 'SELECT'
GROUP BY tablename
HAVING COUNT(*) > 1
ORDER BY tablename;
```
✅ Expected: **0 rows** (no duplicate SELECT policies)

### Test 3: Verify INCOMING_CALL enum
```sql
SELECT enumlabel
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'NotificationType'
ORDER BY enumlabel;
```
✅ Expected: Should include 'INCOMING_CALL' in the list

## Troubleshooting

### If you see errors about type casting:
- Make sure you're using the **v3_final** version of the RLS performance script
- The script includes `::text` casting to convert UUID to text

### If you see errors about column "createdBy":
- Make sure you're using the **v3_final** version which uses `ownerId` for Group table
- Other tables use `createdBy`

### If you still see duplicate policy warnings:
- Make sure you're using the **v2_final** version of the duplicate policies script
- This version splits `FOR ALL` into separate `INSERT/UPDATE/DELETE` policies

## Verification Checklist

After completing all steps, verify:

- [ ] Both SQL scripts executed successfully
- [ ] Database Linter shows 0 warnings
- [ ] All 12+ tables have RLS policies
- [ ] No duplicate SELECT policies exist
- [ ] INCOMING_CALL enum value exists
- [ ] Test queries execute efficiently

## Impact on System Design

**+1 point** - RLS policies verified and optimized in production

---

## Next Steps

Once RLS verification is complete, proceed to **Fix #3: Add Sentry Error Monitoring**
