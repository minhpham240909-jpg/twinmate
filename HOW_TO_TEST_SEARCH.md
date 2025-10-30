# How to Test AI User Search - Complete Guide

## ✅ What I Fixed

I completely rewrote the `searchUsers` tool with:
1. **Simpler queries** - Query User and Profile tables separately (no complex JOIN)
2. **Detailed logging** - Every step logs to console so we can debug
3. **Test endpoint** - Can test the search without using the AI

## 🧪 Step-by-Step Testing

### STEP 1: Verify "Gia Khang Phạm" Exists in Database

Run this SQL in **Supabase Dashboard → SQL Editor**:

```sql
-- Check if user exists
SELECT id, name, email, "createdAt"
FROM "User"
WHERE
  name ILIKE '%Gia%'
  OR name ILIKE '%Khang%'
  OR name ILIKE '%Phạm%'
  OR name ILIKE '%Pham%';
```

**Expected Result:** Should show at least 1 user with name "Gia Khang Phạm"

**If NO results:**
- The user doesn't exist in the database
- You need to create them OR search for a different user that exists

---

### STEP 2: Test the Search Endpoint Directly

Open this URL in your browser (replace with your production URL):

```
https://clerva-axtifqs96-minh-phams-projects-2df8ca7e.vercel.app/api/test-search-users?query=Gia
```

**Expected Result:**
```json
{
  "success": true,
  "query": "Gia",
  "found": 1,
  "results": [
    {
      "userId": "...",
      "name": "Gia Khang Phạm",
      "email": "...",
      "hasProfile": true,
      "subjects": [...],
      "interests": [...]
    }
  ]
}
```

**If found: 0:**
- User doesn't exist (go back to STEP 1)
- Search query doesn't match (try `?query=Khang` or `?query=Pham`)

**If hasProfile: false:**
- User exists but has no Profile
- AI can find them but won't show subjects/interests

---

### STEP 3: Test AI Search in Production

1. **Open your app:** https://clerva-axtifqs96-minh-phams-projects-2df8ca7e.vercel.app
2. **Sign in** to your account
3. **Open AI chat panel**
4. **Try these queries:**
   - "Find Gia Khang"
   - "Search for Gia Khang Phạm"
   - "Find users named Gia"
   - "Who is Gia Khang?"

**Expected Result:**
AI should respond with:
```
I found Gia Khang Phạm! Here's their profile:
- Subjects: [Computer Science, Math, ...]
- Interests: [Gaming, Coding, ...]
- Online status: ...
- Compatibility score: ...
```

**If AI still says "couldn't find":**
- Check Vercel logs (next step)

---

### STEP 4: Check Vercel Logs for Debugging

1. **Open Vercel Dashboard:** https://vercel.com/minh-phams-projects-2df8ca7e/clerva-app
2. **Click "Logs" tab**
3. **Filter for:** `[searchUsers]`

**Look for these log messages:**

```
[searchUsers] Searching for: Gia Khang searchBy: all
[searchUsers] User query result: { found: 1, error: undefined }
[searchUsers] Found user IDs: ['abc-123-...']
[searchUsers] Profile query result: { found: 1, error: undefined }
[searchUsers] Mapping user: Gia Khang Phạm has profile: true
[searchUsers] Returning 1 users
```

**If you see errors:**
- Copy the error message and send it to me
- It will show exactly what's failing

**If found: 0:**
- The search query isn't matching
- Check if the user's name is spelled differently in database

---

## 🔍 Common Issues & Solutions

### Issue: "No users found matching: Gia Khang"

**Cause:** User doesn't exist OR name is spelled differently

**Solution:**
```sql
-- List ALL users to see what names exist
SELECT id, name, email FROM "User" ORDER BY "createdAt" DESC LIMIT 20;
```

Then search for a name you know exists.

---

### Issue: AI finds user but shows no subjects/interests

**Cause:** User has no Profile data

**Solution:**
```sql
-- Check if user has profile
SELECT
  u.name,
  CASE WHEN p."userId" IS NOT NULL THEN 'Has Profile' ELSE 'No Profile' END
FROM "User" u
LEFT JOIN "Profile" p ON u.id = p."userId"
WHERE u.name ILIKE '%Gia%';
```

If "No Profile", create a profile for the user in the app.

---

### Issue: Tool is registered but AI doesn't use it

**Cause:** AI needs explicit prompt to use the tool

**Solution:** Try more explicit queries:
- ❌ "Gia Khang" (too vague)
- ✅ "Find user Gia Khang"
- ✅ "Search for Gia Khang"
- ✅ "Who is Gia Khang Phạm?"

---

## 📊 Test Files I Created

1. **test-search-queries.sql** - 5 SQL queries to verify data exists
2. **test-database-schema.sql** - Check actual table structure
3. **/api/test-search-users** - Test endpoint to verify search works
4. **HOW_TO_TEST_SEARCH.md** - This file

---

## 🚨 If It STILL Doesn't Work

Send me:
1. **Screenshot of SQL result** (from STEP 1)
2. **Response from test endpoint** (from STEP 2)
3. **Vercel logs** showing `[searchUsers]` messages (from STEP 4)
4. **Exact AI query** you typed

This will tell me exactly where it's failing!

---

## ✨ What Changed in Code

### packages/ai-agent/src/tools/searchUsers.ts

**OLD (Complex JOIN):**
```typescript
.from('User')
.select(`
  id, name, email,
  profile:Profile!userId(subjects, interests, ...)
`)
```
❌ This JOIN syntax may not work correctly

**NEW (Separate Queries):**
```typescript
// Query 1: Get users
const users = await supabase.from('User')
  .select('id, name, email')
  .or(`name.ilike.%${query}%,email.ilike.%${query}%`)

// Query 2: Get profiles
const profiles = await supabase.from('Profile')
  .select('userId, subjects, interests, ...')
  .in('userId', userIds)

// Map together
const profileMap = new Map(profiles.map(p => [p.userId, p]))
```
✅ Simple, reliable, with detailed logging

---

## 🎯 Expected Behavior After Fix

1. AI can find users by name: ✅
2. AI shows complete profile (subjects, interests, goals): ✅
3. AI shows online status: ✅
4. AI shows compatibility score: ✅
5. AI shows study history together: ✅
6. Detailed logs for debugging: ✅

**Deployment:** https://clerva-axtifqs96-minh-phams-projects-2df8ca7e.vercel.app

Test it now and let me know what you see!
