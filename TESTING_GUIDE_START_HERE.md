# 🧪 NOTIFICATION SYSTEM - TESTING GUIDE

## ✅ BUILD STATUS: READY TO TEST

The app builds successfully! No critical errors found.

---

## 🚀 QUICK START - 3 STEPS

### **STEP 1: Start the App**

```bash
cd "/Users/minhpham/Documents/minh project.html/clerva-app"
npm run dev
```

Wait for: `✓ Ready in X seconds` or `Local: http://localhost:3000`

---

### **STEP 2: Open Two Browsers**

**Browser 1 (User A):**
- Open Chrome (normal mode)
- Go to: `http://localhost:3000`
- Sign in as User A

**Browser 2 (User B):**
- Open Chrome Incognito (`Cmd+Shift+N` on Mac)
- Go to: `http://localhost:3000`
- Sign in as User B (different account)

> **Why two browsers?** To test real-time notifications between two users.

---

### **STEP 3: Run the Simplest Test**

**TEST: Study Session Chat Notifications**

1. **User A:** Create a new study session
2. **User A:** Copy the session URL from browser address bar
3. **User B:** Paste URL and join the session
4. **User A:** Stay on "Timer" tab (do NOT click Chat)
5. **User B:** Click "Chat" tab
6. **User B:** Type "Hello!" and press Send

**NOW CHECK USER A's SCREEN:**

✅ **If you see ALL 3 of these → IT WORKS!**
- [ ] 🔔 Toast notification appears (top-right corner)
- [ ] 🔊 Notification sound plays (listen for "ding")
- [ ] 🔴 Red badge on "Chat" tab showing (1)

❌ **If you DON'T see something → Report which one is missing**

---

## 🔍 DETAILED TEST RESULTS FORM

Copy this and fill it out:

```
TEST 1: STUDY SESSION CHAT NOTIFICATIONS
=========================================
Date/Time: ___________
Browser: Chrome Version: ___________

SETUP:
[ ] User A logged in? Yes/No
[ ] User B logged in? Yes/No
[ ] Both in same session? Yes/No
[ ] User A on Timer tab? Yes/No
[ ] User B on Chat tab? Yes/No

USER B SENDS MESSAGE: "Hello!"

USER A SEES:
[ ] Toast notification appeared? Yes/No
    └─ If Yes: Where? (top-right / top-center / other: _______)
    └─ If No: Any error in console? (F12 → Console tab)

[ ] Sound played? Yes/No
    └─ If No: Is sound muted in browser?
    └─ If No: Any error in console?

[ ] Red badge on Chat tab? Yes/No
    └─ If Yes: Shows correct number? (1) Yes/No
    └─ If No: Badge exists but wrong number? ___

USER A CLICKS "CHAT" TAB:

[ ] Badge disappeared? Yes/No
[ ] Message "Hello!" visible? Yes/No

OVERALL RESULT:
[ ] ✅ ALL WORKING - Toast + Sound + Badge
[ ] ⚠️ PARTIAL - Only _____ working
[ ] ❌ NOT WORKING - Nothing appeared

ERRORS (if any):
Paste browser console errors here:




```

---

## 🐛 TROUBLESHOOTING

### **Problem: No toast notification**

**Check 1:** Open browser console (F12 → Console tab)
- Look for red error messages
- Common error: `Supabase is not defined`

**Fix 1:** Check `.env.local` file has:
```
NEXT_PUBLIC_SUPABASE_URL=your_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
```

**Check 2:** Is User A on the correct tab?
- User A must be on "Timer" tab (NOT Chat)
- If User A is on Chat tab, no toast will show (by design)

---

### **Problem: No sound**

**Check 1:** Browser autoplay policy
- Click anywhere on the page first
- Then have User B send message again

**Check 2:** Computer volume
- Is computer muted?
- Is browser tab muted? (look for speaker icon on tab)

**Check 3:** Browser permissions
- Some browsers block audio autoplay
- Solution: User A must click/interact with page first

---

### **Problem: No red badge**

**Check 1:** Browser console
- F12 → Console tab
- Look for React errors

