# Settings System Deployment Guide

## 🎉 Overview

A comprehensive settings system has been implemented for Clerva with full RLS (Row Level Security) protection. This guide will help you deploy and test the new settings functionality.

---

## 📋 What Was Built

### 1. Database Schema
- **UserSettings** table with comprehensive fields for all app features
- **BlockedUser** table for privacy management
- Full RLS policies ensuring users can only access their own settings
- Auto-update triggers for `updatedAt` timestamp
- Default settings creation for existing users

### 2. API Routes (with RLS Security)
- **GET `/api/settings`** - Fetch user settings
- **POST `/api/settings/update`** - Update user settings
- **POST `/api/settings/block-user`** - Block a user
- **DELETE `/api/settings/block-user`** - Unblock a user
- **GET `/api/settings/block-user`** - Get blocked users list

### 3. Settings Page (`/settings`)
Comprehensive tabbed interface with 13 categories:
1. **Account & Profile** - Language, timezone
2. **Privacy & Visibility** - Profile visibility, search appearance, online status
3. **Notifications** - In-app & email preferences, Do Not Disturb
4. **Study** - Default durations, quiz generation, flashcard frequency
5. **Communication** - Messaging, video/audio quality, call settings
6. **Sessions** - Timer preferences, history retention, invite privacy
7. **Groups** - Default privacy, notifications, auto-join
8. **Community** - Feed algorithm, interaction privacy
9. **Accessibility** - Theme, font size, color blind modes
10. **Data & Storage** - Cache, backup, data management
11. **Integrations** - Google Calendar sync, connected accounts
12. **Advanced** - Developer mode, beta features, performance mode
13. **About** - App info, legal links, support

### 4. Navigation
- Settings link added to avatar dropdown in dashboard
- Breadcrumb navigation with back button
- Real-time change detection with save/discard buttons

---

## 🚀 Deployment Steps

### Step 1: Run Database Migration

Run the SQL migration to create tables and RLS policies:

```bash
# Option A: Using Supabase CLI (recommended)
supabase db push

# Option B: Run SQL directly in Supabase Dashboard
# Navigate to: SQL Editor > New Query
# Copy and paste the contents of:
# prisma/migrations/add_user_settings_with_rls.sql
# Then click "Run"
```

### Step 2: Update Prisma Schema

The Prisma schema has already been updated. Generate the Prisma client:

```bash
cd clerva-app
npx prisma generate
```

### Step 3: Verify Database

Check that tables were created successfully:

```sql
-- Run in Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('UserSettings', 'BlockedUser');

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('UserSettings', 'BlockedUser');
```

Expected output:
- Both tables should exist
- `rowsecurity` should be `true` for both

### Step 4: Test RLS Policies

Verify RLS policies are working:

```sql
-- Run as authenticated user (should work)
SELECT * FROM "UserSettings" WHERE "userId" = auth.uid()::text;

-- Try to access another user's settings (should fail)
SELECT * FROM "UserSettings" WHERE "userId" != auth.uid()::text;
```

### Step 5: Restart Development Server

```bash
npm run dev
```

### Step 6: Test the Settings Page

1. Navigate to `http://localhost:3000/dashboard`
2. Click on your avatar in the top right
3. Click "Settings" in the dropdown
4. Verify all tabs load correctly
5. Make a change (e.g., toggle a setting)
6. Click "Save Changes"
7. Refresh the page and verify changes persist

---

## 🔒 RLS Security Verification

### Verify User Isolation

Test that users can only access their own settings:

```sql
-- As User A (logged in)
-- This should work
SELECT * FROM "UserSettings" WHERE "userId" = auth.uid()::text;

-- This should return no rows (even if User B's ID is known)
SELECT * FROM "UserSettings" WHERE "userId" = '<user-b-id>';
```

### Verify Insert Protection

```sql
-- Users cannot insert settings for other users
INSERT INTO "UserSettings" ("userId") VALUES ('<another-user-id>');
-- Should fail with RLS policy violation
```

### Verify Update Protection

```sql
-- Users cannot update other users' settings
UPDATE "UserSettings" SET "language" = 'es' WHERE "userId" = '<another-user-id>';
-- Should update 0 rows
```

