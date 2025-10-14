# 🔐 Google OAuth Setup Guide

## ✅ What's Already Fixed

Your Google OAuth code is ready! I've updated:
- ✅ [src/app/api/auth/google/route.ts](src/app/api/auth/google/route.ts) - Uses dynamic redirect URL
- ✅ [src/app/auth/callback/route.ts](src/app/auth/callback/route.ts) - Handles OAuth callback
- ✅ No code changes needed!

**Current Status:** Code works, but needs Google Cloud Console + Supabase configuration (5 minutes)

---

## 🚀 Setup Steps (Do This Once)

### Step 1: Get Supabase Redirect URL

1. Go to https://app.supabase.com
2. Open your project: **zuukijevgtcfsgylbsqj**
3. Click **Authentication** → **Providers**
4. Scroll to **Google** provider
5. Copy the **Callback URL** (should be):
   ```
   https://zuukijevgtcfsgylbsqj.supabase.co/auth/v1/callback
   ```
6. **Keep this tab open** - we'll need it in Step 3

### Step 2: Create Google OAuth Credentials

1. Go to https://console.cloud.google.com
2. Click **Select a project** → **NEW PROJECT**
3. Name it: `Clerva App` → Click **CREATE**
4. Wait 30 seconds → Select your new project
5. In the search bar, type: `OAuth consent screen`
6. Click **OAuth consent screen**

#### Configure OAuth Consent Screen:

7. Select **External** → Click **CREATE**
8. Fill in:
   - **App name**: `Clerva`
   - **User support email**: Your email
   - **Developer contact email**: Your email
9. Click **SAVE AND CONTINUE**
10. Skip "Scopes" → Click **SAVE AND CONTINUE**
11. Skip "Test users" → Click **SAVE AND CONTINUE**
12. Click **BACK TO DASHBOARD**

#### Create OAuth Client ID:

13. In the search bar, type: `Credentials`
14. Click **Credentials** (key icon)
15. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
16. Application type: **Web application**
17. Name: `Clerva Web App`
18. Under **Authorized redirect URIs**:
    - Click **+ ADD URI**
    - Paste your Supabase callback URL from Step 1:
      ```
      https://zuukijevgtcfsgylbsqj.supabase.co/auth/v1/callback
      ```
    - Click **+ ADD URI** again
    - Add local development:
      ```
      http://localhost:3000/auth/callback
      ```
19. Click **CREATE**
20. **IMPORTANT:** Copy the **Client ID** and **Client Secret** that appear

### Step 3: Add to Supabase

1. Go back to Supabase → **Authentication** → **Providers** → **Google**
2. Toggle **Enable** to ON
3. Paste:
   - **Client ID**: From Step 2
   - **Client Secret**: From Step 2
4. Click **Save**

### Step 4: Add to Environment Variables (Optional)

If you want to store them locally (not required for Supabase auth):

1. Open `.env.local`
2. Add:
   ```bash
   GOOGLE_CLIENT_ID="your-client-id-from-step-2"
   GOOGLE_CLIENT_SECRET="your-client-secret-from-step-2"
   ```

---

## 🧪 Test Google OAuth

1. **Start your dev server** (should already be running at http://localhost:3000)
2. Go to http://localhost:3000/auth/signup or http://localhost:3000/auth/signin
3. Click the **Google** button
4. Select your Google account
5. You'll be redirected to `/dashboard` after successful login!

**Expected Flow:**
```
Click Google button
  → Redirect to Google login
  → Grant permission
  → Redirect to Supabase callback
  → Redirect to /dashboard
  → ✅ Logged in!
```

---

## ❌ Troubleshooting

### Error: "redirect_uri_mismatch"

**Cause:** Google redirect URI doesn't match Supabase callback URL

**Fix:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Click your OAuth client ID
3. Under **Authorized redirect URIs**, verify you have:
   - `https://zuukijevgtcfsgylbsqj.supabase.co/auth/v1/callback`
4. Make sure there are NO typos or extra spaces
5. Click **SAVE**
6. Wait 5 minutes for Google to propagate changes
7. Try again

### Error: "Access blocked: This app's request is invalid"

**Cause:** OAuth consent screen not configured

**Fix:**
1. Go to https://console.cloud.google.com/apis/credentials/consent
2. Complete the OAuth consent screen setup (Step 2 above)
3. Make sure status is **In production** or **Testing**

### Error: "Invalid client"

**Cause:** Client ID or Secret incorrect in Supabase

**Fix:**
1. Go to Supabase → **Authentication** → **Providers** → **Google**
2. Re-paste Client ID and Client Secret from Google Console
3. Click **Save**

---

## 🎯 What Happens When User Signs In with Google?

1. User clicks "Continue with Google" button
2. App redirects to Google login
3. User grants permission
4. Google redirects to Supabase: `https://zuukijevgtcfsgylbsqj.supabase.co/auth/v1/callback?code=...`
5. Supabase validates and creates session
6. Supabase redirects to your app: `http://localhost:3000/auth/callback?code=...`
7. Your app (`src/app/auth/callback/route.ts`):
   - Exchanges code for session
   - Creates User in database (if new)
   - Creates Profile
   - Redirects to `/dashboard` or `/onboarding`
8. ✅ User is logged in!

---

## 📊 Database Impact

When a user signs in with Google for the first time:

**Supabase Auth Table:**
- New row in `auth.users` with Google provider info

**Your Database:**
- New row in `User` table with:
  ```
  - id: from Google
  - email: from Google
  - name: from Google profile
  - avatarUrl: from Google profile picture
  - googleId: Google user ID
  - role: 'FREE'
  - emailVerified: true
  ```
- New row in `Profile` table (empty, ready for completion)

No mock data - all real users in your real database!

---

## ✅ Checklist

Before testing, verify:

- [ ] Created Google Cloud project
- [ ] Configured OAuth consent screen
- [ ] Created OAuth client ID
- [ ] Added Supabase callback URL to Google Console
- [ ] Enabled Google provider in Supabase
- [ ] Added Client ID & Secret to Supabase
- [ ] Dev server is running (http://localhost:3000)
- [ ] Tested clicking "Google" button on signup/signin page

---

## 🎉 Success!

Once configured, Google OAuth will:
- ✅ Work in development (localhost:3000)
- ✅ Work in production (after adding production URL to Google Console)
- ✅ Save real users to your Supabase database
- ✅ No mock data involved!

Need help? The error messages in your browser console will tell you exactly what's wrong!