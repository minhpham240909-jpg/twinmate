# 🚀 Clerva App Deployment Guide

## Overview: Testing → Production Workflow

This guide will help you deploy Clerva through two stages:
1. **Staging/Testing Environment** - Test your app with real infrastructure
2. **Production Environment** - Deploy for real users

---

## 📋 Pre-Deployment Checklist

### ✅ Current Status
- [x] App builds successfully (`npm run build` works)
- [x] Git repository initialized
- [x] Supabase configured and connected
- [x] Database schema deployed (Prisma)
- [x] Local development working

### ⚠️ Warnings to Fix (Optional, Non-blocking)
Your build has 36 warnings but they won't prevent deployment:
- Unused variables (cosmetic)
- `<img>` tags (can optimize later with `next/image`)
- React Hook dependencies (won't affect functionality)

**Decision**: Deploy now and fix warnings later, or fix warnings first.

---

## 🎯 Deployment Options

Since you're using **Supabase + Google Cloud** (not Vercel), here are your best options:

### Option 1: Google Cloud Run (Recommended for You)
**Best for**: Serverless, automatic scaling, pay-per-use
- ✅ Integrates with Google Cloud Platform
- ✅ Automatic HTTPS
- ✅ Easy staging/production separation
- ✅ Works perfectly with Supabase
- 💰 Free tier: 2 million requests/month

### Option 2: Google Cloud App Engine
**Best for**: Traditional hosting, more control
- ✅ Managed platform
- ✅ Built-in versioning (perfect for staging/prod)
- ✅ Custom domains
- 💰 Free tier available

### Option 3: Railway.app
**Best for**: Fastest deployment, developer-friendly
- ✅ One-click deploy from Git
- ✅ Automatic preview environments
- ✅ Built-in database support
- 💰 Free $5/month credit

---

## 🚂 RECOMMENDED: Deploy with Railway (Fastest)

Railway is the easiest way to deploy Next.js + Supabase apps.

### Step 1: Prepare Your Repository

```bash
cd "/Users/minhpham/Documents/minh project.html/clerva-app"

# Commit all your work
git add .
git commit -m "Prepare Clerva for deployment"

# Create a GitHub repository (you'll need this)
# Go to https://github.com/new and create a new repository
# Then connect it:
git remote add origin https://github.com/YOUR_USERNAME/clerva-app.git
git push -u origin main
```

### Step 2: Deploy to Railway

1. **Go to Railway**: https://railway.app
2. **Sign up** with GitHub
3. **New Project** → **Deploy from GitHub repo**
4. **Select** your `clerva-app` repository
5. Railway will auto-detect Next.js

### Step 3: Configure Environment Variables

In Railway dashboard, add these variables:

```bash
# Database
DATABASE_URL=postgresql://postgres.zuukijevgtcfsgylbsqj:Eminh2342009!!@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&pool_timeout=10
DIRECT_URL=postgresql://postgres.zuukijevgtcfsgylbsqj:Eminh2342009!!@aws-1-us-east-2.pooler.supabase.com:6543/postgres

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://zuukijevgtcfsgylbsqj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1dWtpamV2Z3RjZnNneWxic3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDE3MDgsImV4cCI6MjA3NDc3NzcwOH0.AZDiolkpmLvQFPxYBjdfA0E6QNsQeuoNw471uUVVXGU
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1dWtpamV2Z3RjZnNneWxic3FqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIwMTcwOCwiZXhwIjoyMDc0Nzc3NzA4fQ.VNXNMCBCAJ8Oae6_-O6W85FyhjWPm9aSR4HgoOMWoP4

# Authentication (generate a new secret for production!)
NEXTAUTH_SECRET=production-secret-change-this-to-random-string
NEXTAUTH_URL=https://your-app.railway.app

# Add when you get them:
# GOOGLE_CLIENT_ID=your_google_client_id
# GOOGLE_CLIENT_SECRET=your_google_client_secret
# STRIPE_SECRET_KEY=your_stripe_key
# AGORA_APP_ID=your_agora_app_id
# AGORA_APP_CERTIFICATE=your_agora_cert
```

### Step 4: Deploy!

Railway will automatically:
- Build your app (`npm run build`)
- Start your app (`npm start`)
- Give you a URL: `https://your-app.railway.app`

**Time**: ~5 minutes ⏱️

---

## 🏗️ Alternative: Google Cloud Run

If you prefer Google Cloud (since you mentioned it):

### Step 1: Install Google Cloud CLI

```bash
# On macOS
brew install --cask google-cloud-sdk

# Initialize
gcloud init
```

### Step 2: Create Dockerfile

Create `Dockerfile` in your project root:

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Step 3: Update next.config.ts

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  output: 'standalone', // Add this for Docker
};