---

## 🧪 Testing Checklist

### Manual Testing

- [ ] **Navigation**
  - [ ] Settings link appears in avatar dropdown
  - [ ] Settings page loads without errors
  - [ ] Back button returns to dashboard

- [ ] **Tab Navigation**
  - [ ] All 13 tabs render correctly
  - [ ] Active tab is highlighted
  - [ ] Content updates when switching tabs

- [ ] **Settings Persistence**
  - [ ] Toggle a setting → Save → Refresh → Verify it persisted
  - [ ] Change multiple settings → Save → Verify all saved
  - [ ] Change setting → Discard → Verify reverted

- [ ] **Account & Profile**
  - [ ] Language dropdown works
  - [ ] Timezone dropdown works
  - [ ] Settings save correctly

- [ ] **Privacy & Visibility**
  - [ ] Profile visibility dropdown works
  - [ ] Toggle switches work
  - [ ] Data sharing dropdown works

- [ ] **Notifications**
  - [ ] All notification toggles work
  - [ ] Email notification toggles work
  - [ ] Notification frequency dropdown works
  - [ ] Do Not Disturb enable/disable works
  - [ ] Time pickers work when DND is enabled

- [ ] **Study Preferences**
  - [ ] Number inputs work (study/break duration)
  - [ ] Values stay within min/max bounds
  - [ ] Flashcard frequency dropdown works

- [ ] **Communication**
  - [ ] Video/audio quality dropdowns work
  - [ ] All toggles work
  - [ ] Settings save correctly

- [ ] **Sessions**
  - [ ] Timer settings work
  - [ ] Session invite privacy dropdown works

- [ ] **Groups**
  - [ ] Default privacy dropdown works
  - [ ] Group toggles work

- [ ] **Community**
  - [ ] Feed algorithm dropdown works
  - [ ] Privacy dropdowns work

- [ ] **Accessibility**
  - [ ] Theme dropdown changes (Light/Dark/System)
  - [ ] Font size dropdown works
  - [ ] Accessibility toggles work
  - [ ] Color blind mode dropdown works

- [ ] **Data & Storage**
  - [ ] Storage toggles work
  - [ ] Number input for storage limit works
  - [ ] Clear cache button displays (functionality TBD)
  - [ ] Export data button displays (functionality TBD)
  - [ ] Delete account button displays (functionality TBD)

- [ ] **Integrations**
  - [ ] Google Calendar toggle works
  - [ ] Calendar ID input appears when enabled
  - [ ] Connected accounts section displays

- [ ] **Advanced**
  - [ ] Developer mode toggle works
  - [ ] Beta features toggle works
  - [ ] Performance mode dropdown works
  - [ ] Analytics toggle works

- [ ] **About**
  - [ ] App version displays
  - [ ] Legal links display
  - [ ] Support links display

### API Testing

Test each endpoint with curl or Postman:

```bash
# Get settings
curl http://localhost:3000/api/settings \
  -H "Cookie: <your-session-cookie>"

# Update settings
curl -X POST http://localhost:3000/api/settings/update \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"theme": "DARK", "fontSize": "LARGE"}'

# Block a user
curl -X POST http://localhost:3000/api/settings/block-user \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"blockedUserId": "<user-id>", "reason": "Test"}'

# Get blocked users
curl http://localhost:3000/api/settings/block-user \
  -H "Cookie: <your-session-cookie>"

# Unblock a user
curl -X DELETE "http://localhost:3000/api/settings/block-user?blockedUserId=<user-id>" \
  -H "Cookie: <your-session-cookie>"
```

### Error Handling

- [ ] **Unauthenticated access**
  - Try accessing `/settings` without logging in
  - Should redirect to `/auth/signin`

- [ ] **Invalid data**
  - Try sending invalid enum values
  - Try sending numbers outside min/max range
  - Should return 400 with validation errors

- [ ] **Network errors**
  - Simulate network failure during save
  - Should show error toast

---

## 🐛 Troubleshooting

### Issue: "Table UserSettings does not exist"
**Solution:** Run the database migration:
```bash
# Run: prisma/migrations/add_user_settings_with_rls.sql
```

