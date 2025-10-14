# 🔄 Clerva Development Workflow

## The Complete Journey: Local → Testing → Production

This explains how professional apps are developed and deployed.

---

## 🏗️ Three Environments

### 1. **Local Development** (Your Computer)
- **Purpose**: Write and test code
- **Location**: `localhost:3000`
- **Who uses it**: Only you
- **Database**: Your Supabase (same as staging/prod for now)
- **Breaking things**: Totally fine! No one else affected

### 2. **Staging/Testing** (Railway - Deployed)
- **Purpose**: Test features in real-world environment
- **Location**: `https://clerva-staging.railway.app`
- **Who uses it**: You + trusted testers
- **Database**: Your Supabase (consider separate staging DB later)
- **Breaking things**: OK, it's for testing

### 3. **Production** (Railway - Deployed)
- **Purpose**: Real users use this
- **Location**: `https://clerva.com` (your custom domain)
- **Who uses it**: Your real users
- **Database**: Production Supabase (definitely separate)
- **Breaking things**: ❌ Must avoid!

---

## 📅 Your Daily Workflow

### Morning: Start Development
```bash
cd "/Users/minhpham/Documents/minh project.html/clerva-app"
npm run dev
# Open http://localhost:3000
# Start coding!
```

### During Day: Make Changes
1. Write code in VS Code / Cursor
2. Save files (auto-refreshes in browser)
3. Test features locally
4. Check browser console for errors
5. Fix bugs, add features

### End of Day: Commit Work
```bash
# Save your work to Git
git add .
git commit -m "Added new feature: study session reminders"
git push
```

**What happens**: Railway automatically deploys to staging! 🚀

### Next Day: Check Staging
1. Visit your staging URL
2. Test the feature you added yesterday
3. Does it work online? ✅ Great!
4. Broken? ❌ Check logs, fix locally, push again

---

## 🎯 Feature Development Cycle

### Example: Adding a "Study Goals" Feature

#### Step 1: Local Development (1-3 days)
```bash
# Create a new branch (optional, good practice)
git checkout -b feature/study-goals

# Code the feature
# Test locally
# Fix bugs
# Test again
```

#### Step 2: Commit and Deploy to Staging (5 minutes)
```bash
git add .
git commit -m "Add study goals feature"
git push
```

**Railway**: Automatically builds and deploys to staging

#### Step 3: Test on Staging (30 minutes)
- Visit staging URL
- Test study goals feature
- Test on mobile (responsive?)
- Ask friend to test
- Find bugs? → Fix locally → Push again

#### Step 4: Deploy to Production (When Ready)
```bash
# Merge to production branch
git checkout production
git merge feature/study-goals
git push
```

**Railway**: Deploys to production environment

#### Step 5: Monitor (First 24 hours)
- Check error logs
- Watch user feedback
- Be ready to rollback if needed

---

## 🔀 Git Branching Strategy

### Simple Approach (For Solo Developer)
```
main branch → Auto-deploys to STAGING
production branch → Auto-deploys to PRODUCTION
```

### Workflow:
1. Make all changes on `main`
2. Test thoroughly on staging
3. When ready: merge `main` into `production`
4. Production gets updated

### Advanced Approach (When You Hire Team)
```
feature/new-feature → Pull Request → main → staging
                                      ↓
                                    production
```

---

## 🧪 Testing Checklist Before Production

Never deploy to production without testing these in staging:

### Critical Features
- [ ] User can sign up
- [ ] User can sign in
- [ ] User can sign out
- [ ] User can create profile
- [ ] User can search for partners
- [ ] Chat works
- [ ] Video calls work
- [ ] Screen sharing works
- [ ] Data persists after refresh
- [ ] No console errors
- [ ] Mobile works (test on phone)

### Performance
- [ ] Pages load in < 3 seconds
- [ ] Images load properly
- [ ] No memory leaks (test with multiple tabs)

### Security
- [ ] Can't access other user's data
- [ ] API routes require authentication
- [ ] Sensitive data not exposed in browser

---

## 🚨 Handling Bugs in Production

### If You Find a Bug After Deploying

**Option 1: Quick Rollback**
```bash
# Go to Railway dashboard
# Click "Deployments"
# Find the previous working deployment
# Click "Redeploy"
# Production back to working state ✅
```

**Option 2: Hotfix**
```bash
# Fix the bug locally
git add .
git commit -m "HOTFIX: Fix critical login bug"
git push origin production

# Deploy immediately
# Monitor closely
```

### Prevention
- Always test in staging first
- Never push directly to production without testing
- Keep staging identical to production environment

---

## 📊 Database Management

### Current Setup
- One Supabase project
- Used by local, staging, AND production

### Recommended Setup (Later)
```
Local Development → Supabase Project 1 (Dev)
Staging → Supabase Project 2 (Staging)
Production → Supabase Project 3 (Production)
```

