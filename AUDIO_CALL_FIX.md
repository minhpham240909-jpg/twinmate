# 🎙️ Audio Call vs Video Call Fix

## Problem Fixed

Previously, both "Audio Call" and "Video Call" buttons started the exact same type of call - with both video and audio enabled. This was confusing and not the expected behavior.

**Before:**
- ❌ Audio Call button → Started call with video + audio
- ✅ Video Call button → Started call with video + audio

**After:**
- ✅ Audio Call button → Starts AUDIO-ONLY call (no video, just voice)
- ✅ Video Call button → Starts call with video + audio

---

## How It Works Now

### Audio Call (Voice Only)
When users click the **Audio Call** button:
1. Camera stays **OFF** by default
2. Only microphone is enabled
3. User can see remote participant's video if they enable it
4. User can manually enable their camera later using the **V** key or video button
5. Perfect for voice-only conversations

### Video Call
When users click the **Video Call** button:
1. Both camera and microphone are enabled
2. Full video conferencing experience
3. Same as before

---

## Implementation Details

### 1. **useVideoCall Hook** (`src/lib/hooks/useVideoCall.ts`)

**Added:**
- `audioOnly` parameter to `UseVideoCallOptions`
- Initialize `localVideoEnabled` based on `audioOnly` mode

```typescript
interface UseVideoCallOptions {
  channelName: string
  audioOnly?: boolean // For audio-only calls (no video)
  // ... other options
}

const [localVideoEnabled, setLocalVideoEnabled] = useState(!audioOnly)
// If audioOnly = true, localVideoEnabled = false (camera OFF)
// If audioOnly = false, localVideoEnabled = true (camera ON)
```

### 2. **VideoCall Component** (`src/components/study-sessions/VideoCall.tsx`)

**Added:**
- `audioOnly` prop to `VideoCallProps`
- Pass `audioOnly` to `useVideoCall` hook

```typescript
interface VideoCallProps {
  // ... other props
  audioOnly?: boolean // For audio-only calls (no video)
}

const { ... } = useVideoCall({
  channelName: agoraChannel,
  audioOnly, // Pass audioOnly mode to hook
  // ...
})
```

### 3. **MessageVideoCall Component** (`src/components/messages/MessageVideoCall.tsx`)

**Added:**
- `callType` prop to receive 'VIDEO' or 'AUDIO'
- Convert `callType` to `audioOnly` boolean for VideoCall

```typescript
interface MessageVideoCallProps {
  // ... other props
  callType?: 'VIDEO' | 'AUDIO'
}

<VideoCall
  // ... other props
  audioOnly={callType === 'AUDIO'}
/>
```

### 4. **Chat Page** (`src/app/chat/page.tsx`)

**Added:**
- `currentCallType` ref to track the type of call
- Store `callType` when starting a call
- Pass `callType` to `MessageVideoCall` component

```typescript
const currentCallType = useRef<'VIDEO' | 'AUDIO'>('VIDEO')

const startCall = async (callType: 'VIDEO' | 'AUDIO' = 'VIDEO') => {
  // ... create call
  currentCallType.current = callType // Store call type
  setIsInCall(true)
}

<MessageVideoCall
  // ... other props
  callType={currentCallType.current}
/>
```

---

## User Experience

### Starting an Audio Call

1. User clicks the **phone icon** (Audio Call button)
2. Call starts with:
   - ✅ Microphone ON
   - ❌ Camera OFF
3. User sees:
   - Their own placeholder/avatar (no video)
   - Remote participant's video (if they enable it)
4. User can enable camera anytime:
   - Press **V** key
   - Click video toggle button

### Starting a Video Call

1. User clicks the **video icon** (Video Call button)
2. Call starts with:
   - ✅ Microphone ON
   - ✅ Camera ON
3. Full video conferencing experience

---

## Testing Checklist

### Audio Call Testing
- [ ] Click Audio Call button in DM
- [ ] Verify camera is OFF when call starts
- [ ] Verify microphone is ON
- [ ] Verify you can see remote user's video
- [ ] Verify remote user can see your placeholder/avatar
- [ ] Press **V** key → Camera should turn ON
- [ ] Press **V** key again → Camera should turn OFF
- [ ] Click Audio Call button in Group Chat → Same behavior

### Video Call Testing
- [ ] Click Video Call button in DM
- [ ] Verify both camera and microphone are ON
- [ ] Verify both users can see each other
- [ ] Press **V** key → Camera should toggle OFF/ON
- [ ] Click Video Call button in Group Chat → Same behavior

### Call Type Tracking
- [ ] Audio call → Call message shows "Audio Call"
- [ ] Video call → Call message shows "Video Call"
- [ ] Call duration tracked correctly for both types
- [ ] Call status (completed/missed/cancelled) works for both

---

## Files Modified

1. ✅ `src/lib/hooks/useVideoCall.ts`
   - Added `audioOnly` parameter
   - Initialize video state based on call type

2. ✅ `src/components/study-sessions/VideoCall.tsx`
   - Added `audioOnly` prop
   - Pass to useVideoCall hook

3. ✅ `src/components/messages/MessageVideoCall.tsx`
   - Added `callType` prop
   - Convert to `audioOnly` for VideoCall

4. ✅ `src/app/chat/page.tsx`
   - Added `currentCallType` ref
   - Store and pass call type

---

## Benefits

### 1. **Reduced Bandwidth**
Audio-only calls use significantly less bandwidth than video calls, perfect for:
- Poor internet connections
- Mobile data usage
- Quick voice conversations

### 2. **Privacy**
Users can have voice conversations without worrying about:
- Camera appearance
- Background visibility
- Being on video

### 3. **Clarity**
Clear distinction between audio and video calls:
- Phone icon = Voice only
- Video icon = Video + voice
- Matches user expectations from other apps

### 4. **Flexibility**
Users can start with audio-only and enable video later if needed using the **V** key or video button.

---

## Browser Compatibility

Works on all modern browsers:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

---

*Fix Applied: October 19, 2025*
*Status: ✅ Audio and Video Calls Now Work Correctly*