export default nextConfig;
```

### Step 4: Deploy to Cloud Run

```bash
# Build and deploy
gcloud run deploy clerva-staging \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=your_db_url,NEXT_PUBLIC_SUPABASE_URL=your_url"
```

---

## 🌐 Setting Up Staging vs Production

### Strategy: Use Railway Environments

**Staging Environment**:
1. Deploy from `main` branch → `clerva-staging.railway.app`
2. Use current Supabase project (or create staging project)
3. Test all features here first

**Production Environment**:
1. Create new Railway project or environment
2. Deploy from `production` branch → `clerva.railway.app`
3. Use same Supabase (with different tables) OR separate Supabase project
4. Only deploy after testing in staging

### Workflow:
```
Developer (you) → commit to main → auto-deploy to STAGING
                                          ↓
                                  [Test everything]
                                          ↓
                                  [Looks good?]
                                          ↓
                         merge main → production branch
                                          ↓
                              auto-deploy to PRODUCTION
```

---

## ✅ Testing Checklist (After Deployment)

Test these features in your staging environment:

### Authentication
- [ ] Sign up with email/password
- [ ] Sign in with email/password
- [ ] Sign in with Google OAuth
- [ ] Sign out

### Core Features
- [ ] User profile loads
- [ ] Dashboard displays correctly
- [ ] Search for study partners
- [ ] Send connection requests
- [ ] Chat messaging works
- [ ] Group creation works

### Study Sessions
- [ ] Create study session
- [ ] Join study session
- [ ] Video calling works
- [ ] Screen sharing works
- [ ] Session timer works
- [ ] Session chat works

### Database
- [ ] Data persists after refresh
- [ ] Real-time updates work (Supabase)
- [ ] File uploads work (avatars, images)

### Performance
- [ ] Page loads in < 3 seconds
- [ ] No console errors
- [ ] Mobile responsive

---

## 🐛 Common Deployment Issues & Fixes

### Issue 1: "Module not found" errors
**Fix**: Make sure all dependencies are in `dependencies`, not `devDependencies`

```bash
# Check your package.json
npm install prisma @prisma/client --save
```

### Issue 2: Database connection fails
**Fix**: Update `NEXTAUTH_URL` and check Supabase connection pooling settings

### Issue 3: OAuth redirect fails
**Fix**: Add your deployment URL to Google OAuth allowed redirects:
- Google Cloud Console → APIs & Services → Credentials
- Add: `https://your-app.railway.app/auth/callback`

### Issue 4: Environment variables not working
**Fix**: Variables starting with `NEXT_PUBLIC_` are exposed to browser
- Sensitive keys should NOT start with `NEXT_PUBLIC_`

### Issue 5: Build fails with Prisma
**Fix**: Add postinstall script:

```json
"scripts": {
  "postinstall": "prisma generate"
}
```

---

## 📊 Monitoring Your Deployed App

### Railway Dashboard
- View logs in real-time
- Monitor CPU/Memory usage
- Track deployments
- View build logs

### Supabase Dashboard
- Monitor database queries
- Check real-time connections
- View API usage
- Check storage usage

### Application Monitoring (Optional)
Consider adding:
- **Sentry** - Error tracking
- **LogRocket** - Session replay
- **Google Analytics** - User analytics

---

## 🔐 Security Checklist for Production

- [ ] Generate new `NEXTAUTH_SECRET` (use: `openssl rand -base64 32`)
- [ ] Use environment-specific Supabase keys
- [ ] Enable HTTPS (automatic on Railway/Cloud Run)
- [ ] Set up CORS policies in Supabase
- [ ] Review RLS (Row Level Security) policies in Supabase
- [ ] Don't commit `.env` files to Git (already in `.gitignore` ✅)
- [ ] Set up database backups in Supabase
- [ ] Configure rate limiting for API routes

---

## 🎯 Next Steps

### Phase 1: Deploy to Staging (This Week)
1. ✅ Build succeeds locally
2. ⏳ Push code to GitHub
3. ⏳ Deploy to Railway staging
4. ⏳ Test all features
5. ⏳ Fix any issues

### Phase 2: Continuous Development (Ongoing)
- Make changes locally
- Commit to Git
- Auto-deploy to staging
- Test features
- Iterate

### Phase 3: Production Deploy (When Ready)
- All features working in staging
- No critical bugs
- Performance is good
- Create production environment
- Deploy!
- Monitor closely

---

## 🆘 Quick Commands Reference

```bash
# Test build locally
npm run build

# Test production mode locally
npm run build && npm start

# Check for errors
npm run lint

# Commit changes
git add .
git commit -m "Your message"
git push

# Check deployment logs (Railway)
# Use Railway dashboard or CLI

# Rollback deployment (Railway)
# Click previous deployment in dashboard → "Redeploy"
```

---

## 💡 Tips for Smooth Deployment

1. **Start Small**: Deploy basic features first, add complex ones later
2. **Test Locally**: Always run `npm run build` before deploying
3. **Monitor Logs**: Watch deployment logs for errors
4. **Use Staging**: Never test new features directly in production
5. **Database Backups**: Set up automatic backups in Supabase
6. **Version Control**: Commit often with clear messages

---

## 📞 Need Help?

If deployment fails:
1. Check build logs in Railway/Cloud Run
2. Verify all environment variables are set
3. Test the same build locally: `npm run build && npm start`
4. Check Supabase connection in deployed environment
5. Review this guide's troubleshooting section

---

**Ready to deploy?** Start with Railway for the fastest path to testing! 🚀