**Why?** 
- Testing doesn't affect real users
- Can reset staging database without worry
- Clear separation of concerns

### Migration Workflow
```bash
# Make schema changes locally
npx prisma migrate dev --name add_study_goals

# Test locally
# Push to staging (Railway runs migrations)
# Test on staging
# Push to production (Railway runs migrations)
```

---

## 🔄 Continuous Deployment (What You'll Have)

### Automatic Process:
```
You code locally
     ↓
Save files
     ↓
Commit to Git
     ↓
Push to GitHub
     ↓
Railway detects changes
     ↓
Railway builds app
     ↓
Railway runs tests (if you add them)
     ↓
Railway deploys
     ↓
Your app is live!
```

**Time**: Push to deployed = 2-5 minutes

### Manual Process (If You Prefer):
- Don't push to GitHub automatically
- Deploy manually when ready
- More control, but slower

---

## 📈 Scaling Your Workflow

### Phase 1: Solo Developer (Now)
```
Local → Staging → Production
       (test)    (real users)
```

### Phase 2: Small Team (Later)
```
Local → Feature Branch → Main (Staging) → Production
              ↓
         Code Review
```

### Phase 3: Growing Product (Future)
```
Local → Feature → Pull Request → Code Review → 
    Automated Tests → Staging → Manual QA → 
    Production → Monitoring → Analytics
```

---

## 🛠️ Essential Tools

### Current Tools
- ✅ **Git**: Version control
- ✅ **Supabase**: Database + Auth
- ✅ **Railway**: Hosting
- ✅ **Next.js**: Framework

### Add Later (Optional)
- **Sentry**: Error tracking
- **Vercel Analytics**: User behavior
- **Playwright**: Automated testing
- **GitHub Actions**: CI/CD pipelines
- **Figma**: Design collaboration

---

## 💡 Pro Tips

### 1. Commit Often
```bash
# Bad: Work for 3 days, one commit
git commit -m "Added lots of stuff"

# Good: Small, frequent commits
git commit -m "Add user profile picture upload"
git commit -m "Fix profile picture resize bug"
git commit -m "Add profile picture preview"
```

### 2. Write Clear Commit Messages
```bash
# Bad
git commit -m "fixed stuff"

# Good
git commit -m "Fix: Video call not connecting on Safari"
git commit -m "Feature: Add study session reminders"
git commit -m "Improve: Dashboard loading performance"
```

### 3. Test Before Pushing
```bash
# Always test locally first
npm run build  # Make sure it builds
npm start      # Test production build
# If works → push
```

### 4. Monitor After Deploying
- Check Railway logs for 10 minutes after deploy
- Watch for error spikes
- Test critical features yourself

### 5. Keep Staging Updated
- Deploy to staging daily
- Keep it close to production
- Test new features here first

---

## 📋 Weekly Routine

### Monday
- Plan features for the week
- Create feature branches
- Start coding

### Tuesday-Thursday
- Code, test, deploy to staging
- Fix bugs found in staging
- Iterate on features

### Friday
- Final testing in staging
- If everything works: deploy to production
- Monitor production over weekend
- Document what you built

### Weekend (Optional)
- Monitor production for issues
- Plan next week
- Personal projects

---

## 🎯 Your First Month

### Week 1: Set Up
- [x] Local development working
- [ ] Deploy to staging (Railway)
- [ ] Test all features work in staging
- [ ] Fix deployment issues

### Week 2: Develop
- [ ] Add new features locally
- [ ] Push to staging daily
- [ ] Test features work
- [ ] Fix bugs

### Week 3: Polish
- [ ] Fix all warnings in build
- [ ] Improve UI/UX
- [ ] Test on mobile
- [ ] Performance optimization

### Week 4: Production
- [ ] Final testing in staging
- [ ] Create production environment
- [ ] Deploy to production
- [ ] Share with first real users!

---

## 🚀 You're Ready!

With this workflow, you can:
- ✅ Develop features safely locally
- ✅ Test in staging before production
- ✅ Deploy confidently
- ✅ Roll back if needed
- ✅ Iterate quickly
- ✅ Scale as you grow

**Next**: Follow `DEPLOY_NOW.md` to get your staging environment up! 🎉

---

## 📞 Questions?

Common questions and answers:

**Q: How often should I deploy to staging?**
A: Daily, or after every feature you want to test.

**Q: How often should I deploy to production?**
A: Weekly, or when you have tested features ready.

**Q: What if I break production?**
A: Rollback to previous deployment (2 minutes).

**Q: Should I test locally before pushing?**
A: Yes! Always. `npm run build` should pass.

**Q: Can I develop without deploying?**
A: Yes, but you won't know if it works in real environment.

**Q: Do I need staging if I'm solo?**
A: YES! It prevents breaking production and saves you stress.

