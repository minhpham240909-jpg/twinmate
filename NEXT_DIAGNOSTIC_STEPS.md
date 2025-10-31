# Next Diagnostic Steps - AI Can't Find User

## ✅ What We've Confirmed So Far

1. ✅ User "Gia Khang Pham" exists in database
2. ✅ Profile exists (profile_id shows UUID)
3. ✅ You're NOT logged in as that user
4. ✅ All profile fields are included in the search code

## 🎯 The Issue Must Be One of These:

### Option A: Search Tool Logic Issue
The searchUsers tool code has a bug preventing it from finding the user.

### Option B: AI Not Calling the Tool
The AI agent isn't invoking the searchUsers tool when you search.

### Option C: Database Connection Issue
The AI agent is using a different database or connection than expected.

---

## 🧪 Critical Tests to Run Now

### **Test 1: Direct API Test (Most Important)**

Open your browser or terminal and test the search API directly:

#### In Browser:
```
http://localhost:3000/api/test-search-users?query=Gia%20Khang
```

#### In Terminal:
```bash
curl "http://localhost:3000/api/test-search-users?query=Gia%20Khang"
```

**What to look for:**
```json
{
  "success": true,
  "query": "Gia Khang",
  "found": 1,  // ← THIS NUMBER
  "results": [
    {
      "userId": "...",
      "name": "Gia Khang Pham",  // ← SHOULD SHOW THE USER
      ...
    }
  ]
}
```

**If `found: 0` or empty results:**
→ **Issue is in the search code itself** (Option A)

**If `found: 1` and shows the user:**
→ **Issue is the AI not calling the tool** (Option B)

---

### **Test 2: Check AI Agent Logs**

When you ask the AI to find "Gia Khang", check the logs for:

```
[searchUsers] Searching for: Gia Khang searchBy: all
[searchUsers] Found user IDs: [...]
```

**In Google Cloud:**
1. Go to Google Cloud Console
2. Navigate to your service
3. Click "Logs"
4. Filter for: `[searchUsers]`

**If NO logs appear:**
→ **AI is not calling the tool** (Option B)

**If logs appear but say "found: 0":**
→ **Search logic issue** (Option A)

---

### **Test 3: Test AI Tool Diagnostic Endpoint**

If you have the test endpoint deployed:

```
http://your-domain.com/api/test-ai-search-tool?query=Gia%20Khang
```

This will show you:
- Results WITH current user filter (what AI sees)
- Results WITHOUT filter (all matches)
- Who is being filtered out

---

## 🔧 Fixes Based on Test Results

### **If Test 1 shows `found: 0`** → Search Code Issue

The problem is in the search logic. Possible causes:

#### Cause 1: Supabase Connection Issue
```typescript
// Check if AI agent is using correct Supabase client
// In packages/ai-agent/src/tools/searchUsers.ts line 88-100

// Make sure it's using the service role key, not anon key
```

**Fix:** Verify environment variables:
```bash
# Check these are set correctly:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... (not anon key!)
```

#### Cause 2: RLS Blocking Service Role

Run in Supabase:
```sql
-- Check if service_role policy exists
SELECT * FROM pg_policies 
WHERE tablename = 'User' 
  AND policyname LIKE '%service%';

-- If no results, create the policy:
CREATE POLICY "Allow service role full access to User" ON "User"
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

#### Cause 3: Different Database in Production

**If in production:**
- Check that DATABASE_URL points to the same Supabase project
- Verify the user exists in THAT database

---

### **If Test 1 shows `found: 1`** → AI Not Calling Tool

The search works, but the AI isn't using it. Fixes:

#### Fix 1: Use More Explicit Prompts

Instead of:
- ❌ "Gia Khang"
- ❌ "Find Gia Khang"

Try:
- ✅ "Search for user named Gia Khang"
- ✅ "Use the searchUsers tool to find Gia Khang"
- ✅ "Look up Gia Khang in the database"
- ✅ "Find study partner Gia Khang"

#### Fix 2: Check AI Agent Configuration

The AI needs to recognize when to use the tool. Check:

```typescript
// packages/ai-agent/src/tools/searchUsers.ts
// Line 53-80 - Tool description

description: `🔴 CRITICAL TOOL - ALWAYS USE FOR PEOPLE SEARCHES 🔴

⚠️ MANDATORY: Call this tool IMMEDIATELY if the user message contains:
1. Any capitalized word that looks like a name
...
```

This description tells the AI when to use the tool.

---

## 📋 Your Action Items

### **Right Now:**

1. **Run Test 1** - Check if search API works:
   ```bash
   curl "http://localhost:3000/api/test-search-users?query=Gia%20Khang"
   ```

2. **Report back:**
   - What does `"found":` show? (0 or 1+)
   - Does it show the user's name in results?

### **After Test 1:**

**If found = 0:**
- I'll help you fix the search logic
- Likely RLS or connection issue

**If found = 1+:**
- Issue is AI not calling tool
- Try more explicit prompts
- Check AI logs in Google Cloud

---

## 🎯 Quick Decision Tree

```
Run Test 1: /api/test-search-users?query=Gia%20Khang
  │
  ├─ found: 0
  │   └─ Search code issue
  │       ├─ Check RLS policies
  │       ├─ Check Supabase connection
  │       └─ Verify database has data
  │
  └─ found: 1+
      └─ AI not calling tool
          ├─ Use more explicit prompts
          ├─ Check AI agent logs
          └─ Verify tool description is clear
```

---

## 💡 Most Likely Scenario

Based on everything we know, I predict:

**90% chance:** Search API works (`found: 1`), but AI isn't calling the tool consistently.

**10% chance:** RLS is blocking the service_role in production.

---

## 🚀 Run This Now

```bash
# Make sure dev server is running
npm run dev

# In another terminal or browser:
curl "http://localhost:3000/api/test-search-users?query=Gia%20Khang"

# Or visit in browser:
http://localhost:3000/api/test-search-users?query=Gia%20Khang
```

**Tell me the `found` number and I'll know exactly how to fix it!** 🔍

