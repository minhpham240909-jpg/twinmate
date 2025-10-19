# 🚨 APPLY RLS SECURITY NOW - Step-by-Step Instructions

## What This Does
Enables Row Level Security on your database to prevent unauthorized direct access.

## ⏱️ Time Required: 2 minutes

---

## Step 1: Open Supabase SQL Editor

1. Go to: https://app.supabase.com/project/zuukijevgtcfsgylbsqj/sql
2. You should see the SQL Editor interface

---

## Step 2: Copy the SQL Script

1. Open the file `enable_rls_security.sql` in this project
2. Copy ALL the contents (Ctrl+A, Ctrl+C)

---

## Step 3: Run the SQL Script

1. In the Supabase SQL Editor, paste the copied SQL
2. Click the green **"Run"** button (or press Ctrl+Enter)
3. Wait for it to complete (should take ~2 seconds)

---

## Step 4: Verify RLS is Enabled

You should see a table at the bottom of the results showing:

```
tablename       | rowsecurity
----------------|------------
User            | t
Profile         | t
Message         | t
Match           | t
Notification    | t
StudySession    | t
SessionMessage  | t
```

**`t` = true** means RLS is enabled ✅

---

## Step 5: Test Your App

1. Go to your deployed app: https://clerva-fkrd2i27o-minh-phams-projects-2df8ca7e.vercel.app
2. Try these features:
   - ✅ Sign in
   - ✅ View your profile
   - ✅ Send a message
   - ✅ Create a study session

**If everything works, you're done!** ✅

---

## ⚠️ If You See Errors

### Error: "Permission denied for table User"

**Fix:**
1. Go back to Supabase SQL Editor
2. Run this query to verify service_role policies:
```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('User', 'Profile', 'Message');
```

3. You should see policies named "Allow service role full access to..."
4. If not, re-run the `enable_rls_security.sql` script

### Error: "Failed to connect to database"

**This is normal during deployment.** Wait 30 seconds and try again.

---

## 🎉 Success!

Once RLS is enabled and your app works:

✅ Your database is protected from unauthorized direct access
✅ API routes continue working normally (they use service_role)
✅ Direct psql/SQL access is blocked without proper authentication
✅ Defense-in-depth security is now active

---

## 📋 Next Steps (Optional but Recommended)

See `SECURITY-HARDENING-GUIDE.md` for:
- Rotating other exposed API keys
- Changing your database password
- Security best practices
- Maintenance schedule

---

## 🆘 Need Help?

If you encounter any issues:
1. Check the error message carefully
2. Look in Supabase Logs: https://app.supabase.com/project/zuukijevgtcfsgylbsqj/logs/explorer
3. Verify all environment variables are set in Vercel
4. Try the app locally first (`npm run dev`)

**Important:** Don't disable RLS to "fix" errors. The errors mean something else needs fixing (usually environment variables).

---

Last Updated: 2025-01-15
