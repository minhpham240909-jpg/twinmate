# 🔍 Debug: Why searchUsers Isn't Finding Users

## The Problem:
```
You: "Find Gia Khang Phạm"
AI: "It seems that I couldn't find any study partner named 'Gia Khang Phạm' in the database."
```

---

## 🔎 STEP 1: Check if Users Exist in Database

### Run this SQL in Supabase Dashboard:

```sql
-- Check if ANY users exist
SELECT
  "userId",
  "firstName",
  "lastName",
  email,
  subjects,
  interests
FROM "Profile"
LIMIT 10;
```

**Expected:**
- Should see list of users
- If empty → **Backend Issue:** No users in database!

---

### Check for specific user:

```sql
-- Search for "Gia Khang"
SELECT
  "userId",
  "firstName",
  "lastName",
  email
FROM "Profile"
WHERE
  "firstName" ILIKE '%Gia%'
  OR "firstName" ILIKE '%Khang%'
  OR "lastName" ILIKE '%Gia%'
  OR "lastName" ILIKE '%Khang%'
  OR "lastName" ILIKE '%Phạm%'
  OR "lastName" ILIKE '%Pham%'
  OR email ILIKE '%gia%'
  OR email ILIKE '%khang%';
```

**Expected:**
- If found → Database has the user ✅
- If not found → **Backend Issue:** User doesn't exist in Profile table

---

## 🔎 STEP 2: Check if searchUsers Tool is Registered

### Verify tool registration in API logs:

1. Open your Next.js dev server logs (or Vercel logs)
2. Look for these lines when server starts:

```
✓ Registered tool: searchUsers
✓ Registered tool: getUserActivity
```

**Expected:**
- Should see both tools registered
- If missing → **AI Agent Issue:** Tools not registered!

---

## 🔎 STEP 3: Test searchUsers Tool Directly

### Create test file to verify tool works:

```bash
cd /Users/minhpham/Documents/minh\ project.html/clerva-app
```

Create `test-search-users.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { createSearchUsersTool } from './packages/ai-agent/src/tools/searchUsers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const tool = createSearchUsersTool(supabase)

// Test search
const ctx = {
  userId: 'YOUR_USER_ID', // Replace with your actual user ID
  traceId: 'test-123',
  timestamp: new Date(),
}

tool.call({ query: 'Gia Khang' }, ctx)
  .then(result => {
    console.log('Search Results:', JSON.stringify(result, null, 2))
  })
  .catch(err => {
    console.error('Search Error:', err)
  })
```

**Run:**
```bash
npx tsx test-search-users.ts
```

**Expected:**
- Should return users matching "Gia Khang"
- If error → **AI Agent Issue:** Tool has bug
- If empty results but SQL found user → **AI Agent Issue:** Query logic wrong

---

## 🔎 STEP 4: Check if AI is Actually Calling the Tool

### Add logging to see tool calls:

Open: `packages/ai-agent/src/lib/orchestrator.ts`

Find the `executeTool` function (around line 393)

Add console.log at the start:

```typescript
private async executeTool(
  toolName: string,
  argsJson: string,
  context: AgentContext
): Promise<ToolResult> {
  const startTime = Date.now()

  // ADD THIS LINE:
  console.log(`🔧 Tool called: ${toolName} with args:`, argsJson)

  try {
    const tool = this.config.toolRegistry.get(toolName)
    // ... rest of code
```

**Then test again in UI:**
1. Ask: "Find Gia Khang"
2. Watch server logs
3. Look for: `🔧 Tool called: searchUsers`

**Expected:**
- See tool being called → Tool is working, check database
- Don't see tool being called → **AI Agent Issue:** AI not using the tool!

---

## 🐛 COMMON ISSUES & FIXES

### Issue 1: "No users in Profile table"

**Symptom:** SQL returns 0 rows

**Fix:** You need to create test users!

```sql
-- Create test user manually
INSERT INTO "Profile" (
  "userId",
  "firstName",
  "lastName",
  email,
  subjects,
  interests,
  "studyStyle"
) VALUES (
  gen_random_uuid(),
  'Gia Khang',
  'Phạm',
  'giakhang@example.com',
  ARRAY['Computer Science', 'Math'],
  ARRAY['Gaming', 'Coding'],
  'Visual'
);
```

