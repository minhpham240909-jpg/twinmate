# 🔍 Debugging: AI Agent Can't Find User

## 🎯 Your Issue

- ✅ API works: `/api/list-all-users` shows users
- ✅ Database has users: SQL queries return data
- ❌ **AI agent says:** "I wasn't able to find any information on a user named Gia Khang"

---

## 🔍 Most Common Cause: You're Searching For YOURSELF!

The `searchUsers` tool **automatically filters out the current logged-in user**.

### Why?
- Design decision: You don't need to "find yourself" as a study partner
- Prevents self-matching in partner search features

### How to Check:

**Step 1: Check who you're logged in as**
```
https://your-domain.com/api/debug-current-user
```

**Step 2: Test if that's the issue**
```
https://your-domain.com/api/test-ai-search-tool?query=Gia
```

This will show:
- ✅ Users found WITH filter (what AI sees)
- ✅ Users found WITHOUT filter (all matching users)
- ⚠️ Users being filtered out (probably you!)

---

## 🧪 Quick Diagnostic Steps

### Test 1: Check Who You're Logged In As

Visit:
```
https://your-domain.com/api/debug-current-user
```

**Response shows:**
```json
{
  "authenticated": true,
  "authEmail": "giakhang.pham@test.com",  ← THIS is you!
  "dbUser": {
    "id": "abc-123",
    "name": "Gia Khang Pham"  ← If this matches your search, that's the issue!
  },
  "note": "The searchUsers tool will NOT show this user in results"
}
```

**Diagnosis:**
- If `dbUser.name` = "Gia Khang Pham" → **You're searching for yourself!** ✅ Issue found
- If different name → Continue to Test 2

---

### Test 2: Test the Search Filter

Visit:
```
https://your-domain.com/api/test-ai-search-tool?query=Gia%20Khang
```

**Look at the response:**
```json
{
  "diagnosis": {
    "isSearchingForYourself": true,  ← THIS tells you!
    "message": "⚠️ You are searching for YOURSELF! ..."
  },
  "searchResults": {
    "withCurrentUserFilter": {
      "found": 0,  ← What AI sees (0 users)
      "users": []
    },
    "withoutFilter": {
      "found": 1,  ← What actually exists (1 user)
      "users": [{"name": "Gia Khang Pham", ...}]
    },
    "filteredOut": {
      "users": [{
        "name": "Gia Khang Pham",
        "reason": "Current logged-in user"  ← Blocked!
      }]
    }
  }
}
```

**If `isSearchingForYourself: true`** → **That's the issue!**

---

## ✅ Solutions

### Solution 1: Search for a DIFFERENT User

If you're "Gia Khang Pham", try searching for:
```
"Find John Smith"
"Search for Maria Garcia"
"Who is studying Biology?"
```

These should work! ✅

---

### Solution 2: Create Another Test User

If you NEED to test searching by name, create another user and log in as them:

```sql
-- Create a test user "Test Student"
DO $$
DECLARE
    test_user_id TEXT;
BEGIN
    test_user_id := gen_random_uuid()::text;
    
    INSERT INTO "User" (id, email, name, role, "emailVerified", "createdAt", "updatedAt")
    VALUES (test_user_id, 'test.student@test.com', 'Test Student', 'FREE', true, NOW(), NOW());
    
    INSERT INTO "Profile" (
        id, "userId", subjects, interests,
        "studyStyle", "skillLevel", "onlineStatus",
        "createdAt", "updatedAt"
    ) VALUES (
        gen_random_uuid()::text,
        test_user_id,
        ARRAY['Testing']::text[],
        ARRAY['QA']::text[],
        'VISUAL',
        'BEGINNER',
        'ONLINE',
        NOW(),
        NOW()
    );
END $$;
```

Then:
1. Log out from "Gia Khang Pham"
2. Log in as "Test Student" (test.student@test.com)
3. Try: "Find Gia Khang Pham"
4. Should work now! ✅

---

### Solution 3: Remove the Filter (NOT Recommended)

