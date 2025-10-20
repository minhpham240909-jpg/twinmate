# 🐛 Audio Call Debug Guide

## How to Test and Check Debug Logs

I've added comprehensive debug logging to track the audio call flow. Here's how to test and see what's happening:

### Step 1: Open Browser Console

1. Go to: https://clerva-app.vercel.app
2. Sign in to your account
3. **Open Browser Console:**
   - **Chrome/Edge:** Press `F12` or `Ctrl+Shift+J` (Windows) / `Cmd+Option+J` (Mac)
   - **Firefox:** Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
   - **Safari:** Enable Developer menu first (Safari > Preferences > Advanced > "Show Develop menu"), then press `Cmd+Option+C`

### Step 2: Test Audio Call

1. Go to **Messages** (DM or Group)
2. Select a conversation
3. **Before clicking Audio Call**, make sure Console is open
4. Click the **Phone icon** (Audio Call button)
5. **Watch the console logs** - you should see:

```
📞 MessageVideoCall received callType: AUDIO → audioOnly: true
🎬 VideoCall component rendered with audioOnly: true
🎯 useVideoCall initialized with audioOnly: true
🎥 Initial localVideoEnabled: false (audioOnly: true)
```

### Step 3: Test Video Call

1. Leave the audio call (if you started one)
2. Click the **Video icon** (Video Call button)
3. **Watch the console logs** - you should see:

```
📞 MessageVideoCall received callType: VIDEO → audioOnly: false
🎬 VideoCall component rendered with audioOnly: false
🎯 useVideoCall initialized with audioOnly: false
🎥 Initial localVideoEnabled: true (audioOnly: false)
```

---

## What to Look For

### ✅ Correct Behavior (Audio Call)

**Console should show:**
```
callType: AUDIO
audioOnly: true
localVideoEnabled: false
```

**Screen should show:**
- ❌ Camera is OFF (no video from your side)
- ✅ Microphone is ON (you can speak)
- Your placeholder/avatar is shown

### ✅ Correct Behavior (Video Call)

**Console should show:**
```
callType: VIDEO
audioOnly: false
localVideoEnabled: true
```

**Screen should show:**
- ✅ Camera is ON (video from your side)
- ✅ Microphone is ON (you can speak)
- Your video feed is shown

---

## If It's Still Not Working

### Scenario 1: Console shows wrong values

**If you see:**
```
callType: AUDIO → audioOnly: false  ❌ WRONG
```

**Or:**
```
localVideoEnabled: true (audioOnly: true)  ❌ CONTRADICTION
```

**Then:** There's a logic error. Take a screenshot of the console and let me know.

### Scenario 2: Console shows correct values but camera still ON

**If you see:**
```
audioOnly: true ✅
localVideoEnabled: false ✅
```

**But camera is still ON ❌**

**Then:** The issue is in the track creation. The `createLocalTracks` function might be ignoring the `videoEnabled: false` parameter.

### Scenario 3: No console logs appear

**If you don't see any of the debug logs:**

**Then:** The deployment hasn't updated yet. Wait 1-2 minutes and refresh the page.

---

## Quick Test Checklist

Run through these tests and note the results:

### Audio Call Test:
- [ ] Click phone icon
- [ ] Console shows `callType: AUDIO` ✅
- [ ] Console shows `audioOnly: true` ✅
- [ ] Console shows `localVideoEnabled: false` ✅
- [ ] Camera stays OFF on screen ✅
- [ ] Microphone is ON ✅

### Video Call Test:
- [ ] Click video icon
- [ ] Console shows `callType: VIDEO` ✅
- [ ] Console shows `audioOnly: false` ✅
- [ ] Console shows `localVideoEnabled: true` ✅
- [ ] Camera turns ON on screen ✅
- [ ] Microphone is ON ✅

---

## What to Send Me

After testing, please share:

1. **Screenshot of browser console** showing the debug logs
2. **Which button you clicked** (Audio Call or Video Call)
3. **What happened on screen** (camera ON or OFF?)
4. **Any error messages** in the console

This will help me identify exactly where the issue is!

---

## Expected Timeline

- **Deployment:** Should be live in 1-2 minutes
- **Cache:** Clear browser cache if logs don't appear (Ctrl+Shift+Delete / Cmd+Shift+Delete)
- **Testing:** Should take 2-3 minutes total

---

*Debug logging added: October 19, 2025*
*Check console logs to diagnose audio call issue*