---

### Issue 2: "Tool not registered"

**Symptom:** Don't see "✓ Registered tool: searchUsers" in logs

**Fix:** Check `packages/ai-agent/src/tools/index.ts`

Should have:
```typescript
import { createSearchUsersTool } from './searchUsers'
import { createGetUserActivityTool } from './getUserActivity'

// In createAndRegisterTools function:
registry.register(createSearchUsersTool(supabase))
registry.register(createGetUserActivityTool(supabase))
```

If missing, the deployment didn't work. Need to redeploy.

---

### Issue 3: "AI not calling the tool"

**Symptom:** No `🔧 Tool called: searchUsers` in logs

**Fix:** AI doesn't understand when to use it

Check system prompt has this:
```
"🧠 INTELLIGENCE FEATURES (NEW):
- When user asks 'Find [Name]' or mentions anyone → ALWAYS use searchUsers tool first"
```

If missing, the prompt didn't update. Check `orchestrator.ts` line 471.

---

### Issue 4: "Vietnamese character issues (Phạm vs Pham)"

**Symptom:** User exists as "Pham" but searching "Phạm" doesn't find

**Fix:** PostgreSQL ILIKE should handle this, but might need to search both:

```typescript
// In searchUsers.ts, update query:
profileQuery = profileQuery.or(`
  firstName.ilike.%${query}%,
  lastName.ilike.%${query}%,
  lastName.ilike.%${query.normalize('NFD').replace(/[\u0300-\u036f]/g, "")}%,
  email.ilike.%${query}%
`)
```

This removes diacritics (Phạm → Pham) for broader matching.

---

## ✅ QUICK DIAGNOSIS CHECKLIST

Run these in order:

- [ ] **Step 1:** Run SQL to check if users exist
  - ✅ Users exist → Go to Step 2
  - ❌ No users → **Fix:** Add test users to database

- [ ] **Step 2:** Check server logs for tool registration
  - ✅ Tools registered → Go to Step 3
  - ❌ Not registered → **Fix:** Redeploy or check index.ts

- [ ] **Step 3:** Test tool directly with test script
  - ✅ Tool works → Go to Step 4
  - ❌ Tool errors → **Fix:** Debug tool code

- [ ] **Step 4:** Check if AI calls the tool
  - ✅ AI calls tool but returns empty → Database issue (no matching user)
  - ❌ AI doesn't call tool → Prompt issue or LLM not understanding

---

## 🎯 MOST LIKELY ISSUE

Based on the error message, I suspect:

### **Most Likely: No users in Profile table**

The AI IS working correctly, but the database is empty or doesn't have users with that name.

**How to verify:**
1. Run Step 1 SQL query
2. If returns 0 rows → Need to add test users
3. If returns users but not "Gia Khang" → User doesn't exist with that name

**Quick Test:**
1. Go to Supabase Dashboard → Table Editor → Profile
2. Look for any rows
3. Check firstName, lastName columns

---

## 🔧 IMMEDIATE ACTION

Run this NOW in Supabase SQL Editor:

```sql
-- 1. Check if Profile table has ANY users
SELECT COUNT(*) as total_users FROM "Profile";

-- 2. List all users to see who exists
SELECT
  "firstName",
  "lastName",
  email
FROM "Profile"
ORDER BY "firstName"
LIMIT 20;

-- 3. Search for Gia Khang specifically
SELECT
  "firstName",
  "lastName",
  email
FROM "Profile"
WHERE
  "firstName" ILIKE '%gia%'
  OR "lastName" ILIKE '%khang%'
  OR "lastName" ILIKE '%pham%';
```

**Then tell me:**
1. How many users exist? (from query 1)
2. What names do you see? (from query 2)
3. Did you find Gia Khang? (from query 3)

---

## 📊 EXPECTED RESULTS

### If Working Correctly:

**Database:** Should have users with names
**AI Agent:** Should call searchUsers tool
**Response:** Should find and show user details

### If Not Working:

**No users in DB:** Add test users (see Issue 1 fix)
**Tool not registered:** Redeploy (see Issue 2 fix)
**AI not calling tool:** Update prompt (see Issue 3 fix)

---

Let me know the results of the SQL queries and I'll help you fix it! 🚀