If you REALLY need to search for yourself (for testing only):

**Edit:** `packages/ai-agent/src/tools/searchUsers.ts`

**Change line 76:**
```typescript
// OLD:
.neq('id', ctx.userId) // Don't include current user

// NEW (for testing only):
// .neq('id', ctx.userId) // Allow searching for self (TESTING ONLY)
```

⚠️ **Warning:** This removes the filter entirely. Only do this for testing!

---

## 🔍 Other Possible Issues

If you're NOT searching for yourself, check these:

### Issue 2: AI Agent Not Calling the Tool

**Symptom:** No `[searchUsers]` logs in console

**Check logs:**
- Google Cloud → Logging
- Filter: `[searchUsers]`
- If no logs appear → AI didn't call the tool

**Solution:**
Try more explicit commands:
```
"Use the searchUsers tool to find Gia Khang"
"Search the database for user named Gia Khang"
"Look up Gia Khang in the user list"
```

---

### Issue 3: AI Agent Has Old Code

**Symptom:** AI searches but uses old logic

**Solution:**
1. Make sure you pushed code: `git push origin main`
2. Wait for deployment to complete
3. Check deployment in Google Cloud Console
4. Verify new code is deployed

---

### Issue 4: Different Database in Production

**Symptom:** Works locally, fails in production

**Check:**
1. Google Cloud Console → Your service
2. Check environment variable: `DATABASE_URL`
3. Make sure it points to the SAME Supabase database where you:
   - Created test users
   - Added RLS policies

**Verify:**
```sql
-- Run in your PRODUCTION database
SELECT COUNT(*) FROM "User";
-- Should show your test users
```

---

## 📊 Decision Tree

```
Can't find user
  │
  ├─ Are you logged in as that user?
  │  ├─ YES → ⚠️ That's the issue! (Solution 1 or 2)
  │  └─ NO → Continue
  │
  ├─ Does /api/test-ai-search-tool find them?
  │  ├─ YES → AI not calling tool (Issue 2)
  │  └─ NO → Database issue
  │
  └─ Does /api/list-all-users show them?
     ├─ YES → RLS or filter issue
     └─ NO → User doesn't exist in production DB (Issue 4)
```

---

## ✅ Verification Steps

Run these in order:

### 1. Who am I logged in as?
```
GET /api/debug-current-user
```
Expected: Shows your user info

### 2. Can search find users (with filter)?
```
GET /api/test-ai-search-tool?query=Gia
```
Expected: Shows if you're filtering yourself out

### 3. Do users exist in database?
```
GET /api/list-all-users
```
Expected: Shows all users including Gia Khang

### 4. Can basic search work?
```
GET /api/test-search-users?query=Gia
```
Expected: Finds users (doesn't filter current user)

---

## 🎯 Most Likely Scenario

**You are logged in as "Gia Khang Pham"** and trying to search for yourself.

**Quick test:**
1. Visit `/api/debug-current-user`
2. Check the `dbUser.name` field
3. If it says "Gia Khang Pham" → **That's it!**

**Quick fix:**
Try searching for "John Smith" or "Maria Garcia" instead. Should work! ✅

---

## 📝 Summary

| Symptom | Cause | Solution |
|---------|-------|----------|
| API works, AI doesn't | Searching for yourself | Search for different user |
| No `[searchUsers]` logs | AI not calling tool | Use explicit commands |
| Works locally, not prod | Different database | Check DATABASE_URL |
| Nobody can be found | RLS or deployment | Check RLS policies |

---

## 🚀 Next Steps

1. **Run Test 1** → Check who you're logged in as
2. **Run Test 2** → See if you're filtering yourself
3. **Try searching for a different user**
4. **Report back results!**

Most likely you just need to search for a DIFFERENT user! 😊

---

**Need help?** Send me:
1. Response from `/api/debug-current-user`
2. Response from `/api/test-ai-search-tool?query=Gia`
3. Who you're logged in as
4. Who you're trying to find

