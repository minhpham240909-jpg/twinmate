# 🚀 Vercel Deployment Fix - Step by Step

## Your Current Situation
- ✅ App deployed to Vercel successfully
- ✅ UI/UX displays correctly
- ❌ All backend functions return "Internal server error"

## Why This Happens
Vercel deployed your frontend successfully, but your API routes can't connect to the database because the environment variables are missing.

---

## ⚡ Quick Fix (15 minutes total)

### **Step 1: Add Environment Variables in Vercel** (5 minutes)

1. **Go to your Vercel project dashboard**
   - Visit: https://vercel.com/dashboard
   - Click on your `clerva-app` project

2. **Navigate to Settings → Environment Variables**
   - Click "Settings" tab at the top
   - Click "Environment Variables" in the left sidebar

3. **Add these 4 variables ONE BY ONE:**

   **Variable 1:**
   ```
   Name: DATABASE_URL
   Value: postgresql://postgres.zuukijevgtcfsgylbsqj:Eminh2342009!!@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&pool_timeout=10
   Environment: Production, Preview, Development (select all 3)
   ```

   **Variable 2:**
   ```
   Name: NEXT_PUBLIC_SUPABASE_URL
   Value: https://zuukijevgtcfsgylbsqj.supabase.co
   Environment: Production, Preview, Development (select all 3)
   ```

   **Variable 3:**
   ```
   Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1dWtpamV2Z3RjZnNneWxic3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDE3MDgsImV4cCI6MjA3NDc3NzcwOH0.AZDiolkpmLvQFPxYBjdfA0E6QNsQeuoNw471uUVVXGU
   Environment: Production, Preview, Development (select all 3)
   ```

   **Variable 4:**
   ```
   Name: SUPABASE_SERVICE_ROLE_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1dWtpamV2Z3RjZnNneWxic3FqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIwMTcwOCwiZXhwIjoyMDc0Nzc3NzA4fQ.VNXNMCBCAJ8Oae6_-O6W85FyhjWPm9aSR4HgoOMWoP4
   Environment: Production, Preview, Development (select all 3)
   ```

4. **Click "Save" after adding each variable**

5. **Important**: Make sure to select **all three environments** (Production, Preview, Development) for each variable!

---

### **Step 2: Disable RLS in Supabase Database** (2 minutes)

This is **CRITICAL** - without this, even with correct environment variables, all database queries will fail.

1. **Open Supabase SQL Editor:**
   - Go to: https://app.supabase.com/project/zuukijevgtcfsgylbsqj/sql

2. **Click "New Query"**

3. **Copy and paste this entire SQL script:**

```sql
-- Disable Row Level Security (RLS) for Prisma Direct Database Access
-- This is necessary because we're using Prisma to access PostgreSQL directly,
-- bypassing Supabase's API. Supabase enables RLS by default on all tables,
-- which blocks Prisma queries unless we disable it or create policies.
--
-- Since we're handling authorization in our Next.js API routes (server-side),
-- we can safely disable RLS and rely on application-level security.

-- Disable RLS on all application tables
ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Match" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Group" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMember" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Badge" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBadge" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionParticipant" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionGoal" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionMessage" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationArchive" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionTimer" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupInvite" DISABLE ROW LEVEL SECURITY;

-- Note: We keep RLS enabled on storage.objects (managed by Supabase Storage)
-- because file uploads go through Supabase Storage API, not Prisma

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT LIKE '_prisma%'
ORDER BY tablename;
```

4. **Click "Run" button or press `Cmd + Enter` (Mac) or `Ctrl + Enter` (Windows)**

5. **Check the results:**
   - You should see a table listing all your database tables
   - The `rowsecurity` column should show `false` for all tables
   - If any show `true`, the script didn't work - try running it again

---

### **Step 3: Redeploy Your App in Vercel** (5 minutes)

Now that environment variables are set, you need to trigger a new deployment:

**Option A: Automatic Redeploy (Recommended)**
1. Go to your Vercel project dashboard
2. Click on "Deployments" tab
3. Click on the latest deployment
4. Click the "..." menu (three dots) in the top right
5. Click "Redeploy"
6. Make sure "Use existing Build Cache" is **UNCHECKED**
7. Click "Redeploy"

**Option B: Push a New Commit**
```bash
cd "/Users/minhpham/Documents/minh project.html/clerva-app"

# Make a small change (trigger rebuild)
git commit --allow-empty -m "Trigger rebuild with environment variables"

# Push to trigger Vercel deployment
git push
```

**Wait 3-5 minutes** for the deployment to complete.

---

### **Step 4: Test Your Deployment** (3 minutes)

Once deployment is complete:

1. **Visit your Vercel deployment URL**
   - Should be something like: `https://clerva-app.vercel.app` or your custom domain

2. **Open browser DevTools** (Press F12)
   - Go to the "Console" tab
   - Keep it open while testing

3. **Test these features:**

   ✅ **Test 1: Homepage Loads**
   - Navigate to your app
   - Should see the UI without errors

   ✅ **Test 2: Try to Sign Up**
   - Go to sign up page
   - Try creating a new account
   - If it works → Success! ✅
   - If it shows error → Check console for error messages

   ✅ **Test 3: Check API Routes**
   - Open: `https://your-app.vercel.app/api/auth/google`
   - Should see a redirect or JSON response
   - Should NOT see "Internal server error"

