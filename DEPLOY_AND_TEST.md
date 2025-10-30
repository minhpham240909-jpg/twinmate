# Quick Deploy & Test Guide

## 🚀 Step 1: Deploy the Fix

### For Google Cloud / Supabase Deployment:

```bash
cd "/Users/minhpham/Documents/minh project.html/clerva-app"

# Add all changes
git add .

# Commit the fix
git commit -m "Fix: Improve user search with multi-term matching for names like 'Gia Khang Pham'"

# Push to your repository (triggers auto-deployment)
git push origin main
```

Wait for deployment to complete (check your Google Cloud dashboard or deployment logs).

---

## 🧪 Step 2: Verify User Exists

Before testing the AI, make sure the user exists in your database.

### Option A: Using Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Run this query:

```sql
SELECT id, name, email, "createdAt"
FROM "User"
WHERE name ILIKE '%Gia%'
   OR name ILIKE '%Khang%'
   OR name ILIKE '%Pham%'
ORDER BY "createdAt" DESC;
```

3. **If you see results** → User exists! Proceed to Step 3.
4. **If no results** → User doesn't exist. See "Create Test User" section below.

### Option B: Using the SQL Script

1. Open `/Users/minhpham/Documents/minh project.html/clerva-app/verify-user-exists.sql`
2. Copy TEST 1 query
3. Run in Supabase SQL Editor
4. Check results

---

## 🧪 Step 3: Test the Fix

### Test 3A: Direct API Test (Recommended First)

Visit this URL in your browser:

```
https://YOUR-DOMAIN.com/api/test-search-users?query=Gia%20Khang
```

Replace `YOUR-DOMAIN.com` with your actual domain.

**Expected Response:**
```json
{
  "success": true,
  "query": "Gia Khang",
  "found": 1,
  "results": [
    {
      "userId": "...",
      "name": "Gia Khang Pham",
      "email": "...",
      "hasProfile": true,
      "subjects": [...],
      ...
    }
  ]
}
```

✅ **If you see this** → Search is working! Proceed to Test 3B.
❌ **If you see "found": 0** → User doesn't exist or name is spelled differently.

### Test 3B: Test with AI Agent

1. Open your application
2. Go to the AI chat interface
3. Type one of these queries:

```
Find Gia Khang Pham
```
```
Search for user Gia Khang
```
```
Who is Gia Khang?
```

**Expected AI Response:**
```
I found Gia Khang Pham! Here's their information:

👤 Name: Gia Khang Pham
📧 Email: [email]
📚 Subjects: [list of subjects]
🎯 Interests: [list of interests]
...
```

---

## 🔍 Step 4: Check Logs (If Issues)

### For Google Cloud:

1. Go to Google Cloud Console
2. Navigate to Cloud Logging or Cloud Run logs
3. Filter for: `[searchUsers]` or `[TEST]`
4. Look for entries like:

```
[searchUsers] Searching for: Gia Khang searchBy: all
[searchUsers] Searching User table with terms: [ 'Gia', 'Khang' ]
[searchUsers] User table search result: { found: 1 }
[searchUsers] Found user IDs: [ '...' ]
[searchUsers] User names: Gia Khang Pham
```

### For Supabase:

1. Go to Supabase Dashboard → Logs
2. Look for API requests to `/rest/v1/User`
3. Check for any errors

---

## 🆘 Troubleshooting

### Issue: "found": 0 (No users found)

**Solutions:**
1. ✅ Verify user exists (run Step 2 again)
2. ✅ Check exact spelling in database
3. ✅ Try searching with just first name: `?query=Gia`
4. ✅ Try searching with just last name: `?query=Pham`

### Issue: Test endpoint returns error

**Common causes:**
1. **Database connection issue**
   - Check DATABASE_URL environment variable
   - Verify Supabase connection in Google Cloud

2. **Row Level Security (RLS) blocking access**
   ```sql
   -- Check RLS status
   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'User';
   
   -- If needed, add read policy
   CREATE POLICY "Enable read for authenticated users"
   ON "User" FOR SELECT
   TO authenticated
   USING (true);
   ```

3. **Deployment not complete**
   - Wait a few more minutes
   - Check deployment logs
   - Try redeploying

### Issue: AI says "couldn't find" but test endpoint works

**Solutions:**
1. **Tool not being called**
   - Check logs for `[searchUsers]` entries
   - If no logs, AI didn't call the tool
   - Try more explicit: "Use searchUsers tool to find Gia Khang"

2. **Context issue**
   - Try starting a new chat session
   - Clear any previous context

3. **Permission issue**
   - Verify AI agent has correct permissions
   - Check AgentContext userId is valid

---

## ✨ Create Test User (If Needed)

If the user doesn't exist in your database, create one for testing:

### Using Supabase Dashboard:

```sql
-- Step 1: Create User
INSERT INTO "User" (
    id,
    email,
    name,
    role,
    "emailVerified",
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid()::text,
    'giakhang.pham@example.com',
    'Gia Khang Pham',
    'FREE',
    true,
    NOW(),
    NOW()
) RETURNING id;

-- Step 2: Copy the returned 'id' and use it below

-- Step 3: Create Profile (replace USER_ID_HERE with the id from Step 1)
INSERT INTO "Profile" (
    id,
    "userId",
    subjects,
    interests,
    goals,
    "studyStyle",
    "skillLevel",
    "onlineStatus",
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid()::text,
    'USER_ID_HERE',  -- ← Replace with actual user ID
    ARRAY['Computer Science', 'Mathematics', 'Physics'],
    ARRAY['Gaming', 'Coding', 'AI'],
    ARRAY['Improve programming skills', 'Learn machine learning'],
    'VISUAL',
    'INTERMEDIATE',
    'OFFLINE',
    NOW(),
    NOW()
);
```

Then run Test 3A again!

---

## 📋 Quick Checklist

Before reporting issues, verify:

- [ ] Changes deployed to Google Cloud
- [ ] User exists in database (SQL query returns results)
- [ ] Test endpoint works (`/api/test-search-users?query=Gia`)
- [ ] Checked logs for `[searchUsers]` entries
- [ ] Tried with exact name from database
- [ ] Tried in new chat session (clear context)

---

## 📞 Still Need Help?

If tests still fail, provide:

1. **SQL Query Result** (from Step 2)
   ```
   - How many users found?
   - Exact name spelling
   - User ID
   ```

2. **Test Endpoint Response** (from Test 3A)
   ```json
   {full response here}
   ```

3. **Logs** (filtered by `[searchUsers]`)
   ```
   {relevant log entries}
   ```

4. **What you typed to AI**
   ```
   {exact query}
   ```

This will help identify exactly where the issue is!

---

## 🎉 Success Indicators

You'll know everything works when:

✅ SQL query finds the user
✅ Test endpoint returns `"found": 1` with user data
✅ AI successfully finds and displays user information
✅ Logs show `[searchUsers]` entries with found users
✅ Search works with variations: "Gia", "Khang", "Gia Khang", "Gia Khang Pham"

**That's it! The fix is complete and ready to work.** 🚀

