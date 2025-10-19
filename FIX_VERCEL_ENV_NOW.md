# 🚨 URGENT: Fix Vercel Environment Variables

## Problem
Your production deployment is broken because Vercel has the **WRONG** Supabase environment variable names.

## What's Wrong

**Current Variables in Vercel (WRONG):**
```
NEXT_PUBLIC_SUPABASE_KEY          ❌ Wrong name
SUPABASE_SECRET_KEY               ❌ Wrong name
```

**Should Be:**
```
NEXT_PUBLIC_SUPABASE_ANON_KEY     ✅ Correct
SUPABASE_SERVICE_ROLE_KEY         ✅ Correct
```

## Step-by-Step Fix (2 minutes)

### 1. Go to Vercel Dashboard
1. Open: https://vercel.com/dashboard
2. Click on your **clerva-app** project
3. Click **Settings** tab
4. Click **Environment Variables** in left sidebar

### 2. Delete Wrong Variables
Find and **DELETE** these two variables:
- ❌ `NEXT_PUBLIC_SUPABASE_KEY`
- ❌ `SUPABASE_SECRET_KEY`

### 3. Add Correct Variables
Click **Add New** for each of these:

**Variable 1:**
```
Name:  NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: sb_publishable_C4lumPKfitPQEFObaZzUYg_ZHn72dEI
Environments: ✅ Production ✅ Preview ✅ Development
```

**Variable 2:**
```
Name:  SUPABASE_SERVICE_ROLE_KEY
Value: sb_secret_roUABHSkxg-JErvIChLcWQ_a23Tyd5B
Environments: ✅ Production ✅ Preview ✅ Development
```

### 4. Redeploy
After saving the variables:
1. Go to **Deployments** tab
2. Find the latest deployment
3. Click the **⋯** (three dots) menu
4. Click **Redeploy**
5. Check **Use existing Build Cache** ❌ (uncheck this)
6. Click **Redeploy**

## Why This Broke Everything

The code expects these exact variable names:
- `src/lib/supabase/client.ts:12` → `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `src/lib/supabase/server.ts:46` → `process.env.SUPABASE_SERVICE_ROLE_KEY`

Without the correct names, the app can't connect to Supabase, so:
- ❌ Authentication fails
- ❌ Database queries fail
- ❌ All features broken

## Verification

After redeployment completes (~2 mins):
1. Visit your production URL
2. Try to sign in
3. Try to load dashboard
4. All features should work now ✅

---

**Time to fix: 2 minutes**
**Impact: Fixes entire production deployment**
