# 🧹 History Cleanup Setup - Quick Start

This guide helps you set up the automatic cleanup job for permanently deleting items older than 30 days.

## ⚡ Quick Setup (5 minutes)

### Step 1: Generate API Key

```bash
# Generate a secure random API key
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Add to Environment Variables

Add to your `.env.local` or deployment environment:

```bash
CLEANUP_API_KEY=your-generated-key-here
```

### Step 3: Choose Your Setup Method

#### Option A: Google Cloud Scheduler (Recommended for Google Cloud)

```bash
# Set environment variables
export CLEANUP_API_KEY=your-generated-key
export APP_URL=https://your-app.com
export SCHEDULE="0 2 * * *"  # Daily at 2 AM
export TIMEZONE="America/Los_Angeles"

# Run setup script
./scripts/setup-cleanup-cron.sh
```

#### Option B: Manual Script (For Testing)

```bash
# Set environment variables
export CLEANUP_API_KEY=your-generated-key
export DATABASE_URL=your-database-url
export SUPABASE_URL=your-supabase-url
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Run cleanup manually
npm run cleanup:history
```

#### Option C: External Cron Service

1. Sign up at https://cron-job.org
2. Create cron job:
   - **URL**: `https://your-app.com/api/history/cleanup`
   - **Method**: POST
   - **Headers**: `Authorization: Bearer YOUR_CLEANUP_API_KEY`
   - **Schedule**: Daily at 2 AM

#### Option D: Test Endpoint

```bash
# Test the endpoint
export CLEANUP_API_KEY=your-generated-key
export APP_URL=https://your-app.com
./scripts/test-cleanup.sh
```

## 📋 What Gets Cleaned Up?

The cleanup job permanently deletes (after 30 days):
- ✅ Deleted messages (DM/Group chats)
- ✅ Deleted groups
- ✅ Deleted posts
- ✅ Associated files from Supabase storage

## 🔒 Security

- **Never commit** `CLEANUP_API_KEY` to version control
- Use a **strong, random key** (32+ characters)
- The endpoint **requires authentication** in production
- Monitor cleanup logs regularly

## 🧪 Testing

```bash
# Test health check (no auth)
curl https://your-app.com/api/history/cleanup

# Test cleanup (requires auth)
curl -X POST \
  -H "Authorization: Bearer YOUR_CLEANUP_API_KEY" \
  https://your-app.com/api/history/cleanup
```

## 📚 Full Documentation

See [docs/CLEANUP_CRON_SETUP.md](./docs/CLEANUP_CRON_SETUP.md) for detailed setup instructions for all platforms.

## 🆘 Troubleshooting

**401 Unauthorized?**
- Check `CLEANUP_API_KEY` matches in both places
- Verify header format: `Authorization: Bearer YOUR_KEY`

**Cleanup not running?**
- Test endpoint manually first
- Check cron job logs
- Verify database connection

**Need help?**
- Check logs: `gcloud logging read "resource.type=cloud_scheduler_job"`
- Test manually: `npm run cleanup:history`