### Issue: "RLS policy violation"
**Solution:** Check that RLS policies are created:
```sql
SELECT * FROM pg_policies WHERE tablename = 'UserSettings';
```

### Issue: Settings not saving
**Solution:** 
1. Check browser console for errors
2. Check API logs in terminal
3. Verify Supabase connection
4. Test with curl to isolate frontend vs backend issue

### Issue: "Prisma Client has not been generated"
**Solution:**
```bash
npx prisma generate
```

### Issue: TypeScript errors
**Solution:**
```bash
npm run typecheck
```

---

## 📊 Database Indexes

The migration includes these indexes for performance:

```sql
-- UserSettings
CREATE INDEX "UserSettings_userId_idx" ON "UserSettings"("userId");

-- BlockedUser
CREATE INDEX "BlockedUser_userId_idx" ON "BlockedUser"("userId");
CREATE INDEX "BlockedUser_blockedUserId_idx" ON "BlockedUser"("blockedUserId");
```

---

## 🔐 Security Features

### Row Level Security (RLS)
All settings are protected by RLS policies that ensure:
- Users can only view their own settings
- Users can only update their own settings
- Users can only delete their own settings
- Users cannot insert settings for other users

### Data Validation
All API endpoints use Zod for input validation:
- Type checking
- Min/max value enforcement
- Enum validation
- Required field checking

### Authentication
All API routes verify authentication using Supabase:
```typescript
const supabase = await createClient()
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) return 401
```

---

## 🎨 UI Features

### Real-time Change Detection
- Tracks unsaved changes
- Shows save/discard buttons when changes detected
- Prevents accidental data loss

### Responsive Design
- Desktop: Sidebar navigation
- Mobile: Floating save button
- Works on all screen sizes

### Accessibility
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support
- Reduced motion support

---

## 🚧 Future Enhancements

### Phase 2 (Optional)
- [ ] Implement "Clear Cache" functionality
- [ ] Implement "Export Data" (GDPR compliance)
- [ ] Implement "Delete Account" with confirmation
- [ ] Add password change functionality
- [ ] Add 2FA settings
- [ ] Add session management (view/revoke active sessions)
- [ ] Add blocked users management UI
- [ ] Implement push notification registration
- [ ] Add email service for email notification preferences
- [ ] Add keyboard shortcuts legend
- [ ] Add search within settings

### Phase 3 (Advanced)
- [ ] Settings sync across devices (real-time)
- [ ] Settings import/export
- [ ] Settings presets (e.g., "Focus Mode")
- [ ] Settings history/audit log
- [ ] Admin override settings

---

## 📝 Notes

### Theme Implementation
The theme setting is stored but not yet applied globally. To implement:
1. Create a theme context provider
2. Apply theme class to `<html>` element
3. Update Tailwind config for dark mode

### Email Notifications
Email notification preferences are stored but email service needs to be configured:
- Set up email service (Resend, SendGrid, etc.)
- Create email templates
- Implement email sending logic in notification system

### Google Calendar Integration
Calendar sync toggle is available but integration needs:
- Google OAuth setup
- Calendar API implementation
- Event creation/sync logic

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] Run database migration in production Supabase
- [ ] Verify RLS policies are active
- [ ] Test settings page in production
- [ ] Verify all API endpoints work
- [ ] Test with multiple user accounts
- [ ] Check mobile responsiveness
- [ ] Review error handling
- [ ] Monitor performance (query times)
- [ ] Set up error tracking (Sentry)
- [ ] Update documentation
- [ ] Train support team on new settings

---

## 🎯 Success Metrics

Monitor these metrics post-deployment:

- **Adoption Rate**: % of users who visit settings page
- **Settings Changes**: Average changes per user
- **Most Used Settings**: Which settings are changed most
- **Error Rate**: API error percentage
- **Load Time**: Settings page load time
- **Save Success Rate**: % of successful saves

---

## 📞 Support

If you encounter issues:

1. Check this guide first
2. Review browser console errors
3. Check API logs in terminal
4. Verify Supabase connection
5. Test RLS policies manually
6. Contact development team

---

**Built with ❤️ for Clerva**

Settings system completed: November 3, 2025

