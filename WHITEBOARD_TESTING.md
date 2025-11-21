# Whiteboard Feature - Quick Testing Guide

## ✅ Status: READY FOR TESTING

## Quick Start

```bash
npm run dev
# Open http://localhost:3000
```

## Test Scenarios

### Test 1: Basic Functionality (2 minutes)

**Goal**: Verify whiteboard appears and persists

**Steps**:
1. Sign in to your account
2. Create or join a study session
3. Click the "🎨 Whiteboard" tab
4. Draw something:
   - Click "Draw" (D) tool on left toolbar
   - Draw a few shapes
   - Add some text (T tool)
   - Add an arrow
5. ✅ **Verify**: Drawings stay visible (don't disappear)
6. Refresh the page (Cmd+R / F5)
7. Click "Whiteboard" tab again
8. ✅ **Verify**: Your drawings are still there

**Expected Result**: 
- ✅ Whiteboard loads without disappearing
- ✅ Drawings persist after page refresh
- ✅ No console errors

---

### Test 2: Auto-Save (1 minute)

**Goal**: Verify auto-save functionality works

**Steps**:
1. Open whiteboard
2. Draw something
3. Look at the top right corner
4. ✅ **Verify**: "Saving..." indicator appears
5. Open browser DevTools console (F12)
6. Wait 2-3 seconds
7. ✅ **Verify**: Console shows `[Whiteboard] Saved to backend, version: X`
8. Look at version number below the header
9. Draw more
10. ✅ **Verify**: Version number increments

**Expected Result**:
- ✅ "Saving..." indicator appears when drawing
- ✅ Console confirms backend save
- ✅ Version number increments with each save

---

### Test 3: Real-time Collaboration (3 minutes)

**Goal**: Verify multiple users can see each other's drawings

**Steps**:
1. Open the same session in **two browser tabs** (or Incognito + regular)
2. Sign in to both (can use same account or different)
3. In **Tab 1**: Draw a red circle
4. Switch to **Tab 2**
5. ✅ **Verify**: Red circle appears in Tab 2 (wait 2-5 seconds)
6. In **Tab 2**: Draw a blue square
7. Switch to **Tab 1**
8. ✅ **Verify**: Blue square appears in Tab 1

**Expected Result**:
- ✅ Drawings sync between tabs within 2-5 seconds
- ✅ Both users see all drawings
- ✅ No conflicts or overwrites

---

### Test 4: Offline Mode (2 minutes)

**Goal**: Verify localStorage persistence works offline

**Steps**:
1. Open whiteboard
2. Draw something
3. Open DevTools (F12) → Network tab
4. Check "Offline" (or select "Offline" from throttling dropdown)
5. Draw more things
6. ✅ **Verify**: Drawing still works
7. Refresh the page (Cmd+R / F5)
8. ✅ **Verify**: Drawings are still there
9. Uncheck "Offline"
10. Wait 5 seconds
11. ✅ **Verify**: Console shows backend sync

**Expected Result**:
- ✅ Drawing works offline
- ✅ Drawings persist in localStorage
- ✅ Auto-syncs to backend when online again

---

### Test 5: Error Handling (1 minute)

**Goal**: Verify error states work correctly

**Steps**:
1. Block the whiteboard API endpoint:
   - DevTools → Network tab
   - Right-click → Block request domain
   - Block: `localhost:3000/api/whiteboard`
2. Try drawing
3. ✅ **Verify**: Error message appears
4. Unblock the request
5. Click "🔄 Retry" button
6. ✅ **Verify**: Whiteboard loads successfully

**Expected Result**:
- ✅ Clear error message on failure
- ✅ Retry button works
- ✅ Recovers gracefully

---

## Success Checklist

Use this checklist to verify everything works:

- [ ] Whiteboard tab appears in session page
- [ ] Whiteboard loads without disappearing
- [ ] Can draw shapes (rectangle, circle, arrow)
- [ ] Can add text
- [ ] Can select and move objects
- [ ] Can delete objects
- [ ] Drawings persist after page refresh
- [ ] "Saving..." indicator shows when drawing
- [ ] Console shows "Saved to backend" messages
- [ ] Version number increments
- [ ] Real-time sync works between tabs (2-5 sec)
- [ ] Works offline (localStorage)
- [ ] Error handling works (retry button)
- [ ] No hydration errors in console
- [ ] No React errors in console
- [ ] No tldraw errors in console

## Common Issues & Solutions

### Issue: Whiteboard disappears immediately
**Cause**: Hydration error or tldraw not loading
**Solution**: 
- Check console for errors
- Verify tldraw v4.1.2 is installed: `npm list tldraw`
- Clear cache: `rm -rf .next && npm run dev`

### Issue: Drawings don't persist
**Cause**: localStorage not working or editor not initialized
**Solution**:
- Check browser localStorage is enabled
- Check console for "Loaded state from localStorage"
- Verify editorRef.current exists in handleMount

### Issue: Real-time sync not working
**Cause**: Supabase realtime not connected
**Solution**:
- Check Supabase credentials in .env
- Verify SessionWhiteboard table exists in DB
- Check console for realtime subscription messages

### Issue: "Saving..." never stops
**Cause**: API endpoint failing silently
**Solution**:
- Check /api/whiteboard/save endpoint works
- Verify user is session participant
- Check rate limiting (60 saves/min)

### Issue: Hydration errors
**Cause**: Server/client render mismatch
**Solution**:
- Verify `mounted` state check is working
- Check `if (!mounted) return null` is present
- Clear browser cache and hard refresh

## Browser Console Commands

Useful commands for debugging:

```javascript
// Check localStorage
localStorage.getItem('tldraw-SESSION_ID_HERE')

// Clear whiteboard state
localStorage.removeItem('tldraw-SESSION_ID_HERE')

// Check if tldraw is loaded
window.Tldraw

// Monitor realtime channel
// (Check Application tab → Realtime subscriptions)
```

## Performance Benchmarks

Expected performance metrics:

- **Initial Load**: < 500ms
- **Drawing Response**: < 16ms (60 FPS)
- **Save to localStorage**: < 10ms
- **Save to backend**: 100-300ms
- **Realtime sync**: 2-5 seconds
- **Memory usage**: 5-10MB

## Reporting Issues

If you find issues, please report with:

1. **Steps to reproduce**: Exact steps
2. **Expected behavior**: What should happen
3. **Actual behavior**: What actually happens
4. **Console errors**: Screenshots of console
5. **Browser**: Chrome/Firefox/Safari + version
6. **Screenshots**: Visual evidence

---

## Next Steps After Testing

If all tests pass:
1. ✅ Mark whiteboard feature as complete
2. ✅ Update project status
3. ✅ Deploy to production
4. 📝 Create user documentation/help guide

If tests fail:
1. ❌ Note which test failed
2. 🐛 Check "Common Issues" section
3. 📞 Report issue with details above
4. 🔧 Debug and fix

---

**Happy Testing! 🚀**
