# Video Call - Quick Testing Guide

## ✅ Status: READY FOR TESTING

## 🔴 CRITICAL: Test This First

### 5-Minute Video Call Test

**Goal**: Verify video/audio works between two users

**What You Need**:
- 2 browser windows (or 2 devices)
- Microphone + camera on both
- Good internet connection

**Steps**:

1. **Window 1 (Host)**:
   ```
   - Sign in to account
   - Create a study session
   - Invite a partner (use email or connection)
   - Click "Start Session"
   - Click "📹 Start Video Call" button (green button on right)
   - Click "Allow" for camera + microphone
   ```

2. **Window 2 (Partner)**:
   ```
   - Sign in with different account
   - Join the session (from invitation or session list)
   - Click "📹 Start Video Call" button
   - Click "Allow" for camera + microphone
   ```

3. **Verify**:
   ```
   ✅ Host sees their own video (small box)
   ✅ Host sees Partner's video (large box)
   ✅ Host HEARS Partner speaking
   ✅ Partner sees their own video (small box)
   ✅ Partner sees Host's video (large box)
   ✅ Partner HEARS Host speaking
   ```

**Expected Result**: 
- ✅ Video appears on both sides
- ✅ Audio works both ways
- ✅ No console errors

**If It Doesn't Work**:
1. Check browser console for errors
2. Verify environment variables are set (see below)
3. Check `STUDY_CALL_AUDIT_REPORT.md` for troubleshooting

---

## Environment Variables Check

Before testing, verify these are set in `.env.local`:

```bash
# Check if file exists
ls -la .env.local

# Should contain:
NEXT_PUBLIC_AGORA_APP_ID="your-actual-app-id"
AGORA_APP_CERTIFICATE="your-actual-certificate"
```

**Don't have these?**
1. Go to https://console.agora.io
2. Create account / sign in
3. Create a project
4. Get App ID and enable certificate
5. Add to `.env.local`
6. Restart dev server: `npm run dev`

---

## Quick Troubleshooting

### Issue: "No video appears"
**Solution**: 
- Check browser permissions (click lock icon in address bar)
- Allow camera access
- Refresh page and try again

### Issue: "No audio"
**Solution**:
- Check browser permissions (allow microphone)
- Check system volume is not muted
- Check microphone is selected in system settings

### Issue: "Failed to fetch Agora token"
**Solution**:
- Environment variables not set
- Check `.env.local` file
- Restart dev server

### Issue: "Permission denied"
**Solution**:
- User must be a participant in the session
- Check user is signed in
- Check user joined the session

---

## Success Checklist

- [ ] Video appears for both users
- [ ] Audio works both directions
- [ ] Mute button works (M key)
- [ ] Video off button works (V key)
- [ ] Screen share works (S key)
- [ ] Leave call works (ESC key)
- [ ] No console errors
- [ ] Network quality shows green/yellow

---

## Advanced Tests (Optional)

### Test Audio-Only
1. Join call
2. Click video off button
3. Verify audio still works

### Test Screen Share
1. Join call
2. Click screen share button (🖥️)
3. Select window to share
4. Verify other user sees it

### Test Reconnection
1. Join call
2. Disconnect WiFi for 10 seconds
3. Reconnect
4. Verify call recovers

---

## Browser Console Commands

Check token generation:
```javascript
// In browser console while on session page
fetch('/api/messages/agora-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ channelName: 'test' })
}).then(r => r.json()).then(console.log)

// Should show: { success: true, token: "...", appId: "..." }
```

---

## Report Issues

If video call doesn't work:

1. **Note the error message** from browser console
2. **Take screenshot** of the error
3. **Note which step failed** (from 5-Minute Test above)
4. **Check** `STUDY_CALL_AUDIT_REPORT.md` for detailed troubleshooting

**Common Issues**:
- ❌ Environment variables not set → Won't work at all
- ❌ Permissions denied → Won't access camera/mic
- ❌ User not a participant → Token generation fails
- ❌ No internet → Can't connect to Agora

---

**Status**: Ready to test! Start with the 5-Minute Test above.
