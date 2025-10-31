# AI Agent Search Analysis - Profile Fields Coverage

## ✅ Summary: All Profile Sections Are Included

After reviewing the code, I can confirm that the AI agent's `searchUsers` tool includes **ALL** profile sections, including the user's name. Here's the complete breakdown:

---

## 📋 Profile Fields Included in AI Agent Search

### From User Table ✅
Located at: `packages/ai-agent/src/tools/searchUsers.ts` lines 97-123

```typescript
const { data: users } = await supabase
  .from('User')
  .select('id, name, email, createdAt')  // ✅ NAME IS INCLUDED
  .neq('id', ctx.userId) // Excludes current user
```

**Fields fetched:**
- ✅ `id` - User ID
- ✅ `name` - **User's full name** (THIS IS WHAT YOU ASKED ABOUT)
- ✅ `email` - User email
- ✅ `createdAt` - Account creation date

### From Profile Table ✅
Located at: `packages/ai-agent/src/tools/searchUsers.ts` lines 169-177

```typescript
const { data: profiles } = await supabase
  .from('Profile')
  .select(`
    userId, subjects, interests, goals, studyStyle, skillLevel, onlineStatus,
    bio, school, languages, aboutYourself, aboutYourselfItems,
    skillLevelCustomDescription, studyStyleCustomDescription,
    availabilityCustomDescription, subjectCustomDescription, interestsCustomDescription
  `)
```

**Fields fetched:**
- ✅ `subjects` - Array of subjects
- ✅ `interests` - Array of interests
- ✅ `goals` - Array of goals
- ✅ `studyStyle` - Learning style (VISUAL, AUDITORY, etc.)
- ✅ `skillLevel` - Skill level (BEGINNER, INTERMEDIATE, etc.)
- ✅ `onlineStatus` - Current status
- ✅ `bio` - User biography
- ✅ `school` - School/institution name
- ✅ `languages` - Languages spoken
- ✅ `aboutYourself` - Detailed self-description
- ✅ `aboutYourselfItems` - Custom tags about themselves
- ✅ `skillLevelCustomDescription` - Custom skill level description
- ✅ `studyStyleCustomDescription` - Custom study style description
- ✅ `availabilityCustomDescription` - Custom availability description
- ✅ `subjectCustomDescription` - Custom subject description
- ✅ `interestsCustomDescription` - Custom interests description

### Result Mapping ✅
Located at: `packages/ai-agent/src/tools/searchUsers.ts` lines 279-304

The final result includes:
```typescript
{
  userId: userId,
  name: userInfo.name || userInfo.email,  // ✅ NAME IS MAPPED
  email: userInfo.email,
  subjects: profile?.subjects || [],
  interests: profile?.interests || [],
  goals: profile?.goals || [],
  learningStyle: profile?.studyStyle,
  skillLevel: profile?.skillLevel,
  bio: profile?.bio,
  school: profile?.school,
  languages: profile?.languages,
  aboutYourself: profile?.aboutYourself,
  aboutYourselfItems: profile?.aboutYourselfItems || [],
  skillLevelCustomDescription: profile?.skillLevelCustomDescription,
  studyStyleCustomDescription: profile?.studyStyleCustomDescription,
  availabilityCustomDescription: profile?.availabilityCustomDescription,
  subjectCustomDescription: profile?.subjectCustomDescription,
  interestsCustomDescription: profile?.interestsCustomDescription,
  // Plus additional computed fields...
}
```

---

## 🔍 How Name Search Works

### Search Logic (Lines 105-122)

The tool searches by name using **flexible multi-term matching**:

```typescript
// Splits "Gia Khang Pham" into ["Gia", "Khang", "Pham"]
const searchTerms = query.trim().split(/\s+/)

// Builds OR conditions: name ILIKE '%Gia%' OR name ILIKE '%Khang%' OR ...
const conditions: string[] = []
for (const term of searchTerms) {
  if (term.length > 0) {
    conditions.push(`name.ilike.%${term}%`)  // ✅ Searches name
    conditions.push(`email.ilike.%${term}%`) // Also searches email
  }
}

userQuery = userQuery.or(conditions.join(','))
```

**This means:**
- ✅ Searches the `name` field from User table
- ✅ Case-insensitive (ILIKE operator)
- ✅ Partial matching (finds "Gia" in "Gia Khang Pham")
- ✅ Multi-word support (searches each word separately)

---

## ⚠️ Most Likely Issue: You're Searching For Yourself

### The Self-Exclusion Filter (Line 100)

```typescript
.neq('id', ctx.userId) // Don't include current user
```

**This is BY DESIGN** - the tool automatically excludes the current logged-in user from search results.

### Why This Design?
- Partner matching shouldn't show yourself as a potential partner
- Prevents "self-matching" in the system
- Standard practice in social/matching features

### How to Check If This Is Your Issue

Run these diagnostic endpoints:

#### 1. Check Who You're Logged In As
```bash
GET /api/debug-current-user
```

**If the response shows:**
```json
{
  "authenticated": true,
  "dbUser": {
    "name": "Gia Khang Pham"  // ← If this matches your search query
  }
}
```

**Then you're trying to search for yourself!** ✅ This explains why the AI can't find them.

#### 2. Test With and Without Filter
```bash
GET /api/test-ai-search-tool?query=Gia%20Khang
```

This will show:
- Results WITH the current user filter (what AI sees)
- Results WITHOUT the filter (all matching users)
- Who is being filtered out

---

## 🧪 Diagnostic Tests to Run