4. **Check Vercel Logs:**
   - Go to Vercel dashboard → Your project → Deployments
   - Click on the latest deployment
   - Click "Functions" tab
   - Click on any failed function to see error logs

---

## ✅ Success Indicators

You'll know it's working when:

1. ✅ No "Internal server error" messages
2. ✅ You can create a new account (sign up works)
3. ✅ You can sign in
4. ✅ API routes return proper responses
5. ✅ No database connection errors in Vercel logs
6. ✅ No "permission denied" errors in logs

---

## 🔍 Troubleshooting

### Problem: Still getting "Internal server error" after redeploying

**Check this:**

1. **Verify environment variables are actually set:**
   - Vercel Dashboard → Settings → Environment Variables
   - You should see all 4 variables listed
   - Each should have checkmarks for Production, Preview, Development

2. **Check Vercel Function Logs:**
   - Vercel Dashboard → Deployments → Latest → Functions
   - Look for error messages like:
     - "Failed to connect to database" → DATABASE_URL is wrong
     - "permission denied for table" → RLS is still enabled
     - "Invalid API key" → Supabase keys are wrong

3. **Common error messages and fixes:**

   **Error: "connect ECONNREFUSED 127.0.0.1:5432"**
   - **Meaning**: DATABASE_URL is wrong or not set
   - **Fix**: Double-check DATABASE_URL in Vercel settings

   **Error: "permission denied for table User"**
   - **Meaning**: RLS is still enabled in Supabase
   - **Fix**: Run the SQL script again in Supabase SQL Editor

   **Error: "Invalid JWT"**
   - **Meaning**: Supabase keys are incorrect
   - **Fix**: Copy fresh keys from Supabase dashboard

   **Error: "Cannot find module '@prisma/client'"**
   - **Meaning**: Prisma wasn't generated during build
   - **Fix**: Redeploy with "Use existing Build Cache" unchecked

### Problem: Environment variables don't seem to be working

**Solution:**
1. After adding environment variables, you MUST redeploy
2. Make sure "Use existing Build Cache" is UNCHECKED when redeploying
3. Environment variables starting with `NEXT_PUBLIC_` are exposed to the browser
4. Other variables are only available on the server-side

### Problem: RLS script fails with "relation does not exist"

**Solution:**
This means some tables haven't been created yet. You need to run Prisma migrations:

```bash
cd "/Users/minhpham/Documents/minh project.html/clerva-app"

# Push Prisma schema to database
npx prisma db push

# Then run the RLS script again in Supabase
```

---

## 📊 Vercel-Specific Tips

### Monitor Your Deployment
- **Real-time logs**: Vercel Dashboard → Functions → Click on a function → See logs
- **Build logs**: Vercel Dashboard → Deployments → Click deployment → See build output
- **Analytics**: Vercel Dashboard → Analytics (if enabled)

### Environment Variables Best Practices
- Use different values for Preview vs Production if needed
- Keep sensitive keys (SERVICE_ROLE_KEY) secret - never log them
- Variables with `NEXT_PUBLIC_` prefix are exposed to browser (public)
- Other variables are server-side only (private)

### Automatic Deployments
- Vercel auto-deploys when you push to main branch
- Preview deployments for pull requests
- Each deployment has a unique URL for testing

---

## 🎯 Expected Timeline

- **Add environment variables**: 5 minutes
- **Run SQL script**: 2 minutes
- **Redeploy**: 3-5 minutes (automatic)
- **Test**: 3 minutes
- **Total**: ~15 minutes

---

## 📞 Need More Help?

If you're still seeing errors after following all steps:

1. **Share with me:**
   - Your Vercel deployment URL
   - Error message from browser console (F12 → Console)
   - Error from Vercel Functions logs
   - Screenshot of your Environment Variables page

2. **Quick diagnostic command:**
   ```bash
   # Test if your deployed API works
   curl https://your-app.vercel.app/api/auth/google
   
   # Should return a redirect, not "Internal server error"
   ```

---

## ✅ Checklist

Use this to make sure you did everything:

- [ ] Added `DATABASE_URL` in Vercel Environment Variables
- [ ] Added `NEXT_PUBLIC_SUPABASE_URL` in Vercel Environment Variables
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel Environment Variables
- [ ] Added `SUPABASE_SERVICE_ROLE_KEY` in Vercel Environment Variables
- [ ] All 4 variables have all 3 environments checked (Production, Preview, Development)
- [ ] Ran the RLS disable SQL script in Supabase SQL Editor
- [ ] Verified RLS is disabled (rowsecurity = false for all tables)
- [ ] Triggered a new deployment in Vercel (without build cache)
- [ ] Waited for deployment to complete (3-5 minutes)
- [ ] Tested sign up/sign in functionality
- [ ] No "Internal server error" messages
- [ ] Checked Vercel Functions logs for any errors

---

**You're almost there!** Follow these steps and your app should be fully functional in about 15 minutes. 🚀

