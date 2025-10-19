# 🎯 SIMPLE FIX: Update ONE Variable in Vercel (1 minute)

## The Problem
Production app shows internal errors because the database connection URL is wrong.

## The Fix (1 minute)

### Step 1: Go to Vercel
1. Open: https://vercel.com/dashboard
2. Click your **clerva-app** project
3. Click **Settings** tab
4. Click **Environment Variables** (left sidebar)

### Step 2: Update DATABASE_URL
1. Find `DATABASE_URL` in the list
2. Click the **Edit** button (pencil icon)
3. Replace the ENTIRE value with this exact URL from your `.env.local` file:

```
postgresql://postgres.zuukijevgtcfsgylbsqj:Quwsoq-petcyx-0qyjki@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true
```

4. Make sure it's checked for: Production ✅, Preview ✅, Development ✅
5. Click **Save**

### Step 3: Redeploy
1. Go to **Deployments** tab
2. Click the **⋯** menu on the latest deployment
3. Click **Redeploy**
4. **UNCHECK** "Use existing Build Cache" ❌
5. Click **Redeploy** button

## That's It!

Wait ~2 minutes for deployment to complete. Then test:
- Visit: https://clerva-app.vercel.app
- Sign in should work ✅
- All features should work ✅

---

**What changed:**
- OLD: `db.zuukijevgtcfsgylbsqj.supabase.co:5432` (direct connection, limit 15)
- NEW: `aws-1-us-east-2.pooler.supabase.com:6543` (pooled connection, limit 200+)

This fixes all database connection errors! 🎉
