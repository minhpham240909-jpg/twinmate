# 🧪 NOTIFICATION SYSTEM TESTING GUIDE

## ✅ WHAT WE IMPLEMENTED

1. **Study Session Chat Notifications** - Toast + Sound + Badge
2. **Video Call Message Popups** - In-call floating messages
3. **Connection Request Notifications** - Database notifications
4. **Direct Message Notifications** - Database notifications
5. **Group Message Notifications** - Database notifications
6. **Group Invite Notifications** - Database notifications
7. **Group Removal Notifications** - Database notifications

---

## 🚀 QUICK START TESTING

### **EASIEST TEST (Start Here):**

**TEST: Study Session Chat Notifications**

1. **Open TWO browser windows:**
   - Window 1: Regular Chrome
   - Window 2: Chrome Incognito (or different browser)

2. **In BOTH windows:**
   - Go to `http://localhost:3000`
   - Sign in with DIFFERENT users

3. **Create a study session:**
   - User A: Create a new study session
   - User A: Note the session URL (copy it)
   - User B: Paste URL and join the session

4. **Test the notifications:**
   - User A: Stay on "Timer" tab
   - User B: Go to "Chat" tab
   - User B: Type message "Hello!" and send
   - **CHECK User A's screen:** Should see:
     - 🔔 Toast notification (top-right)
     - 🔊 Sound plays
     - 🔴 Red badge on "Chat" tab showing (1)

5. **If you see all 3 things above → ✅ IT WORKS!**

---

## 🔍 IF SOMETHING DOESN'T WORK

### **Problem 1: No toast notification appears**

**Check browser console (F12 → Console tab):**
- Look for errors
- If you see "Supabase" errors → Check your `.env` file

**Fix:**
```bash
# In terminal:
cd clerva-app
cat .env | grep SUPABASE
# Should see NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

### **Problem 2: No sound plays**

**Possible cause:** Browser blocking autoplay

**Fix:**
1. Click anywhere on the page first (interact with it)
2. Try sending another message
3. Check browser sound settings (unmute)

---

### **Problem 3: No red badge appears**

**Check:**
1. Are you on the correct tab? (User A should be on "Timer" tab)
2. Refresh the page and try again
3. Open browser console for errors

---

### **Problem 4: Badge doesn't disappear**

**Expected:** Badge should disappear when you click "Chat" tab

**If it doesn't:**
- This is a state management issue
- Report this and I'll fix it

---

## 🎯 WHAT TO REPORT BACK

Please test and tell me:

1. ✅ **WORKS** or ❌ **DOESN'T WORK**: Toast notification
2. ✅ **WORKS** or ❌ **DOESN'T WORK**: Sound
3. ✅ **WORKS** or ❌ **DOESN'T WORK**: Red badge
4. ✅ **WORKS** or ❌ **DOESN'T WORK**: Badge disappears when clicking Chat tab

**If any don't work, copy/paste any error messages from browser console (F12)**

---

## 🚀 NEXT LEVEL TESTING (After basic test works)

### **Test 2: Video Call Message Popup**

1. Both users in same study session
2. Both click "Start Video Call"
3. User A leaves video call
4. User A sends message in chat
5. **CHECK User B's video screen:** Should see popup in bottom-left corner

### **Test 3: Direct Messages**

1. Go to Messages/Chat page
2. Send DM to connected partner
3. **CHECK partner's screen:** Should see toast + notification badge

---

## 📝 TESTING CHECKLIST

Copy this and fill it out:

```
[ ] Study Session Chat - Toast appears
[ ] Study Session Chat - Sound plays
[ ] Study Session Chat - Badge shows on tab
[ ] Study Session Chat - Badge clears when viewing
[ ] Video Call - Popup appears during call
[ ] Direct Message - Notification appears
[ ] Group Message - Notification appears
```

---

## 🛠️ DEBUGGING COMMANDS

If things don't work, run these in terminal:

```bash
# Check if Supabase is configured
cd clerva-app
cat .env | grep SUPABASE

# Check if database is accessible
npm run db:studio
# Opens Prisma Studio to view database

# Restart dev server
npm run dev
```

---

## 💡 TIPS

1. **Use two different browsers** (not two tabs in same browser)
2. **Clear browser cache** if things act weird (Cmd+Shift+R on Mac)
3. **Check browser console** for error messages (F12)
4. **Test on localhost:3000** (make sure app is running)

---

## ✅ SUCCESS CRITERIA

**The notification system works if:**
- ✅ Toast appears when message received
- ✅ Sound plays (can hear it)
- ✅ Badge appears with number
- ✅ Badge disappears when viewed
- ✅ No console errors

**If all 5 work → System is 100% functional!** 🎉