### Test 1: Verify User Exists in Database

Run in Supabase SQL Editor:
```sql
SELECT 
    u.id,
    u.name,
    u.email,
    p.subjects,
    p.interests,
    p.bio
FROM "User" u
LEFT JOIN "Profile" p ON p."userId" = u.id
WHERE 
    u.name ILIKE '%Gia%'
    OR u.name ILIKE '%Khang%';
```

**Expected:** Should return at least one user

**If no results:** User doesn't exist in database

### Test 2: Check If Profile Exists

```sql
SELECT 
    u.name,
    CASE 
        WHEN p.id IS NOT NULL THEN 'Has Profile ✅'
        ELSE 'NO PROFILE ❌'
    END as profile_status
FROM "User" u
LEFT JOIN "Profile" p ON p."userId" = u.id
WHERE u.name ILIKE '%Gia%' OR u.name ILIKE '%Khang%';
```

**Expected:** Should show "Has Profile ✅"

**If "NO PROFILE":** User exists but Profile record is missing (this would cause incomplete data in AI results)

### Test 3: Test Search API Directly

```bash
# Test the search endpoint
curl -X POST http://localhost:3000/api/test-search-users \
  -H "Content-Type: application/json" \
  -d '{"query": "Gia Khang"}'
```

**Expected:** Returns matching users

**If empty:** There's an issue with the search logic or database connection

### Test 4: Check RLS Policies

Run in Supabase SQL Editor:
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('User', 'Profile');

-- Check what policies exist
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('User', 'Profile');
```

**Expected:** 
- `rowsecurity = true` for both tables
- At least one policy allowing SELECT for authenticated users or service_role

**If no policies:** RLS is blocking all access

---

## 🐛 Potential Issues & Solutions

### Issue 1: Searching for Yourself ⚠️ (Most Likely)

**Symptom:** AI says "can't find user" but user exists

**Diagnosis:**
```bash
curl /api/debug-current-user
# Check if dbUser.name matches your search query
```

**Solution:** Search for a DIFFERENT user, not yourself

**Alternative:** Create a second test user and log in as them, then search for the first user

---

### Issue 2: Profile Record Missing

**Symptom:** User found but AI shows incomplete information

**Diagnosis:**
```sql
SELECT u.name, p.id as profile_id
FROM "User" u
LEFT JOIN "Profile" p ON p."userId" = u.id
WHERE u.name ILIKE '%Gia%';
```

**Solution:** Create Profile record for the user
```sql
INSERT INTO "Profile" (
    id, "userId", subjects, interests,
    "studyStyle", "skillLevel", "onlineStatus",
    "createdAt", "updatedAt"
) VALUES (
    gen_random_uuid()::text,
    'USER_ID_HERE',  -- Replace with actual user ID
    ARRAY['Math']::text[],
    ARRAY['Coding']::text[],
    'VISUAL',
    'BEGINNER',
    'OFFLINE',
    NOW(),
    NOW()
);
```

---

### Issue 3: RLS Blocking Access

**Symptom:** Database queries fail or return empty even though data exists

**Diagnosis:**
```sql
-- Try as authenticated user (should work with service_role)
SELECT COUNT(*) FROM "User";
```

**Solution:** Ensure RLS policies allow service_role access
```sql
-- Allow service_role full access (should already exist from enable_rls_security.sql)
CREATE POLICY "Allow service role full access to User" ON "User"
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

---

### Issue 4: AI Not Calling the Tool

**Symptom:** No `[searchUsers]` logs in console

**Diagnosis:** Check Google Cloud logs for `[searchUsers]` entries

**Solution:** Use more explicit prompts:
- ❌ Bad: "Gia Khang"
- ✅ Good: "Search for user named Gia Khang"
- ✅ Good: "Find Gia Khang in the database"
- ✅ Good: "Use searchUsers tool to look for Gia Khang"

---

## ✅ Verification Checklist

Run through these steps in order:

- [ ] **Step 1:** Run Test 1 (verify user exists)
  - If fails → Create user first
  
- [ ] **Step 2:** Run Test 2 (verify profile exists)
  - If fails → Create profile record
  
- [ ] **Step 3:** Check who you're logged in as (`/api/debug-current-user`)
  - If searching for yourself → Search for different user
  
- [ ] **Step 4:** Test search directly (`/api/test-search-users`)
  - If fails → Check RLS policies (Test 4)
  
- [ ] **Step 5:** Try AI search with explicit command
  - If fails → Check logs for errors

---

## 📊 Quick Decision Tree

```
AI can't find user
  │
  ├─ Check: Who am I logged in as?
  │    └─ If searching for yourself → ⚠️ That's the issue!
  │
  ├─ Check: Does user exist in database? (Test 1)
  │    └─ If NO → Create user
  │
  ├─ Check: Does user have Profile record? (Test 2)
  │    └─ If NO → Create profile
  │
  ├─ Check: Can I search directly via API? (Test 3)
  │    └─ If NO → Check RLS policies (Test 4)
  │
  └─ Check: Is AI calling the tool?
       └─ If NO → Use more explicit commands
```

---

## 🎯 Conclusion

**The AI agent search includes ALL profile sections, including name.** ✅

The most common reason for "can't find user" is:
1. **Searching for yourself** (filtered out by design)
2. Profile record missing
3. RLS policies blocking access

**Next Steps:**
1. Run `/api/debug-current-user` to check who you're logged in as
2. If you're searching for yourself, search for a different user
3. If searching for someone else, run the diagnostic tests above

Let me know what you find and I can help debug further!

