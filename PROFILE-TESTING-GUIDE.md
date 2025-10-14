# Profile Page Testing Guide

## ⚠️ IMPORTANT: Setup Required First

Before testing, you MUST set up Supabase Storage:

1. Open [SUPABASE-STORAGE-SETUP.md](./SUPABASE-STORAGE-SETUP.md)
2. Follow ALL steps to create the storage bucket and policies
3. **Image uploads will NOT work until you complete this setup**

## Test as a Real User

### Step 1: Login to Your Account

1. Go to http://localhost:3000
2. Sign in with your existing account or create a new one

### Step 2: Navigate to Profile

1. From dashboard, click **"Complete Your Profile"** button
2. You should see the Edit Profile page

### Step 3: Test Profile Picture Upload

✅ **What to test:**
- Click "Upload Profile Picture"
- Select an image from your computer (JPG, PNG, or GIF)
- Verify image preview appears immediately
- Image should be under 5MB
- Try uploading a non-image file (should show error)
- Try uploading a file over 5MB (should show error)

### Step 4: Test Basic Fields

✅ **What to test:**
- Enter your full name
- Write a bio about yourself
- Save and verify data persists after refresh

### Step 5: Test Subjects with Custom Input

✅ **What to test:**
1. Click on suggested subjects (Mathematics, Physics, etc.)
2. Selected subjects should turn blue
3. Type "Quantum Mechanics" in the custom input field
4. Click "Add" or press Enter
5. "Quantum Mechanics" should appear as a blue pill with an × button
6. Click the × to remove custom subjects
7. Save and verify ALL subjects (suggested + custom) are saved

### Step 6: Test Learning Interests with Custom Input

✅ **What to test:**
1. Click on suggested interests (Group Study, One-on-One, etc.)
2. Selected interests should turn purple
3. Type "Machine Learning Projects" in custom input
4. Click "Add"
5. Verify it appears with × button
6. Remove and add multiple custom interests
7. Save and verify persistence

### Step 7: Test Learning Goals with Custom Input

✅ **What to test:**
1. Click on suggested goals (Pass Exam, Learn New Skill, etc.)
2. Selected goals should turn green
3. Type "Build a Startup" in custom input
4. Click "Add"
5. Verify it appears with × button
6. Save and verify persistence

### Step 8: Test Skill Level with Description

✅ **What to test:**
1. Select a skill level from dropdown (Beginner/Intermediate/Advanced/Expert)
2. Type description: "I've completed 2 calculus courses and am working on differential equations"
3. Save (note: description shows in form but we'll add database field for it later)

### Step 9: Test Study Style with Description

✅ **What to test:**
1. Select study style (Collaborative/Independent/Mixed)
2. Type description: "I prefer morning study sessions with 1-2 partners"
3. Save

### Step 10: Test Availability

✅ **What to test:**
1. Click on days you're available (Mon, Tue, Wed, etc.)
2. Selected days should turn indigo
3. Enter typical hours: "6-9 PM"
4. Enter detailed description: "Free on weekends, prefer evening sessions on weekdays"
5. Save and verify ALL availability data persists

### Step 11: Save Profile

✅ **What to test:**
1. Fill in ALL fields with test data
2. Click "Save Profile"
3. Should see "Profile saved successfully!" alert
4. Should redirect to /dashboard
5. Go back to profile page
6. **Verify ALL data is still there** (no data loss)

### Step 12: Test Database Persistence

✅ **What to test:**
1. Save your profile with data in ALL fields
2. Sign out
3. Sign in again
4. Go to profile page
5. Verify ALL data loaded correctly from database

## Expected Behavior

### ✅ Should Work:
- Upload images (JPG, PNG, GIF under 5MB)
- Add/remove suggested items by clicking
- Add custom items using text input + Add button
- Add custom items by pressing Enter in text input
- Remove custom items by clicking ×
- Select multiple days for availability
- Save all data to real Supabase database
- Data persists across sessions

### ❌ Should Show Errors:
- Uploading non-image files
- Uploading files over 5MB
- Saving without being authenticated

## Common Issues

### Image Upload Fails
**Cause**: Supabase storage bucket not set up
**Fix**: Follow [SUPABASE-STORAGE-SETUP.md](./SUPABASE-STORAGE-SETUP.md)

### "Failed to save profile"
**Cause**: Not authenticated or network error
**Fix**: Sign out and sign in again, check console for errors

### Data Not Persisting
**Cause**: Database connection issue
**Fix**: Check `.env.local` has correct DATABASE_URL with pooled connection

## Success Criteria

✅ All checkmarks above completed
✅ No errors in browser console
✅ Data persists after refresh
✅ Data persists after logout/login
✅ Custom items can be added and removed
✅ Images upload successfully (after Supabase setup)

---

**Ready to test?** Start with Step 1 and work through each step methodically!
