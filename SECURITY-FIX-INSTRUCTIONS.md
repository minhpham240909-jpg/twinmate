# 🔐 CRITICAL: Security Fix Instructions
## Remove Exposed Secrets & Rotate Keys

**⚠️ ACTION REQUIRED BEFORE DEPLOYING TO PRODUCTION**

---

## Step 1: Remove Secrets from Git History

Run these commands in your terminal:

```bash
# Navigate to project root
cd /Users/minhpham/Documents/minh\ project.html/clerva-app

# Remove .env files from git tracking (keeps local files)
git rm --cached .env
git rm --cached .env.local
git rm --cached .env.production
git rm --cached .env.vercel
git rm --cached .env.vercel.production

# Commit the removal
git commit -m "security: remove exposed environment files from git"

# Push to remote
git push origin main
```

**Note:** This removes files from git but keeps them on your local machine.

---

## Step 2: Rotate ALL API Keys (CRITICAL)

All keys in the committed `.env` files are now considered **COMPROMISED**. You must rotate them:

### 2.1 Supabase Keys
1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
2. Click "Reset Service Role Key" (⚠️ this is the most critical one)
3. Copy new `SUPABASE_SERVICE_ROLE_KEY`
4. Update in Vercel dashboard ONLY (never commit)

**Public keys are OK to expose:**
- `NEXT_PUBLIC_SUPABASE_URL` (safe to commit)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe to commit, designed for client-side)

### 2.2 OpenAI API Key
1. Go to: https://platform.openai.com/api-keys
2. Delete old key: `sk-proj-...` (from your .env file)
3. Create new key with descriptive name: "Clerva Production"
4. Copy new key
5. Update in Vercel dashboard

### 2.3 Google OAuth Credentials
1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID
3. Click "Edit" → "Reset Secret"
4. Copy new `GOOGLE_CLIENT_SECRET`
5. Update in Vercel dashboard

**Client ID is safe:**
- `GOOGLE_CLIENT_ID` (safe to commit)

### 2.4 Agora Credentials
1. Go to: https://console.agora.io/
2. Navigate to Project Management
3. Generate new App Certificate
4. Copy new `AGORA_APP_CERTIFICATE`
5. Update in Vercel dashboard

**App ID is safe:**
- `NEXT_PUBLIC_AGORA_APP_ID` (safe to commit)

### 2.5 NEXTAUTH_SECRET
Generate a new secret:

```bash
openssl rand -base64 32
```

Copy output and update in Vercel dashboard.

### 2.6 Database Credentials
If your database password was exposed (it was in `.env.vercel.production`):

1. Go to Supabase Dashboard → Database → Settings
2. Reset database password
3. Update connection string in Vercel
4. Update `DATABASE_URL` and `DIRECT_URL`

### 2.7 Stripe Keys (if configured)
1. Go to: https://dashboard.stripe.com/apikeys
2. Roll secret key
3. Update `STRIPE_SECRET_KEY` in Vercel
4. Regenerate webhook secret if needed

---

## Step 3: Configure Secrets in Vercel Dashboard ONLY

1. Go to: https://vercel.com/YOUR_USERNAME/clerva-app/settings/environment-variables

2. Add these secrets (use NEW rotated keys):

```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
SUPABASE_SERVICE_ROLE_KEY=eyJ... (NEW KEY)
NEXTAUTH_SECRET=... (NEW SECRET)
OPENAI_API_KEY=sk-... (NEW KEY)
GOOGLE_CLIENT_SECRET=GOCSPX-... (NEW SECRET)
AGORA_APP_CERTIFICATE=... (NEW CERTIFICATE)
STRIPE_SECRET_KEY=sk_live_... (NEW KEY if applicable)
STRIPE_WEBHOOK_SECRET=whsec_... (regenerate if needed)
```

3. For each variable:
   - Select Environment: **Production**, **Preview**, **Development**
   - Click "Save"

4. Public variables (safe to commit to .env.local):
```
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_AGORA_APP_ID=...
NEXT_PUBLIC_APP_URL=https://clerva.vercel.app
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=... (if used)
NODE_ENV=production
```

---

## Step 4: Update Local .env.local

Create a NEW `.env.local` with rotated keys (for local development):

```bash
# Copy from example
cp .env.example .env.local

# Edit with new keys
nano .env.local  # or use your editor
```

**NEVER commit `.env.local` - it's already in .gitignore**

---

## Step 5: Verify Secrets are Removed from Git

```bash
# Check git status (should show .env files as untracked)
git status

# Verify no env files are tracked
git ls-files | grep .env

# Should return nothing (except .env.example which is safe)
```

---

## Step 6: Test Locally with New Keys

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Test:
# 1. Sign in with email/password
# 2. Sign in with Google OAuth
# 3. Create a study session
# 4. Send a message
# 5. Upload an avatar
```

If everything works, you're ready for production deployment!

---

## Step 7: Deploy to Vercel

```bash
# Push latest changes
git push origin main

# Vercel will auto-deploy
# Monitor: https://vercel.com/YOUR_USERNAME/clerva-app/deployments
```

---

## ✅ Security Checklist

- [ ] All .env files removed from git
- [ ] Supabase service role key rotated
- [ ] OpenAI API key rotated
- [ ] Google OAuth secret rotated
- [ ] Agora certificate rotated
- [ ] NEXTAUTH_SECRET regenerated
- [ ] Database password rotated (if exposed)
- [ ] All secrets added to Vercel dashboard
- [ ] Local .env.local updated
- [ ] Tested locally with new keys
- [ ] Deployed to Vercel
- [ ] Verified production deployment works

---

## 🚨 What If Keys Were Already Compromised?

If you see unusual activity:

1. **Database Access:**
   - Check Supabase logs for unauthorized queries
   - Review user creation/deletion activity
   - Check for data exfiltration

2. **OpenAI Usage:**
   - Check usage dashboard for unexpected API calls
   - Monitor billing for spikes

3. **OAuth:**
   - Review authorized apps in Google Console
   - Check for unauthorized sign-ins

4. **Immediate Actions:**
   - Rotate keys immediately (as above)
   - Enable 2FA on all services
   - Review access logs
   - Consider security audit

---

## Prevention for Future

**NEVER commit these to git:**
- ❌ `.env`
- ❌ `.env.local`
- ❌ `.env.production`
- ❌ `.env.vercel`
- ❌ Any file with "SECRET", "KEY", "PASSWORD"

**Safe to commit:**
- ✅ `.env.example` (template with no real values)
- ✅ `NEXT_PUBLIC_*` variables (designed for client-side)

**Best Practice:**
1. Use Vercel dashboard for all secrets
2. Use environment-specific variables
3. Never hardcode secrets in code
4. Use secret scanning tools (GitHub has built-in scanning)

---

**Status:** 🔴 INCOMPLETE - Complete all steps above before deploying to production