**Check 2:** Refresh the page
- User A: Refresh browser (Cmd+R or Ctrl+R)
- Try sending message again

**Check 3:** Clear browser cache
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

---

### **Problem: Badge doesn't disappear**

**Expected:** Badge should disappear when User A clicks "Chat" tab

**If it doesn't disappear:**
- This is a bug in state management
- Report this - I'll fix it
- Provide: Browser, steps to reproduce

---

## 📸 WHAT TO CAPTURE

If something doesn't work, please provide:

1. **Screenshot** of browser window showing the issue
2. **Browser console** (F12 → Console tab) - copy/paste errors
3. **Network tab** (F12 → Network tab) - any failed requests (red)
4. **Steps** you took exactly

---

## ✅ SUCCESS CRITERIA

**The notification system is working if:**

- ✅ Toast appears when message received
- ✅ Sound plays (audible "ding")
- ✅ Badge shows correct unread count
- ✅ Badge disappears when viewing chat
- ✅ No errors in browser console

**If all 5 pass → System is 100% ready!** 🎉

---

## 🎯 NEXT TESTS (After First Test Passes)

### **TEST 2: Video Call Message Popup**
1. Both users join video call
2. User A leaves video, goes to Chat
3. User A sends message
4. **Check User B (in video):** Should see popup in bottom-left

### **TEST 3: Badge Persistence**
1. User A has unread messages (badge shows)
2. User A refreshes page (F5)
3. **Check:** Badge should still be there after refresh

### **TEST 4: Multiple Messages**
1. User B sends 5 messages quickly
2. **Check User A:** Badge should show (5)
3. User A clicks Chat
4. **Check:** Badge should become (0)

---

## 📞 WHAT TO REPORT BACK

After testing, tell me:

**Format:**
```
TEST RESULT: [✅ SUCCESS / ⚠️ PARTIAL / ❌ FAILED]

What worked:
- Toast: Yes/No
- Sound: Yes/No
- Badge: Yes/No

What didn't work:
- [Describe issue]

Errors (if any):
- [Paste console errors]

Browser: Chrome/Firefox/Safari
Version: [version number]
```

---

## 💡 TIPS FOR SUCCESSFUL TESTING

1. **Use TWO DIFFERENT browsers** (not two tabs)
   - Chrome normal + Chrome incognito works
   - Chrome + Firefox works
   - Safari + Chrome works

2. **Sign in as DIFFERENT users**
   - User A: one email
   - User B: different email
   - Must be actual different accounts

3. **Wait for real-time updates**
   - Sometimes takes 1-2 seconds
   - Don't spam messages too fast

4. **Keep browser console open**
   - Press F12
   - Go to Console tab
   - Watch for errors

5. **Test on localhost:3000**
   - Make sure dev server is running
   - Check terminal says "Ready"

---

## 🚦 TESTING STATUS TRACKER

Mark each as you complete:

**Phase 1: Basic Functionality**
- [ ] App starts without errors
- [ ] Two browsers can access app
- [ ] Both users can sign in
- [ ] Can create study session
- [ ] Can join study session
- [ ] Can send chat message

**Phase 2: Notification System**
- [ ] Toast notification appears
- [ ] Notification sound plays
- [ ] Badge appears on tab
- [ ] Badge shows correct count
- [ ] Badge disappears when viewing
- [ ] No console errors

**Phase 3: Advanced Features**
- [ ] Video call message popup works
- [ ] Badge persists after refresh
- [ ] Multiple messages handled correctly
- [ ] Notifications work across tabs

---

## ⏱️ ESTIMATED TIME

- **Setup (first time):** 5 minutes
- **Basic test:** 5 minutes
- **Full test suite:** 20 minutes

---

## 🆘 NEED HELP?

If you get stuck:

1. **Check browser console** for errors
2. **Read troubleshooting section** above
3. **Report back** with specific error messages
4. **I'll fix it!** Just tell me what went wrong

---

## 🎯 READY TO START?

1. ✅ Save this file
2. ✅ Open terminal
3. ✅ Run: `npm run dev`
4. ✅ Follow STEP 2 and 3 above
5. ✅ Report results!

**LET'S TEST!** 🚀
