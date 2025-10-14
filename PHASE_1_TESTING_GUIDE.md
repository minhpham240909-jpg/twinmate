# Phase 1 Study Session Features - Testing Guide

## Features Implemented ✅

### 1. Real-time Chat
- Send and receive messages in study sessions
- Auto-scroll to latest messages
- Show sender avatars and names
- Real-time updates via Supabase Realtime

### 2. Goal CRUD Operations
- Create goals with title and optional description
- Toggle goal completion (checkbox)
- Delete goals
- Visual feedback (green background when completed)
- Goals ordered by creation

### 3. Session Timer with Start/Pause
- Live timer showing elapsed session time
- Host can start/pause session
- Timer persists duration across pause/resume
- Beautiful gradient UI
- Different states for host vs participants

### 4. Notification System
- Notifications when session starts
- Notifications when someone joins
- Notifications integrated with existing system
- Action URLs link to session page

### 5. Presence Indicators
- Shows number of online users in header
- Real-time presence tracking
- Green dot for online, gray for offline in participants list
- Uses Supabase Realtime presence

## How to Test

### Prerequisites
1. Make sure dev server is running: `npm run dev`
2. Have 2 browser windows/tabs open (or use incognito for 2nd user)
3. Make sure you have at least 2 user accounts

### Test Scenario 1: Create and Join Session

**User 1 (Host):**
1. Go to dashboard
2. Click "Study Sessions" card
3. Click "Create New Session"
4. Fill in:
   - Title: "Math Study Group"
   - Description: "Working on calculus problems"
   - Type: GROUP_STUDY
   - Subject: Mathematics
5. Click "Create Session"
6. You should be redirected to session room
7. Verify you see:
   - Session title "Math Study Group"
   - Timer showing "0:00"
   - Status "SCHEDULED"
   - "1 online" indicator
   - Your name in participants (with green dot)

**User 2 (Participant):**
1. Go to "/study-sessions"
2. You should see "Math Study Group" in the list
3. Click "Join Session"
4. Verify you see the session room
5. Verify "2 online" indicator appears

**Expected Result:** ✅
- Both users can see each other in participants list
- Both have green online dots
- User 2 gets a notification "Someone joined Math Study Group"

### Test Scenario 2: Real-time Chat

**User 1:**
1. Click "Chat" tab (should be default)
2. Type "Hey, ready to study?" in chat input
3. Click "Send"

**User 2:**
1. Should immediately see User 1's message appear
2. Reply with "Yes! Let's do this"
3. Click "Send"

**Expected Result:** ✅
- Messages appear instantly for both users
- Correct avatars and names shown
- Own messages on right (blue), others on left (gray)
- Timestamps shown
- Auto-scrolls to bottom

### Test Scenario 3: Goals Management

**User 1 (Host):**
1. Click "Goals" tab
2. Click "+ Add Goal"
3. Enter title: "Complete chapter 5 problems"
4. Enter description: "Problems 1-20"
5. Click "Add Goal"
6. Verify goal appears in list

**User 2:**
1. Click "Goals" tab
2. Should see the goal User 1 created
3. Click "+ Add Goal"
4. Add goal: "Review derivatives"
5. Click "Add Goal"

**Both Users:**
1. Click checkbox next to a goal
2. Verify it turns green with strikethrough
3. Click trash icon on a goal
4. Confirm deletion
5. Verify goal disappears for both users

**Expected Result:** ✅
- Both users can create goals
- Both can complete/uncomplete any goal
- Real-time sync (may need refresh for now)
- Delete works
- Visual feedback is clear

### Test Scenario 4: Session Timer & Controls

**User 1 (Host only):**
1. Look at sidebar - see timer showing "0:00"
2. Click "▶️ Start" button
3. Verify:
   - Timer starts counting (0:01, 0:02, etc.)
   - Session status changes to "ACTIVE"
   - Button changes to "⏸️ Pause"

**User 2:**
1. Should see timer counting
2. Should see status "ACTIVE"
3. Should NOT see start/pause buttons (not host)

**User 1:**
1. Wait 30 seconds
2. Click "⏸️ Pause"
3. Verify:
   - Timer stops (e.g., at 0:32)
   - Status changes to "SCHEDULED"
   - Button changes back to "▶️ Start"
4. Click "▶️ Start" again
5. Verify timer resumes from where it stopped (0:33, 0:34...)

**Expected Result:** ✅
- Timer counts accurately
- Only host can control it
- Pause preserves duration
- Status updates correctly

### Test Scenario 5: Notifications

**User 2 (check notifications):**
1. Click notifications icon in header
2. Should see notifications:
   - "Session Started: Math Study Group has started!"
   - "New Participant: [User1] joined Math Study Group"
3. Click a notification
4. Should be taken to session page

**Expected Result:** ✅
- Notifications appear in real-time
- Clickable links work
- Correct titles and messages

### Test Scenario 6: Presence System

**User 1:**
1. Look at header - see "2 online"
2. Go to "Participants" tab
3. See both users with green dots

**User 2:**
1. Close browser tab / logout
2. Wait 5 seconds

**User 1:**
1. Should see "1 online" in header
2. In participants tab, User 2 should have gray dot

**Expected Result:** ✅
- Online count updates in real-time
- Dot colors reflect actual status
- Updates when users leave

### Test Scenario 7: End Session

**User 1 (Host):**
1. Click "End Session" in header
2. Confirm dialog
3. Verify:
   - Redirected to sessions list
   - Session status is "COMPLETED"
   - Can still view session but can't modify

**Expected Result:** ✅
- Session ends successfully
- Can view history
- No longer active

## Known Limitations (Phase 1)

❌ Video/Audio calls - Coming in Phase 2
❌ Screen sharing - Coming in Phase 2
❌ Whiteboard - Coming in Phase 3
❌ File sharing - Future
❌ Session recording - Future

## Bug Testing Checklist

- [ ] Create session with missing title (should show error)
- [ ] Try to join full session (should show error)
- [ ] Try to create goal with empty title (should show error)
- [ ] Non-host trying to start/pause session (should not see buttons)
- [ ] Test with 3+ users simultaneously
- [ ] Test chat with special characters / emojis
- [ ] Test long session (2+ hours) timer accuracy
- [ ] Refresh page mid-session (should persist state)
- [ ] Multiple goals (10+) - test scrolling
- [ ] Very long goal titles/descriptions

## Performance Checks

- [ ] Chat loads < 1 second
- [ ] Messages send < 500ms
- [ ] Goals create < 500ms
- [ ] Session list loads instantly (localStorage cache)
- [ ] Dashboard count updates < 5 seconds
- [ ] No memory leaks with long sessions

## Success Criteria

Phase 1 is **COMPLETE** when:
1. ✅ Real-time chat works reliably
2. ✅ Goals can be created, completed, deleted
3. ✅ Timer tracks session duration accurately
4. ✅ Notifications sent for key events
5. ✅ Presence shows who's online
6. ✅ No critical bugs
7. ✅ Works with 2+ simultaneous users

## Next Steps (Phase 2)

After Phase 1 testing passes:
- Video/Audio integration (Agora SDK)
- Session discovery/browse
- Pomodoro timer mode
- Session history & analytics
- Better invite system
