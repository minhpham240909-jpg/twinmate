# How to Check AI Agent Logs

## 🔍 Find Out If AI Agent Is Calling searchUsers Tool

When the AI agent searches for users, it should log entries like:
```
[searchUsers] Searching for: Gia Khang searchBy: all
[searchUsers] Searching User table with terms: [ 'Gia', 'Khang' ]
[searchUsers] User table search result: { found: 1 }
[searchUsers] Found user IDs: [ 'abc-123...' ]
[searchUsers] User names: Gia Khang Pham
```

---

## For Google Cloud

### Method 1: Cloud Console UI

1. Go to https://console.cloud.google.com
2. Navigate to your project
3. Go to **Logging** → **Logs Explorer**
4. Add filter:
   ```
   jsonPayload.message =~ "searchUsers"
   ```
   Or:
   ```
   textPayload =~ "\[searchUsers\]"
   ```
5. Set time range: Last 1 hour
6. Click "Run Query"

**What to look for:**
- ✅ If you see `[searchUsers]` logs → AI is calling the tool
- ❌ If no logs → AI is NOT calling the tool

---

### Method 2: Command Line

```bash
# View recent logs
gcloud logging read "resource.type=cloud_run_revision" \
  --limit=100 \
  --format=json \
  | grep -i "searchUsers"

# Or for App Engine
gcloud app logs read --limit=100 | grep -i "searchUsers"
```

---

## For Supabase Logs

1. Go to Supabase Dashboard
2. Click **Logs** in left sidebar
3. Click **API** tab
4. Look for requests to `/rest/v1/User`
5. Check timestamps matching when you asked AI

---

## What the Logs Tell You

### Scenario 1: No `[searchUsers]` logs
**Meaning:** AI agent is NOT calling the searchUsers tool

**Possible reasons:**
- Tool not registered properly
- AI doesn't understand it should use the tool
- AI is using a different approach

**Solution:** See "Fix: AI Not Calling Tool" below

---

### Scenario 2: Logs show `[searchUsers] found: 0`
**Meaning:** AI is calling the tool, but finding 0 users

**Check logs for:**
```
[searchUsers] User table search result: { found: 0 }
```

**Possible reasons:**
- User doesn't exist in production database
- Search query is malformed
- RLS blocking access

**Solution:** Check database and RLS policies

---

### Scenario 3: Logs show users found, but AI says "not found"
**Meaning:** Tool works, but AI is misinterpreting results

**Check logs for:**
```
[searchUsers] Returning 1 users
[searchUsers] User names: Gia Khang Pham
```

**Possible reasons:**
- AI response formatting issue
- Tool output schema mismatch

**Solution:** Check tool output format

---

## Fix: AI Not Calling Tool

If no `[searchUsers]` logs appear, the AI isn't calling the tool.

### Try More Explicit Commands:

Instead of:
```
"Find Gia Khang Pham"
```

Try:
```
"Use the searchUsers tool to find Gia Khang Pham"
"Search the user database for Gia Khang Pham"
"Look up user: Gia Khang Pham"
"Check if Gia Khang Pham is registered"
```

### Check Tool Registration:

Make sure the tool is registered in the AI agent:

**File:** `packages/ai-agent/src/tools/index.ts`

Should include:
```typescript
import { createSearchUsersTool } from './searchUsers'

// In registry
registry.register(createSearchUsersTool(supabase))
```

---

## Quick Diagnostic Command

Run all these and report results:

```bash
# 1. Check if user exists
curl https://your-domain.com/api/list-all-users

# 2. Test search API
curl "https://your-domain.com/api/test-search-users?query=Gia%20Khang"

# 3. Test with filter
curl "https://your-domain.com/api/test-ai-search-tool?query=Gia%20Khang"

# 4. Check who's logged in
curl https://your-domain.com/api/debug-current-user
```

---

## What to Report Back

Send me these 4 things:

1. **Does `/api/list-all-users` show "Gia Khang Pham"?**
   - YES / NO

2. **Does `/api/test-search-users?query=Gia` find them?**
   - YES / NO

3. **Do you see `[searchUsers]` in logs when you ask AI?**
   - YES / NO / CAN'T CHECK LOGS

4. **Exact message you typed to AI:**
   - "Find Gia Khang Pham" or something else?

This will tell me exactly what's wrong!

