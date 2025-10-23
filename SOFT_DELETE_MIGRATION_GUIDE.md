# Soft Delete Migration Guide with RLS Security

## ✅ What Has Been Completed

### 1. Code Changes (Already Deployed)
- ✅ Soft delete functionality implemented in backend
- ✅ Post History UI added to Profile page
- ✅ All API endpoints updated
- ✅ TypeScript/ESLint errors fixed
- ✅ Code committed to GitHub
- ✅ Deployed to Vercel production

### 2. Database Changes (You Need to Run This)
- ⏳ **PENDING:** SQL migration with RLS security

---

## 🚀 How to Run the Migration

### Step 1: Go to Your Supabase Dashboard
1. Open your browser and go to: https://supabase.com/dashboard
2. Select your project: `clerva` or similar
3. Click on **SQL Editor** in the left sidebar

### Step 2: Run the Complete Migration
Copy and paste the **entire contents** of the file `add_soft_delete_with_rls.sql` into the SQL Editor.

**File location:** `/clerva-app/add_soft_delete_with_rls.sql`

### Step 3: Execute the Migration
1. Click the **RUN** button (or press `Ctrl+Enter` / `Cmd+Enter`)
2. Wait for execution to complete (usually 2-3 seconds)
3. Check the results panel for success messages

---

## ✅ Expected Success Messages

After running the migration, you should see these messages:

```
NOTICE:  ✅ Added isDeleted column to Post table
NOTICE:  ✅ Added deletedAt column to Post table
NOTICE:  ========================================
NOTICE:  SOFT DELETE MIGRATION COMPLETE!
NOTICE:  ========================================
NOTICE:  ✅ isDeleted column: EXISTS
NOTICE:  ✅ deletedAt column: EXISTS
NOTICE:  ✅ Post table RLS policies: 5 total
NOTICE:  ✅ Indexes created: isDeleted_idx, deletedAt_idx
NOTICE:
NOTICE:  RLS Security Updates:
NOTICE:    • Deleted posts hidden from regular queries
NOTICE:    • Users can view their own deleted posts
NOTICE:    • Likes/comments/reposts on deleted posts hidden
NOTICE:    • Soft delete and restore enabled via UPDATE policy
NOTICE:
NOTICE:  ========================================
NOTICE:  ✅ READY TO USE SOFT DELETE FEATURE!
NOTICE:  ========================================
```

---

## 🔒 RLS Security Features

The migration includes comprehensive Row Level Security:

### 1. **Main Post Table Policies**
- **SELECT (Regular):** Excludes deleted posts (`isDeleted = false`)
- **SELECT (Deleted):** Users can view their own deleted posts only
- **UPDATE:** Users can soft delete/restore their own posts
- **DELETE:** Users can permanently delete their own posts

### 2. **Related Tables Policies**
- **PostLike:** Hides likes on deleted posts
- **PostComment:** Hides comments on deleted posts
- **PostRepost:** Hides reposts of deleted posts

### 3. **Privacy Integration**
- Respects existing privacy settings (PUBLIC/PARTNERS_ONLY)
- Deleted posts are hidden regardless of privacy setting
- Only post owner can view their deleted posts

---

## 🛡️ Safety Features

The migration is **idempotent** and safe to run multiple times:

✅ **Column Existence Check:** Won't fail if columns already exist
✅ **Policy Drop-and-Recreate:** Updates policies cleanly
✅ **Index IF NOT EXISTS:** Skips if indexes already exist
✅ **Transaction Safety:** All changes in single transaction
✅ **Verification:** Checks and reports success at the end

---

## ⚠️ Important Notes

### 1. **Run Only Once**
While the migration is safe to run multiple times, you only need to run it **once** after deployment.

### 2. **No Data Loss**
This migration only **adds** columns and **updates** policies. It does NOT:
- Delete any existing data
- Remove any columns
- Drop any tables

### 3. **Existing Posts**
All existing posts will have:
- `isDeleted = false` (default)
- `deletedAt = null` (not deleted)

### 4. **Backwards Compatible**
The API endpoints handle both old posts (without soft delete fields) and new posts seamlessly.

---

## 🧪 How to Test After Migration

### 1. **Test Soft Delete**
1. Go to Community page
2. Create a test post
3. Click Delete on the post
4. Confirm: "This post will be deleted for 30 days..."
5. Post should disappear from feed ✅

### 2. **Test Post History**
1. Go to Profile page
2. Click "Show History" in Post History section
3. You should see your deleted post with:
   - "DELETED" badge
   - Days remaining countdown
   - Restore button
   - Delete Forever button ✅

### 3. **Test Restore**
1. In Post History, click "Restore" on a deleted post
2. Post should reappear in Community feed ✅

### 4. **Test RLS Security**
1. Try to view another user's deleted posts
2. You should NOT be able to see them ✅
3. Only your own deleted posts are visible ✅

---

## 📋 Migration Checklist

- [ ] Open Supabase Dashboard
- [ ] Navigate to SQL Editor
- [ ] Copy contents of `add_soft_delete_with_rls.sql`
- [ ] Paste into SQL Editor
- [ ] Click RUN
- [ ] Verify success messages appear
- [ ] Test soft delete functionality
- [ ] Test Post History view
- [ ] Test restore functionality
- [ ] Verify RLS security (deleted posts hidden)

---

## 🐛 Troubleshooting

### Problem: "Column already exists" error
**Solution:** This is expected if you run the migration twice. The migration will skip adding the column and show a warning message. This is safe.

### Problem: "Policy already exists" error
**Solution:** The migration uses `DROP POLICY IF EXISTS` before creating policies, so this shouldn't happen. If it does, the policies will be recreated correctly.

### Problem: "Posts not appearing in Post History"
**Solution:**
1. Make sure you ran the migration in Supabase
2. Check browser console for API errors
3. Verify you're logged in
4. Try refreshing the page

### Problem: "Deleted posts still visible in feed"
**Solution:**
1. Clear browser cache
2. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
3. Verify the migration completed successfully
4. Check that RLS policies were created

---

## 📞 Support

If you encounter any issues:

1. **Check Migration Output:** Look for error messages in Supabase SQL Editor
2. **Verify Deployment:** Make sure latest code is deployed to Vercel
3. **Check Browser Console:** Look for JavaScript errors
4. **Database State:** Query the Post table to verify columns exist:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'Post'
   AND column_name IN ('isDeleted', 'deletedAt');
   ```

---

## 🎉 Summary

**This migration adds:**
- ✅ 2 new columns to Post table
- ✅ 2 new indexes for performance
- ✅ 5 RLS policies for security
- ✅ Complete soft delete functionality
- ✅ 30-day restoration window
- ✅ Automatic cleanup system

**Run this migration once, and you're all set!** 🚀
