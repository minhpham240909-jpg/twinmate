# Fix: Multiple Video Tracks Error in Screen Sharing

## Problem

When starting screen share, the app threw this error:
```
AgoraRTCError CAN_NOT_PUBLISH_MULTIPLE_VIDEO_TRACKS
```

## Root Cause

Agora RTC SDK **does not allow publishing multiple video tracks simultaneously**. When you try to share your screen:
1. Camera video track is already published
2. Screen share track tries to publish
3. Agora throws error because you can't have 2 video tracks at once

## Solution

**Unpublish the camera video before publishing screen share, then re-publish it when screen sharing stops.**

### Changes Made

**File**: `src/lib/hooks/useVideoCall.ts`

#### In `startScreenShare()`:
Added code to unpublish camera video before publishing screen share:

```typescript
// Unpublish camera video track first (Agora doesn't allow multiple video tracks)
const videoTrack = localTracksRef.current.videoTrack
if (videoTrack) {
  await agoraClient.unpublish([videoTrack])
  console.log('Camera video unpublished before screen share')
}

// Then create and publish screen share track
const screenTrackResult = await createScreenShareTrack()
// ... rest of code
```

#### In `stopScreenShare()`:
Added code to re-publish camera video after stopping screen share:

```typescript
// Re-publish camera video track if it exists and was enabled
const videoTrack = localTracksRef.current.videoTrack
if (agoraClient && isConnected && videoTrack && localVideoEnabled) {
  await agoraClient.publish([videoTrack])
  console.log('Camera video re-published after screen share')
}
```

## How It Works Now

### When Starting Screen Share:
1. User clicks screen share button or presses 'S'
2. **Unpublish camera video** (if it's published)
3. Create screen share track
4. Publish screen share track
5. Camera remains **off** during screen sharing

### When Stopping Screen Share:
1. User clicks stop or presses 'S' again
2. Unpublish screen share track
3. Stop and close screen share track
4. **Re-publish camera video** (if it was enabled before)
5. Camera turns back **on** automatically

## User Experience

**Before Fix**:
- ❌ Error thrown when starting screen share
- ❌ Screen share doesn't work
- ❌ Console shows multiple errors

**After Fix**:
- ✅ Screen share starts smoothly
- ✅ Camera automatically turns off during screen share
- ✅ Camera automatically turns back on when stopping
- ✅ No errors in console
- ✅ Other participants see your screen share

## Visual Flow

```
Normal Call:
Camera: ON 📹
Screen: OFF 🖥️

↓ Press 'S' or click Share Screen

Screen Sharing:
Camera: OFF (unpublished)
Screen: ON 🖥️✅

↓ Press 'S' or click Stop Sharing

Normal Call:
Camera: ON 📹 (re-published)
Screen: OFF 🖥️
```

## Edge Cases Handled

1. **Camera was off before sharing**:
   - Stays off after stopping screen share
   - Only re-publishes if `localVideoEnabled === true`

2. **User disconnects during screen share**:
   - Cleanup in `leaveCall()` handles all tracks
   - No dangling tracks

3. **Multiple start/stop cycles**:
   - Works correctly every time
   - Camera toggles properly

## Technical Details

### Why Agora Has This Limitation

Agora uses **one video track per user** by design:
- Simplifies bandwidth management
- Reduces complexity in routing
- Standard for most video conferencing systems

### Alternative Considered

We could have used Agora's **dual-stream mode** (publishing both at different qualities), but:
- More complex to implement
- Higher bandwidth usage
- Not necessary for this use case
- Screen share is typically the primary focus

## Testing

✅ **Tested Scenarios**:
- [x] Start screen share with camera on
- [x] Stop screen share - camera comes back on
- [x] Start screen share with camera off
- [x] Stop screen share - camera stays off
- [x] Multiple screen share cycles
- [x] No console errors

## Build Status

```bash
✓ Build successful
✓ No TypeScript errors
✓ Only minor warnings (unrelated)
```

## Impact on Other Features

**No breaking changes**:
- ✅ Audio still works during screen share
- ✅ Mute/unmute still works
- ✅ Other participants' videos still visible
- ✅ Chat still works
- ✅ Network quality monitoring still works
- ✅ Keyboard shortcuts still work

## Related Code

**Files Modified**:
- `src/lib/hooks/useVideoCall.ts` - Added unpublish/re-publish logic

**Files NOT Modified**:
- `src/components/study-sessions/VideoCall.tsx` - UI unchanged
- `src/lib/agora/client.ts` - Track creation unchanged
- `src/lib/agora/types.ts` - Types unchanged

## Future Considerations

If we want to show **both camera and screen share** simultaneously:
1. Use Agora's **ScreenVideoTrack with camera**
2. Or use **separate client** for screen share (more complex)
3. Or use **picture-in-picture** overlay (browser API)

For now, the standard approach (screen share replaces camera) is the best UX for study sessions.

---

*Fix applied: 2025-10-13*
*Status: ✅ Resolved*
*Verified: Working in production*
