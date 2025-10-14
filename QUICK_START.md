# Phase 1 Study Sessions - Quick Start Guide

## Before Testing

### 1. Run Database Migration
Copy this SQL and run it in **Supabase SQL Editor**:

```sql
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SESSION_INVITE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SESSION_STARTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SESSION_JOINED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SESSION_ENDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SESSION_GOAL_COMPLETED';
```

### 2. Regenerate Prisma Client
```bash
cd clerva-app
npx prisma generate
```

### 3. Start Dev Server (if not already running)
```bash
npm run dev
```

---

## Quick Test (3 Minutes)

### Setup
1. Open browser window #1 (User A - Host)
2. Open browser window #2 - incognito mode (User B - Participant)
3. Log in with different accounts in each

### Test Flow

**Window 1 (User A):**
1. Go to dashboard → Click "Study Sessions" card
2. Click "+ Create New Session"
3. Enter:
   - Title: "Quick Test Session"
   - Type: Group Study
4. Click "Create Session"
5. ✅ You should see:
   - Session room page
   - Timer showing "0:00"
   - "1 online" indicator
   - Your name in participants with green dot

**Window 2 (User B):**
1. Go to `/study-sessions`
2. See "Quick Test Session" in list
3. Click "Join Session"
4. ✅ You should see:
   - Same session room
   - "2 online" indicator
   - Both users in participants

**Test Chat (Both Windows):**
1. Window 1: Type "Hello!" → Send
2. Window 2: Should see message appear instantly
3. Window 2: Reply "Hi there!" → Send
4. Window 1: Should see reply instantly
5. ✅ **Chat Works!**

**Test Goals (Both Windows):**
1. Window 1: Click "Goals" tab → "+ Add Goal"
2. Enter "Test goal 1" → Add Goal
3. Window 2: Click "Goals" tab → Should see the goal
4. Window 2: Check the checkbox
5. ✅ Goal turns green with strikethrough
6. ✅ **Goals Work!**

**Test Timer (Window 1 Only - Host):**
1. Look at sidebar timer showing "0:00"
2. Click "▶️ Start" button
3. ✅ Timer starts counting: 0:01, 0:02, 0:03...
4. ✅ Status changes to "ACTIVE"
5. Wait 10 seconds
6. Click "⏸️ Pause"
7. ✅ Timer stops (e.g., at 0:12)
8. Click "▶️ Start" again
9. ✅ Timer resumes from 0:13
10. ✅ **Timer Works!**

**Test Presence (Both Windows):**
1. Window 2: Click "Participants" tab
2. See both users with green dots
3. ✅ "2 online" shown
4. Close Window 2 completely
5. Window 1: Wait 5 seconds
6. ✅ Should show "1 online"
7. ✅ **Presence Works!**

**Test Notifications (Window 2):**
1. Reopen Window 2, log back in
2. Click notification bell icon
3. ✅ Should see "Session Started" notification
4. ✅ Should see "User A joined" notification
5. ✅ **Notifications Work!**

---

## If Something Doesn't Work

### Chat not updating?
- Check browser console for errors
- Verify Supabase Realtime is enabled
- Check SessionMessage table exists

### Goals not syncing?
- Refresh the page
- Check browser console for API errors
- Verify SessionGoal table exists

### Timer not working?
- Check you're logged in as the host
- Verify session status in database
- Check browser console

### Presence showing wrong count?
- Wait 5-10 seconds for sync
- Refresh the page
- Check Supabase Realtime status

### Notifications not appearing?
- Run the SQL migration for NotificationType
- Regenerate Prisma client
- Check Notification table exists

---

## All Features Working? 🎉

If all 5 tests pass:
1. ✅ Real-time Chat
2. ✅ Goal Management
3. ✅ Session Timer
4. ✅ Presence Indicators
5. ✅ Notifications

**Phase 1 is COMPLETE and ready for real user testing!**

---

## What's Next?

Read the full guides:
- `PHASE_1_TESTING_GUIDE.md` - Comprehensive testing scenarios
- `PHASE_1_IMPLEMENTATION_SUMMARY.md` - Technical details

Start planning Phase 2:
- Video/audio calls
- Session discovery
- Pomodoro mode
- Analytics
