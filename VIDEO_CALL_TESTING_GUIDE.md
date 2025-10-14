# Video Call Testing Guide

## Quick Start Testing

### Setup (5 minutes)

1. **Start the development server:**
```bash
cd clerva-app
npm run dev
```

2. **Open two browsers:**
   - Browser 1: Chrome (normal mode)
   - Browser 2: Chrome (incognito mode)
   - Or use two different browsers (Chrome + Firefox)

3. **Sign in as different users in each browser**

---

## Test 1: Basic Video Call (2 users)

### Browser 1 - Host:
1. Navigate to study sessions: `/study-sessions`
2. Click "New Session"
3. Create a session:
   - Title: "Test Video Call"
   - Type: "One-on-One"
   - Click "Create"
4. Click "Invite Partners" (if you have connected partners)
   - Or share the session link with Browser 2
5. Click "Start Video Call" (green button in Quick Actions)

**Expected:**
- Video call opens full screen
- You see your own video
- Controls appear at bottom
- Network quality shows in top right

### Browser 2 - Participant:
1. Navigate to study sessions: `/study-sessions`
2. Accept the session invite (if invited)
   - Or join the session via URL
3. Click "Start Video Call"

**Expected:**
- Video call opens
- You see your own video AND the host's video
- Grid layout shows 2 videos
- Both users see each other

### Verify Both Browsers:
- [ ] Can see each other's video
- [ ] Can hear each other's audio (speak and listen)
- [ ] Network quality indicator shows (top right)
- [ ] Participant count shows "2 participants"

---

## Test 2: Control Functions

### Test Mute/Unmute:
1. Click the microphone button (left button)
2. **Expected:**
   - Button turns red
   - Toast: "Microphone muted 🔇"
   - Other user sees muted icon on your video
3. Click again to unmute
4. **Expected:**
   - Button turns gray
   - Toast: "Microphone unmuted 🎤"
   - Muted icon disappears

### Test Camera On/Off:
1. Click the camera button (middle button)
2. **Expected:**
   - Your video disappears
   - Placeholder with your initial shows
   - Button turns red
   - Toast: "Camera disabled 📵"
3. Click again to enable
4. **Expected:**
   - Your video appears
   - Button turns gray
   - Toast: "Camera enabled 📹"

### Test Leave Call:
1. Click the phone/leave button (right button, red)
2. **Expected:**
   - Confirmation dialog: "Are you sure you want to leave the call?"
3. Click "OK"
4. **Expected:**
   - Video call closes
   - Returns to session page
   - Other user sees "User left" notification

---

## Test 3: Multi-User (3-4 users)

**Setup:** 3-4 browser windows/devices

1. User 1: Create session and start video call
2. User 2: Join session and start video call
3. User 3: Join session and start video call
4. User 4 (optional): Join and start video call

**Verify:**
- [ ] Grid layout adjusts automatically
  - 2 users: 2 columns
  - 3-4 users: 2x2 grid
  - 5-9 users: 3x3 grid
- [ ] All videos visible
- [ ] All audio works
- [ ] No lag or freezing
- [ ] Can identify each user by name label

---

## Test 4: Error Scenarios

### Test Camera Permission Denied:
1. In browser settings, block camera access
2. Try to start video call
3. **Expected:**
   - Error message: "Camera or microphone permission denied..."
   - Retry button available
   - Cancel button available

### Test Microphone Permission Denied:
1. In browser settings, block microphone access
2. Try to start video call
3. **Expected:**
   - Clear error message
   - Helpful instructions
   - Can retry or cancel

### Test Network Issues:
1. Start a video call
2. Turn off WiFi or disconnect internet
3. **Expected:**
   - "Disconnected from call" toast
   - Network quality indicator shows red
4. Reconnect internet
5. **Expected:**
   - Should attempt to reconnect
   - Or show reconnection status

---

## Test 5: UI/UX Elements

