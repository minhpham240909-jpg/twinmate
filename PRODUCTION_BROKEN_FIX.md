# 🚨 URGENT: Production App is Broken - Here's the Complete Fix

## What's Happening Right Now

Your production app at **https://clerva-app.vercel.app** is completely broken. All functions fail because the app cannot connect to Supabase.

## Root Cause Identified

The Supabase environment variable names in **Vercel's dashboard** are **WRONG**.

### Current State (BROKEN ❌)

Vercel dashboard currently has:
```
NEXT_PUBLIC_SUPABASE_KEY         ❌ Wrong variable name
SUPABASE_SECRET_KEY              ❌ Wrong variable name
```

### Required State (WORKING ✅)

Vercel needs:
```
NEXT_PUBLIC_SUPABASE_ANON_KEY    ✅ Correct variable name
SUPABASE_SERVICE_ROLE_KEY        ✅ Correct variable name
```

## Why This Breaks Everything

The code in your app expects these exact variable names:

**File:** `src/lib/supabase/client.ts:12`
```typescript
const supabaseKey = sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
//                                               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                               This variable name must match exactly
```

**File:** `src/lib/supabase/server.ts:46`
```typescript
const serviceKey = sanitizeEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY)
//                                            ^^^^^^^^^^^^^^^^^^^^^^^^^
//                                            This variable name must match exactly
```

When these variables are missing or named incorrectly:
- ❌ Supabase client cannot initialize
- ❌ All authentication fails (sign in, sign up, Google OAuth)
- ❌ All database queries fail
- ❌ All API routes return errors
- ❌ Entire app is non-functional

## The Complete Fix (5 minutes)

### Step 1: Open Vercel Dashboard
1. Go to: https://vercel.com/dashboard
2. Click your **clerva-app** project
3. Click **Settings** tab (top navigation)
4. Click **Environment Variables** (left sidebar)

### Step 2: Delete the Wrong Variables

Find and **DELETE** these two variables (click the trash icon):
- ❌ `NEXT_PUBLIC_SUPABASE_KEY`
- ❌ `SUPABASE_SECRET_KEY`

### Step 3: Add the Correct Variables

Click **Add New** button and add each of these:

#### Variable 1: Anon Key (Public)
```
Name:         NEXT_PUBLIC_SUPABASE_ANON_KEY
Value:        <get from your .env.local file - starts with sb_publishable_>
Environments: ✅ Production  ✅ Preview  ✅ Development
```
Click **Save**

#### Variable 2: Service Role Key (Secret)
```
Name:         SUPABASE_SERVICE_ROLE_KEY
Value:        <get from your .env.local file - starts with sb_secret_>
Environments: ✅ Production  ✅ Preview  ✅ Development
```
Click **Save**

### Step 4: Verify Other Required Variables

While you're in the Environment Variables section, make sure these are also set:

```
DATABASE_URL="<your pooled database URL from Supabase>"
NEXT_PUBLIC_SUPABASE_URL="<your Supabase project URL>"
GOOGLE_CLIENT_ID="<your Google OAuth client ID>"
GOOGLE_CLIENT_SECRET="<your Google OAuth client secret>"
NEXT_PUBLIC_AGORA_APP_ID="<your Agora app ID>"
AGORA_APP_CERTIFICATE="<your Agora certificate>"
NEXTAUTH_SECRET="<your NextAuth secret>"
NEXTAUTH_URL="https://clerva-app.vercel.app"
NEXT_PUBLIC_APP_URL="https://clerva-app.vercel.app"
CLEANUP_API_KEY="<your cleanup API key>"
OPENAI_API_KEY="<your OpenAI API key>"
```

**Note:** Get your actual values from your local `.env.local` file.

### Step 5: Trigger Redeployment

After saving the environment variables:

1. Click **Deployments** tab (top navigation)
2. Find the **most recent deployment** (should be at the top)
3. Click the **⋯** (three dots) button on the right
4. Click **Redeploy**
5. **IMPORTANT:** Uncheck "Use existing Build Cache" ❌
6. Click **Redeploy** button

The deployment will take ~2-3 minutes.

### Step 6: Test Production App

Once deployment shows ✅ "Ready":

1. Open: https://clerva-app.vercel.app
2. Try to **sign in** with your account
3. Check if **dashboard loads**
4. Test **sending a message**
5. Test **video calling**

Everything should work perfectly now! ✅

## What I've Already Fixed Locally

I've updated your local development files:
- ✅ `.env.local` - Fixed variable names
- ✅ `.env.vercel.production` - Updated with new keys
- ✅ Both files now use new Supabase stable keys (`sb_publishable_*` and `sb_secret_*`)

Your **local development** should work perfectly now with `npm run dev`.

## Why This Happened

When you rotated the Supabase keys, you also renamed the environment variables incorrectly:
- You used: `NEXT_PUBLIC_SUPABASE_KEY` (missing `_ANON`)
- You used: `SUPABASE_SECRET_KEY` (should be `_SERVICE_ROLE_KEY`)

The code expects the standard Supabase naming convention that we've now restored.

## Verification Checklist

After completing the fix:

- [ ] Deleted `NEXT_PUBLIC_SUPABASE_KEY` from Vercel
- [ ] Deleted `SUPABASE_SECRET_KEY` from Vercel
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY` with new value
- [ ] Added `SUPABASE_SERVICE_ROLE_KEY` with new value
- [ ] Redeployed without build cache
- [ ] Production app loads successfully
- [ ] Sign in works
- [ ] Database queries work
- [ ] All features functional

---

**Time to complete:** 5 minutes
**Impact:** Fixes entire production deployment
**Status:** Waiting for you to update Vercel dashboard variables
