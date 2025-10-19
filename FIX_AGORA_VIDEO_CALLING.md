# 🎥 FIX: Agora Video Calling - Invalid Token Error

## The Problem

Video calling fails with error:
```
AgoraRTCError CAN_NOT_GET_GATEWAY_SERVER: invalid token, authorized failed
```

## Root Cause

The **Agora APP_ID** in production doesn't match the **AGORA_APP_CERTIFICATE**.

**Current Production (WRONG):**
- APP_ID: `7f4b5118f4...` (old project)
- CERTIFICATE: `04847f385aa847478bda7fc5f2aad994` (new project)
- ❌ These don't match - token generation fails

**Correct Values (from your .env.local):**
- APP_ID: `9a77e8e5ea014045b383f519231d58e4`
- CERTIFICATE: `04847f385aa847478bda7fc5f2aad994`
- ✅ These match - tokens will work

## The Fix (1 minute)

### Update NEXT_PUBLIC_AGORA_APP_ID in Vercel

1. Go to: https://vercel.com/dashboard
2. Open **clerva-app** → Settings → Environment Variables
3. Find `NEXT_PUBLIC_AGORA_APP_ID` and click **Edit**
4. Replace the value with:
   ```
   9a77e8e5ea014045b383f519231d58e4
   ```
5. Make sure it's checked for: Production ✅, Preview ✅, Development ✅
6. Click **Save**

### Verify AGORA_APP_CERTIFICATE

While you're there, make sure `AGORA_APP_CERTIFICATE` is set to:
```
04847f385aa847478bda7fc5f2aad994
```

(It should already be correct, but double-check)

### Redeploy

1. Go to **Deployments** tab
2. Click **⋯** on latest deployment → **Redeploy**
3. **UNCHECK** "Use existing Build Cache" ❌
4. Click **Redeploy**

## Test After Deployment

1. Open: https://clerva-app.vercel.app
2. Sign in
3. Go to Messages or Study Sessions
4. Start a video call
5. Video calling should work perfectly! ✅

## Why This Happens

Agora tokens are cryptographically signed with the APP_CERTIFICATE. The token must be generated using:
- The correct APP_ID (identifies your Agora project)
- The matching APP_CERTIFICATE (secret key for that project)

If these don't match, Agora rejects the token as invalid.

---

**Time to fix:** 1 minute
**Impact:** Fixes all video calling functionality