### Check Visual Elements:
- [ ] Video tiles have rounded corners
- [ ] Name labels appear on each video
- [ ] Muted indicator (red icon) shows when mic off
- [ ] Network quality indicator color-coded
- [ ] Control buttons have clear icons
- [ ] Loading spinner during connection
- [ ] Gradient overlays for readability

### Check Notifications:
- [ ] "User joined" toast when someone joins
- [ ] "User left" toast when someone leaves
- [ ] "Connected to call" on successful join
- [ ] "Microphone muted/unmuted" on toggle
- [ ] "Camera enabled/disabled" on toggle
- [ ] "Left the call" on leave

---

## Test 6: Performance

### Monitor Performance:
1. Start video call with 2-3 users
2. Check browser DevTools > Performance
3. Monitor:
   - [ ] CPU usage (should be reasonable)
   - [ ] Memory usage (no leaks)
   - [ ] Frame rate (smooth video)
   - [ ] Network usage (within limits)

### Test Long Session:
1. Stay in call for 5-10 minutes
2. **Verify:**
   - [ ] No video/audio degradation
   - [ ] No disconnections
   - [ ] No memory leaks
   - [ ] Performance stays stable

---

## Common Issues & Solutions

### Issue: Can't see video
**Solution:**
- Check camera permissions in browser
- Check if camera is being used by another app
- Try different browser
- Check browser console for errors

### Issue: Can't hear audio
**Solution:**
- Check microphone permissions
- Check system volume
- Check if microphone is muted
- Try different browser

### Issue: "Connection failed"
**Solution:**
- Check internet connection
- Check Agora credentials in `.env.local`
- Check browser console for specific error
- Try refreshing page

### Issue: Video is laggy
**Solution:**
- Check internet speed (need 1+ Mbps)
- Close other tabs/applications
- Reduce number of participants
- Check network quality indicator

---

## Success Checklist

### Basic Functionality:
- [ ] Can start video call
- [ ] Can see own video
- [ ] Can see remote videos
- [ ] Can hear audio
- [ ] Can mute/unmute
- [ ] Can toggle camera
- [ ] Can leave call

### Multi-User:
- [ ] 2 users can call
- [ ] 3+ users can call
- [ ] Grid layout adjusts
- [ ] All users see each other
- [ ] Join/leave notifications work

### Error Handling:
- [ ] Permission errors handled
- [ ] Network errors handled
- [ ] Clear error messages
- [ ] Can retry after error

### UI/UX:
- [ ] Controls are intuitive
- [ ] Notifications appear
- [ ] Loading states show
- [ ] Professional appearance

---

## Reporting Issues

When reporting a bug, include:

1. **Browser & version:** (e.g., Chrome 120)
2. **OS:** (e.g., Windows 11, macOS 14)
3. **Steps to reproduce:**
4. **Expected behavior:**
5. **Actual behavior:**
6. **Screenshots:** (if applicable)
7. **Console errors:** (open DevTools > Console)

Example:
```
Browser: Chrome 120
OS: macOS 14
Steps:
1. Started video call
2. Clicked mute button
3. Button didn't change color

Expected: Button should turn red
Actual: Button stayed gray
Console: No errors
```

---

## Quick Test Script (5 minutes)

For rapid testing:

```
✓ Open app in 2 browsers
✓ Create session (Browser 1)
✓ Join session (Browser 2)
✓ Both: Start video call
✓ Verify: See each other
✓ Test: Mute button works
✓ Test: Camera button works
✓ Test: Can leave call
✓ Result: Pass/Fail
```

---

## Next Steps After Testing

1. **Document all bugs found**
2. **Prioritize issues** (critical, high, medium, low)
3. **Fix critical bugs first**
4. **Re-test after fixes**
5. **Move to Phase 2** (Screen Sharing)

---

*Last Updated: January 13, 2025*
*Phase: 1 - Video/Audio Integration*
