# Study with Partner - Implementation Plan

## 📋 Overview

This document outlines the complete implementation plan for making the "study with partner" function work for real users in the Clerva app. The plan is organized into 8 phases, prioritized by importance and dependencies.

---

## 🎯 Current Status Analysis

### ✅ What's Already Working

1. **Session Management**
   - Creating study sessions
   - Inviting partners to sessions
   - Accepting/declining invites
   - Leaving sessions
   - Session history

2. **Communication**
   - Text-based chat in sessions
   - Real-time messaging
   - Notifications for invites

3. **Collaboration Features**
   - Shared goals tracking
   - Session timer (Pomodoro-style)
   - Basic presence tracking (who's online)

4. **Infrastructure**
   - Agora SDK installed (`agora-rtc-sdk-ng` v4.24.0)
   - Agora token generation API working
   - Agora credentials configured
   - Database schema ready

### ❌ Critical Missing Features

1. **Video/Audio Calls** - The biggest gap preventing real-time study collaboration
2. **Screen Sharing** - Essential for studying together
3. **Public Session Discovery** - Limits partner finding
4. **Real-time Session Updates** - Requires page refresh for participant changes

### ⚠️ Features Needing Improvement

1. Real-time synchronization for session events
2. Notification delivery (currently app-only)
3. Partner availability awareness
4. Mobile experience optimization

---

## 📊 Implementation Timeline

| Phase | Duration | Priority | Dependencies |
|-------|----------|----------|-------------|
| Phase 1: Video/Audio | 2 weeks | 🔴 CRITICAL | None |
| Phase 2: Screen Share | 1 week | 🔴 CRITICAL | Phase 1 |
| Phase 3: Real-time Sync | 1 week | 🟡 HIGH | None |
| Phase 4: Notifications | 1 week | 🟡 HIGH | None |
| Phase 5: Availability | 1 week | 🟢 MEDIUM | None |
| Phase 6: Discovery | 1 week | 🟢 MEDIUM | None |
| Phase 7: Mobile | 1 week | 🟡 HIGH | Phases 1-2 |
| Phase 8: Polish | 1 week | 🔴 CRITICAL | All phases |

**Total Estimated Time: 8-9 weeks**

---

## 📋 PHASE 1: Video/Audio Call Integration (CRITICAL)

**Duration:** 2 weeks
**Priority:** 🔴 CRITICAL
**Status:** Pending

### Why First?

This is the core feature missing. Without video/audio, users can't truly "study together" in real-time. All infrastructure is in place (Agora SDK, tokens, database), just need the UI implementation.

### Implementation Steps

#### Step 1.1: Create Video Call Component

**File:** `src/components/study-sessions/VideoCall.tsx`

**What to Build:**
- Initialize Agora RTC client
- Handle local video/audio tracks
- Display remote participants' video streams
- Grid layout for multiple participants (1-10 users)
- Handle connection states (connecting, connected, disconnected)

**Key Features:**
```typescript
// Component structure:
interface VideoCallProps {
  sessionId: string
  agoraChannel: string
  userId: string
  userName: string
  onCallEnd: () => void
}

// Main functionalities:
- Join/leave Agora channel
- Publish local audio/video tracks
- Subscribe to remote users
- Auto-reconnect on disconnect
- Handle user join/leave events
```

**Dependencies:**
- ✅ Agora SDK already installed
- ✅ Token generation API exists at `/api/messages/agora-token`
- ✅ Need to create component from scratch

---

#### Step 1.2: Add Call Controls UI

**File:** Same component (`VideoCall.tsx`)

**What to Build:**

**Control Panel UI:**
```typescript
// Required controls:
1. Mute/Unmute microphone button
   - Visual indicator when muted
   - Keyboard shortcut (Space or M)

2. Enable/Disable camera button
   - Visual indicator when camera off
   - Show placeholder when camera disabled

3. Leave call button
   - Confirmation dialog
   - Proper cleanup on leave

4. Volume controls
   - Master volume slider
   - Individual participant volume (future)

5. Participant list overlay
   - Show all participants
   - Indicate who's speaking (audio level)
   - Show connection quality
```

**UI Layout:**
- Bottom control bar (fixed position)
- Video grid in main area
- Participant list as side panel or overlay
- Full-screen mode option

---

#### Step 1.3: Integrate into Session Page

**File:** `src/app/study-sessions/[sessionId]/page.tsx`

**Changes Needed:**

1. **Replace Toast Message (Line 540-544):**
```typescript
// Current code:
onClick={() => toast('Video call feature coming soon!')}

// New code:
onClick={() => setShowVideoCall(true)}
```

2. **Add Video Call State:**
```typescript
const [showVideoCall, setShowVideoCall] = useState(false)
const [isInCall, setIsInCall] = useState(false)
```

3. **Add Video Call Component:**
```typescript
{showVideoCall && session.agoraChannel && (
  <VideoCall
    sessionId={sessionId}
    agoraChannel={session.agoraChannel}
    userId={user.id}
    userName={user.name}
    onCallEnd={() => {
      setShowVideoCall(false)
      setIsInCall(false)
    }}
  />
)}
```

4. **Update Button Logic:**
```typescript
// Show "Join Video Call" if call is active but user not in it
// Show "Start Video Call" if no one is in call yet
// Show "Leave Call" if user is in call
```

**Call State Management:**
- Track who's currently in the video call
- Show participant count on the button
- Disable button when max participants reached
- Handle call initialization and cleanup

---

#### Step 1.4: Add Call State Management

**File:** Create `src/lib/hooks/useVideoCall.ts`

**What to Build:**

**Custom Hook for Video Call State:**
```typescript
interface UseVideoCallReturn {
  // Connection state
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null

  // Local media state
  localAudioEnabled: boolean
  localVideoEnabled: boolean

  // Remote participants
  remoteUsers: RemoteUser[]

  // Actions
  toggleAudio: () => void
  toggleVideo: () => void
  joinCall: () => Promise<void>
  leaveCall: () => Promise<void>

  // Error handling
  reconnect: () => Promise<void>
}

// State management for:
1. Call connection status (idle, connecting, connected, error)
2. Local audio/video enabled state
3. Remote participants list with their media states
4. Call errors and reconnection logic
5. Network quality indicators
```

**Key Responsibilities:**
- Initialize Agora client
- Handle token refresh
- Manage WebRTC connections
- Handle errors gracefully
- Auto-reconnect on network issues
- Clean up resources on unmount

---

### Testing Checklist for Phase 1

- [ ] User can start a video call in a session
- [ ] User can join an existing video call
- [ ] Video and audio work correctly
- [ ] Mute/unmute controls work
- [ ] Camera on/off works
- [ ] Multiple participants (2-10) can join
- [ ] Participants see each other's video
- [ ] Video grid layout adjusts dynamically
- [ ] User can leave call properly
- [ ] Call reconnects on temporary disconnect
- [ ] Call handles network quality issues
- [ ] Mobile browser compatibility (Chrome, Safari)
- [ ] Desktop browser compatibility (Chrome, Firefox, Safari, Edge)

---

### Files to Create/Modify in Phase 1

**New Files:**
- `src/components/study-sessions/VideoCall.tsx` (main component)
- `src/lib/hooks/useVideoCall.ts` (state management)
- `src/lib/agora/client.ts` (Agora client initialization)
- `src/lib/agora/types.ts` (TypeScript types)

**Modified Files:**
- `src/app/study-sessions/[sessionId]/page.tsx` (integrate video call)
- `src/components/study-sessions/SessionTimer.tsx` (optional: pause timer during call)

---

## 📋 PHASE 2: Screen Sharing

**Duration:** 1 week
**Priority:** 🔴 CRITICAL
**Status:** Pending
**Dependencies:** Phase 1

### Why Second?

Screen sharing is essential for studying together - sharing notes, code, documents, presentations, etc.

### Implementation Steps

#### Step 2.1: Add Screen Share Button

**File:** `src/components/study-sessions/VideoCall.tsx`

**What to Add:**

```typescript
// Screen share functionality:
1. Screen share toggle button in control panel
2. Handle screen share track creation
3. Publish screen share track to Agora
4. Display screen share in main view (larger than video)
5. Show screen sharer's name overlay
6. Allow only one person to share at a time
7. Stop button for person sharing
8. Handle permission errors gracefully
```

**UI Changes:**
- Add screen share icon button to control panel
- When someone shares: show screen in large view, videos in sidebar
- Show "X is sharing their screen" notification
- Add "Stop Sharing" button for the sharer

---

#### Step 2.2: Update Session UI

**File:** `src/app/study-sessions/[sessionId]/page.tsx`

**Changes:**

```typescript
// Replace placeholder button (line 545-550):
// Current:
onClick={() => toast('Screen share coming soon!')}

// New:
onClick={() => {
  if (isInCall) {
    // Trigger screen share from VideoCall component
    videoCallRef.current?.startScreenShare()
  } else {
    toast('Join the video call first to share your screen')
  }
}}
```

**Screen Share Features:**
- Integrated with video call
- Works alongside camera video
- Audio sharing option (for videos/presentations)
- High quality mode for detailed content

---

### Testing Checklist for Phase 2

- [ ] User can start screen sharing
- [ ] Screen share displays correctly for all participants
- [ ] Only one user can share at a time
- [ ] User can stop screen sharing
- [ ] Screen share continues if camera is off
- [ ] Audio from screen share works (optional)
- [ ] Screen share quality is good
- [ ] Works on different OS (Windows, Mac, Linux)
- [ ] Proper error handling if permission denied
- [ ] Screen share stops when user leaves call

---

## 📋 PHASE 3: Real-time Synchronization

**Duration:** 1 week
**Priority:** 🟡 HIGH
**Status:** Pending
**Dependencies:** None

### Why Third?

Improves user experience significantly by showing live updates without requiring page refresh.

### Implementation Steps

#### Step 3.1: Real-time Participant Updates

**File:** `src/app/study-sessions/[sessionId]/page.tsx`

**What to Add:**

```typescript
// Add Supabase real-time subscription:
useEffect(() => {
  const channel = supabase
    .channel(`session-${sessionId}-participants`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'SessionParticipant',
        filter: `sessionId=eq.${sessionId}`,
      },
      (payload) => {
        // Update participants list in real-time
        // Show toast when someone joins/leaves
        // Update participant count
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [sessionId])
```

**Features:**
1. Real-time participant list updates
2. Toast notification when someone joins
3. Toast notification when someone leaves
4. Update participant count badge
5. Update video call participant list

---

#### Step 3.2: Real-time Goal Sync

**File:** `src/components/SessionGoals.tsx`

**What to Add:**

```typescript
// Subscribe to SessionGoal changes:
useEffect(() => {
  const channel = supabase
    .channel(`session-${sessionId}-goals`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'SessionGoal',
        filter: `sessionId=eq.${sessionId}`,
      },
      (payload) => {
        // Update goals list
        // Show who completed the goal
        // Update progress bar
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [sessionId])
```

**Features:**
1. All participants see goal updates instantly
2. Show notification when goal is completed
3. Display who completed the goal
4. Update completion percentage
5. Confetti animation on goal completion (optional)

---

#### Step 3.3: Sync Timer State

**File:** `src/components/study-sessions/SessionTimer.tsx`

**What to Improve:**

```typescript
// Current issue: Timer may be out of sync for non-host users

// Solution: Subscribe to SessionTimer table changes
useEffect(() => {
  const channel = supabase
    .channel(`session-${sessionId}-timer`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'SessionTimer',
        filter: `sessionId=eq.${sessionId}`,
      },
      (payload) => {
        // Sync timer state across all participants
        // Update time remaining
        // Update timer state (running, paused, break)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [sessionId])
```

**Features:**
1. All participants see same timer
2. Host controls timer, others see updates
3. Synchronized start/pause/reset
4. Break time synchronized
5. Timer tick synchronized (or close enough)

---

### Testing Checklist for Phase 3

- [ ] Participant joins: all users see update immediately
- [ ] Participant leaves: all users see update immediately
- [ ] Goal completed: all users see update immediately
- [ ] Goal added: all users see new goal
- [ ] Timer started: all users see timer running
- [ ] Timer paused: all users see timer paused
- [ ] Break time: all users enter break mode together
- [ ] No page refresh needed for any updates
- [ ] Updates work across multiple browser tabs
- [ ] Works reliably with poor internet connection

---

## 📋 PHASE 4: Enhanced Notifications

**Duration:** 1 week
**Priority:** 🟡 HIGH
**Status:** Pending
**Dependencies:** None

### Why Fourth?

Users might miss important session invites if they're not actively on the app. Email notifications ensure they get informed.

### Implementation Steps

#### Step 4.1: Email Notifications

**Setup Email Service:**

1. Choose email provider (recommended: Resend.com - simple and free tier)
2. Install package: `npm install resend`
3. Add API key to `.env.local`

**Files to Create:**

**`src/lib/email/client.ts`**
```typescript
import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)
```

**`src/lib/email/templates/session-invite.tsx`**
```typescript
// Email template for session invites
// Clean HTML email with:
// - Session title and description
// - Inviter name and avatar
// - Accept/Decline buttons (link to app)
// - Session details (time, subject, type)
```

**`src/lib/email/session-invite.ts`**
```typescript
export async function sendSessionInviteEmail({
  to,
  toName,
  sessionTitle,
  sessionDescription,
  inviterName,
  sessionId,
  acceptUrl,
  declineUrl,
}) {
  // Send email using Resend
  // Return success/failure
}
```

**Update:** `src/app/api/study-sessions/[sessionId]/invite/route.ts`

```typescript
// Add after line 94 (after creating notification):
await sendSessionInviteEmail({
  to: inviteeEmail,
  toName: inviteeName,
  sessionTitle: session.title,
  sessionDescription: session.description,
  inviterName: inviter.name,
  sessionId: session.id,
  acceptUrl: `${process.env.NEXT_PUBLIC_APP_URL}/study-sessions`,
  declineUrl: `${process.env.NEXT_PUBLIC_APP_URL}/study-sessions`,
})
```

---

#### Step 4.2: Better In-App Notifications

**File:** `src/components/NotificationPanel.tsx`

**What to Improve:**

```typescript
// For SESSION_INVITE notifications (similar to CONNECTION_REQUEST):

1. Add quick action buttons in notification:
   - "Accept & Join" button (green)
   - "Decline" button (gray)

2. Add sound notification option:
   - Play sound when invite received
   - User can enable/disable in settings

3. Show session preview:
   - Session title
   - Inviter name and avatar
   - Subject and type
   - Number of participants

4. One-click join:
   - Click "Accept & Join" → auto-navigate to session room
```

**Update Notification Display:**
```typescript
// Add new condition around line 330:
{notification.type === 'SESSION_INVITE' && !notification.isRead && (
  <div className="flex gap-2 mt-3">
    <button
      onClick={() => handleAcceptSessionInvite(notification)}
      className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
    >
      Accept & Join
    </button>
    <button
      onClick={() => handleDeclineSessionInvite(notification)}
      className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300"
    >
      Decline
    </button>
  </div>
)}
```

---

### Testing Checklist for Phase 4

- [ ] Email sent when user invited to session
- [ ] Email contains correct session details
- [ ] Email links work correctly
- [ ] Accept button in email navigates to app
- [ ] In-app notification shows accept/decline buttons
- [ ] Accept button joins session immediately
- [ ] Decline button removes invitation
- [ ] Sound plays on new invite (if enabled)
- [ ] Email deliverability is good (not spam)
- [ ] Email works with common providers (Gmail, Outlook, etc.)

---

## 📋 PHASE 5: Partner Availability

**Duration:** 1 week
**Priority:** 🟢 MEDIUM
**Status:** Pending
**Dependencies:** None

### Why Fifth?

Helps users know when their study partners are available, reducing failed invite attempts and improving scheduling.

### Implementation Steps

#### Step 5.1: Add Session Status to Profile

**Database Migration:**

Create file: `add_session_status.sql`

```sql
-- Add session tracking to Profile table
ALTER TABLE "Profile"
ADD COLUMN "currentSessionId" TEXT,
ADD COLUMN "isBusy" BOOLEAN DEFAULT false;

-- Add foreign key constraint
ALTER TABLE "Profile"
ADD CONSTRAINT "Profile_currentSessionId_fkey"
FOREIGN KEY ("currentSessionId")
REFERENCES "StudySession"("id")
ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX "Profile_currentSessionId_idx" ON "Profile"("currentSessionId");
CREATE INDEX "Profile_isBusy_idx" ON "Profile"("isBusy");
```

**Update Prisma Schema:** `prisma/schema.prisma`

```prisma
model Profile {
  // ... existing fields ...

  // Session status
  currentSessionId String?
  isBusy          Boolean @default(false)

  // ... rest of model ...

  @@index([currentSessionId])
  @@index([isBusy])
}
```

Run migration:
```bash
npx prisma db push
npx prisma generate
```

---

#### Step 5.2: Update Partner Modal

**File:** `src/components/StudyPartnersModal.tsx`

**Update Display (around line 200-206):**

```typescript
// Replace online status indicator with more detailed status:

{partner.profile?.isBusy ? (
  <span className="flex items-center gap-1 text-xs text-orange-600">
    <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
    Busy - In Study Session
  </span>
) : partner.profile?.onlineStatus === 'ONLINE' ? (
  <span className="flex items-center gap-1 text-xs text-green-600">
    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
    Available
  </span>
) : partner.profile?.onlineStatus === 'LOOKING_FOR_PARTNER' ? (
  <span className="flex items-center gap-1 text-xs text-blue-600">
    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
    Looking for Partner
  </span>
) : (
  <span className="flex items-center gap-1 text-xs text-gray-600">
    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
    Offline
  </span>
)}
```

**Add Status Badge:**
```typescript
// Show what session they're in (if busy):
{partner.profile?.isBusy && partner.profile?.currentSessionId && (
  <p className="text-xs text-gray-500 mt-1">
    Currently in a study session
  </p>
)}
```

---

#### Step 5.3: Auto-update Status

**File:** `src/app/study-sessions/[sessionId]/page.tsx`

**Update on Join:**

Add after line 165 (when joining session):
```typescript
// Update user's profile to show they're busy
await fetch('/api/profile/update-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    isBusy: true,
    currentSessionId: sessionId,
  }),
})
```

**Update on Leave:**

Add in `handleLeaveSession` function (around line 177-210):
```typescript
// Clear busy status when leaving
await fetch('/api/profile/update-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    isBusy: false,
    currentSessionId: null,
  }),
})
```

**Create API Endpoint:**

**File:** `src/app/api/profile/update-status/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { isBusy, currentSessionId } = await req.json()

    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        isBusy,
        currentSessionId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating profile status:', error)
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    )
  }
}
```

---

#### Step 5.4: Add "Looking for Partner" Status

**File:** `src/app/dashboard/page.tsx` or `src/app/profile/page.tsx`

**Add Toggle Button:**
```typescript
// Allow user to set "Looking for Partner" status
<button
  onClick={() => updateOnlineStatus('LOOKING_FOR_PARTNER')}
  className={`px-4 py-2 rounded-lg ${
    onlineStatus === 'LOOKING_FOR_PARTNER'
      ? 'bg-blue-600 text-white'
      : 'bg-gray-200 text-gray-700'
  }`}
>
  Looking for Study Partner
</button>
```

---

### Testing Checklist for Phase 5

- [ ] User status updates when joining session
- [ ] User status updates when leaving session
- [ ] Partners see "Busy" status in real-time
- [ ] Partners can see what session someone is in
- [ ] "Looking for Partner" status shows correctly
- [ ] Status persists across page refreshes
- [ ] Status clears if session ends
- [ ] Multiple device sync (desktop + mobile)
- [ ] Status updates via real-time subscription

---

## 📋 PHASE 6: Session Discovery

**Duration:** 1 week
**Priority:** 🟢 MEDIUM
**Status:** Pending
**Dependencies:** None

### Why Sixth?

Allows users to find and join open study sessions from other users, expanding collaboration opportunities beyond just their partners.

### Implementation Steps

#### Step 6.1: Create Browse Sessions Page

**File:** Create `src/app/study-sessions/browse/page.tsx`

**What to Build:**

```typescript
'use client'

// Public sessions browser page
// Features:
1. List all public active sessions
2. Search by subject, tags, title
3. Filter by:
   - Subject (Math, Science, CS, etc.)
   - Session type (Solo, One-on-One, Group)
   - Participant count (has space available)
   - Current status (Active only)
4. Sort by:
   - Most recent
   - Most participants
   - Alphabetical
5. Session cards showing:
   - Title and description
   - Host name and avatar
   - Subject and tags
   - Participant count (X / Max)
   - "Join Session" button
6. Real-time updates when sessions added/removed

// Layout:
- Search bar at top
- Filter sidebar on left
- Grid of session cards
- Pagination or infinite scroll
```

**Session Card Component:**
```typescript
<div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
  {/* Host info */}
  <div className="flex items-center gap-3 mb-4">
    <img src={session.creator.avatarUrl} className="w-10 h-10 rounded-full" />
    <div>
      <p className="font-semibold">{session.creator.name}</p>
      <p className="text-sm text-gray-500">Host</p>
    </div>
  </div>

  {/* Session info */}
  <h3 className="text-lg font-bold mb-2">{session.title}</h3>
  <p className="text-gray-600 text-sm mb-4">{session.description}</p>

  {/* Badges */}
  <div className="flex gap-2 mb-4">
    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
      {session.subject}
    </span>
    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
      {session.type}
    </span>
  </div>

  {/* Participant count */}
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <UsersIcon className="w-4 h-4" />
      <span>{session.participantCount} / {session.maxParticipants}</span>
    </div>
    <span className="text-xs text-green-600">● Active now</span>
  </div>

  {/* Join button */}
  <button
    onClick={() => handleJoinSession(session.id)}
    disabled={session.participantCount >= session.maxParticipants}
    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
  >
    {session.participantCount >= session.maxParticipants ? 'Session Full' : 'Join Session'}
  </button>
</div>
```

---

#### Step 6.2: Add API Endpoint

**File:** Create `src/app/api/study-sessions/public/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams
    const subject = searchParams.get('subject')
    const type = searchParams.get('type')
    const search = searchParams.get('search')

    // Build query
    const where = {
      isPublic: true,
      status: 'ACTIVE',
      // Exclude sessions where user is already a participant
      participants: {
        none: {
          userId: user.id,
        },
      },
    }

    if (subject) {
      where.subject = subject
    }

    if (type) {
      where.type = type
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Fetch public sessions
    const sessions = await prisma.studySession.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        participants: {
          select: {
            id: true,
            userId: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit results
    })

    // Filter out full sessions and format response
    const availableSessions = sessions
      .filter(session => {
        const activeParticipants = session.participants.filter(
          p => p.status === 'JOINED'
        ).length
        return activeParticipants < session.maxParticipants
      })
      .map(session => ({
        id: session.id,
        title: session.title,
        description: session.description,
        subject: session.subject,
        type: session.type,
        tags: session.tags,
        maxParticipants: session.maxParticipants,
        participantCount: session.participants.filter(p => p.status === 'JOINED').length,
        creator: session.creator,
        startedAt: session.startedAt,
      }))

    return NextResponse.json({
      success: true,
      sessions: availableSessions,
    })
  } catch (error) {
    console.error('Error fetching public sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch public sessions' },
      { status: 500 }
    )
  }
}
```

---

#### Step 6.3: Update Session Creation

**File:** `src/app/study-sessions/page.tsx`

**Update CreateSessionModal (around line 420-702):**

```typescript
// Add state for public/private
const [isPublic, setIsPublic] = useState(false)

// Add checkbox in the form (after subject input):
<div>
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={isPublic}
      onChange={(e) => setIsPublic(e.target.checked)}
      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
    />
    <span className="text-sm font-medium text-gray-700">
      Make this session public
    </span>
  </label>
  <p className="text-xs text-gray-500 mt-1 ml-6">
    Public sessions can be discovered and joined by anyone
  </p>
</div>

// Update create request:
body: JSON.stringify({
  title,
  description,
  type,
  subject: subject || null,
  inviteUserIds: selectedInvites,
  isPublic, // Add this
}),
```

**Update API:** `src/app/api/study-sessions/create/route.ts`

```typescript
// Add isPublic to destructured body (line 17):
const { title, description, type, subject, tags, inviteUserIds, isPublic } = body

// Add to session creation (line 31-44):
const session = await prisma.studySession.create({
  data: {
    title,
    description: description || null,
    type,
    status: 'SCHEDULED',
    createdBy: user.id,
    userId: user.id,
    subject: subject || null,
    tags: tags || [],
    agoraChannel,
    maxParticipants: 10,
    isPublic: isPublic || false, // Add this
  },
})
```

---

#### Step 6.4: Add Navigation Link

**File:** `src/app/study-sessions/page.tsx`

**Add "Browse Public Sessions" Button:**

```typescript
// Add next to "New Session" button in header (around line 230):
<div className="flex gap-3">
  <button
    onClick={() => router.push('/study-sessions/browse')}
    className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition"
  >
    Browse Public Sessions
  </button>
  <button
    onClick={() => setShowCreateModal(true)}
    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
  >
    + New Session
  </button>
</div>
```

---

### Testing Checklist for Phase 6

- [ ] Browse page shows all public active sessions
- [ ] Search functionality works
- [ ] Filters work (subject, type)
- [ ] Session cards show correct information
- [ ] User can join public session
- [ ] Full sessions show as disabled
- [ ] User's own sessions are excluded from browse
- [ ] Sessions update in real-time
- [ ] Creating public session makes it discoverable
- [ ] Creating private session keeps it hidden
- [ ] Join button navigates to session room
- [ ] Pagination works for many sessions

---

## 📋 PHASE 7: Mobile Optimization

**Duration:** 1 week
**Priority:** 🟡 HIGH
**Status:** Pending
**Dependencies:** Phases 1-2

### Why Seventh?

Many users will access the app from mobile devices. The video call and session features must work well on mobile for real-world usage.

### Implementation Steps

#### Step 7.1: Responsive Video Layout

**File:** `src/components/study-sessions/VideoCall.tsx`

**Mobile Optimizations:**

```typescript
// Responsive grid layout:
1. Portrait mode:
   - Stack videos vertically
   - Max 2 columns on small screens
   - Main speaker view larger

2. Landscape mode:
   - Grid layout (2x2, 3x3, etc.)
   - Utilize full screen width

3. Picture-in-Picture (PiP):
   - Minimize video call to corner
   - Continue call while browsing app
   - Show participant count badge

4. Mobile controls:
   - Larger touch targets (min 44px)
   - Bottom sheet for participants
   - Swipe gestures for controls

5. Performance:
   - Lower video quality on mobile data
   - Adaptive bitrate based on connection
   - Battery optimization mode
```

**Responsive Classes:**
```typescript
// Video grid container:
<div className="grid gap-2
  grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4
  p-4">
  {/* Video items */}
</div>

// Control panel:
<div className="fixed bottom-0 left-0 right-0
  bg-gray-900 p-4 safe-area-bottom
  flex justify-center gap-4">
  {/* Large touch-friendly buttons */}
</div>
```

---

#### Step 7.2: Touch Interactions

**Files:** All session-related components

**What to Test & Fix:**

```typescript
1. Timer Controls (SessionTimer.tsx):
   - Start/pause buttons large enough (44px)
   - Prevent double-tap zoom on buttons
   - Haptic feedback on button press (mobile)

2. Chat Input (SessionChat.tsx):
   - Keyboard doesn't cover input
   - Virtual keyboard shows "Send" button
   - Auto-scroll to bottom when keyboard opens

3. Modal Scrolling:
   - Prevent body scroll when modal open
   - Smooth scrolling on touch devices
   - Pull-to-refresh disabled in modals

4. Button Sizes:
   - All interactive elements min 44x44px
   - Adequate spacing between buttons
   - Clear active/pressed states

5. Video Call Controls:
   - Bottom sheet for additional options
   - Swipe up for participant list
   - Swipe down to minimize video

6. Navigation:
   - Back button works correctly
   - Prevent accidental navigation
   - Confirm before leaving active session
```

**Add Touch-Friendly Styles:**
```css
/* Add to global styles */
@media (max-width: 768px) {
  /* Prevent zoom on input focus */
  input, textarea, select {
    font-size: 16px;
  }

  /* Larger touch targets */
  button, a {
    min-height: 44px;
    min-width: 44px;
  }

  /* Safe area for notch devices */
  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

---

#### Step 7.3: Mobile-Specific Features

**Add Mobile Detection:**

```typescript
// src/lib/utils/device.ts
export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export function isAndroid() {
  return /Android/.test(navigator.userAgent)
}
```

**Mobile-Specific Adjustments:**

```typescript
// In VideoCall.tsx:
const isMobile = isMobileDevice()

// Adjust video quality for mobile
const videoConfig = isMobile
  ? { width: 640, height: 480, frameRate: 15 }
  : { width: 1280, height: 720, frameRate: 30 }

// Use different layouts
{isMobile ? <MobileVideoLayout /> : <DesktopVideoLayout />}
```

---

#### Step 7.4: Test on Real Devices

**Devices to Test:**

1. **iOS:**
   - iPhone (Safari)
   - iPad (Safari)

2. **Android:**
   - Chrome on Android
   - Samsung Internet

3. **Different Screen Sizes:**
   - Small phones (< 375px width)
   - Standard phones (375-428px)
   - Tablets (768px+)

**Test Scenarios:**
- Join video call on mobile data
- Join video call on WiFi
- Switch between WiFi and mobile data
- Rotate device during call
- Lock screen during call
- Receive phone call during session
- Low battery mode
- Background app mode
- Poor network conditions

---

### Testing Checklist for Phase 7

- [ ] Video call works on iOS Safari
- [ ] Video call works on Android Chrome
- [ ] Controls are touch-friendly (44px min)
- [ ] Layout responsive on all screen sizes
- [ ] Portrait and landscape modes work
- [ ] Keyboard doesn't cover inputs
- [ ] Modals scroll correctly on mobile
- [ ] No accidental double-tap zooms
- [ ] Back button behavior is correct
- [ ] Picture-in-picture works
- [ ] Performance is good on mobile
- [ ] Battery usage is reasonable
- [ ] Works on mobile data
- [ ] Adapts to poor connections

---

## 📋 PHASE 8: Polish & Testing

**Duration:** 1 week
**Priority:** 🔴 CRITICAL
**Status:** Pending
**Dependencies:** All previous phases

### Why Last?

Polish and comprehensive testing ensure the features are reliable, handle edge cases, and provide a smooth user experience in production.

### Implementation Steps

#### Step 8.1: Error Handling

**Add Comprehensive Error Handling:**

**1. Video Call Errors:**

```typescript
// In VideoCall.tsx or useVideoCall.ts:

// Handle connection failures
try {
  await agoraClient.join(appId, channelName, token, uid)
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    showError('Network connection failed. Please check your internet.')
  } else if (error.code === 'INVALID_TOKEN') {
    // Try to refresh token
    await refreshAgoraToken()
  } else {
    showError('Failed to join call. Please try again.')
  }
}

// Handle permission errors
try {
  await AgoraRTC.createMicrophoneAudioTrack()
} catch (error) {
  showError('Microphone permission denied. Please enable it in your browser settings.')
}

try {
  await AgoraRTC.createCameraVideoTrack()
} catch (error) {
  showError('Camera permission denied. Please enable it in your browser settings.')
}

// Handle network quality issues
agoraClient.on('network-quality', (stats) => {
  if (stats.downlinkNetworkQuality > 4 || stats.uplinkNetworkQuality > 4) {
    showWarning('Poor network connection. Video quality may be reduced.')
  }
})

// Handle user removed
agoraClient.on('user-left', (user, reason) => {
  if (reason === 'ServerTimeOut') {
    showInfo(`${user.uid} lost connection`)
  }
})
```

**2. Session Errors:**

```typescript
// Handle session not found
// Handle session already full
// Handle user not invited
// Handle session ended while user in it
// Handle database connection errors

// In session page:
useEffect(() => {
  const handleSessionUpdate = async () => {
    const session = await fetchSession()
    if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
      toast.error('This session has ended')
      router.push('/study-sessions')
    }
  }

  // Subscribe to session changes
  const channel = supabase
    .channel(`session-${sessionId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'StudySession',
      filter: `id=eq.${sessionId}`,
    }, handleSessionUpdate)
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [sessionId])
```

**3. Invite Errors:**

```typescript
// Handle invite to offline user
// Handle invite to user already in session
// Handle duplicate invites
// Handle max participants reached

// In invite API:
// Check if user is online
const inviteeProfile = await prisma.profile.findUnique({
  where: { userId: inviteeId },
  select: { onlineStatus: true, isBusy: true }
})

if (inviteeProfile?.isBusy) {
  warnings.push(`${inviteeName} is currently in another session`)
}

if (inviteeProfile?.onlineStatus === 'OFFLINE') {
  warnings.push(`${inviteeName} is offline - they will receive an email`)
}
```

---

#### Step 8.2: Handle Edge Cases

**Critical Edge Cases:**

**1. User Closes Browser During Call:**

```typescript
// In VideoCall.tsx:
useEffect(() => {
  // Cleanup on unmount or browser close
  const cleanup = async () => {
    await agoraClient.leave()
    localAudioTrack?.close()
    localVideoTrack?.close()

    // Update server that user left call
    await fetch('/api/study-sessions/leave-call', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    })
  }

  // Handle beforeunload
  window.addEventListener('beforeunload', cleanup)

  return () => {
    cleanup()
    window.removeEventListener('beforeunload', cleanup)
  }
}, [])
```

**2. Host Leaves Session:**

```typescript
// In leave session API:
if (isHost && participantCount > 1) {
  // Transfer host to next participant
  const newHost = await prisma.sessionParticipant.findFirst({
    where: {
      sessionId,
      userId: { not: user.id },
      status: 'JOINED',
    },
  })

  if (newHost) {
    // Update new host role
    await prisma.sessionParticipant.update({
      where: { id: newHost.id },
      data: { role: 'HOST' },
    })

    // Update session creator
    await prisma.studySession.update({
      where: { id: sessionId },
      data: { createdBy: newHost.userId },
    })

    return {
      action: 'left_transferred',
      newHost: newHost,
    }
  }
}
```

**3. Multiple Devices Logged In:**

```typescript
// Handle same user joining from multiple devices
// Only allow one active session per user
// Or allow multiple but show warning

// In session join:
const existingParticipant = await prisma.sessionParticipant.findFirst({
  where: {
    userId: user.id,
    status: 'JOINED',
    sessionId: { not: sessionId },
  },
  include: { session: true },
})

if (existingParticipant) {
  return NextResponse.json({
    error: `You are already in another session: ${existingParticipant.session.title}`,
    existingSessionId: existingParticipant.sessionId,
  }, { status: 400 })
}
```

**4. Session Max Participants:**

```typescript
// Check before joining
const activeParticipants = await prisma.sessionParticipant.count({
  where: {
    sessionId,
    status: 'JOINED',
  },
})

if (activeParticipants >= session.maxParticipants) {
  return NextResponse.json({
    error: 'Session is full',
  }, { status: 400 })
}
```

**5. Stale Invite Cleanup:**

```typescript
// Clean up old invites (run daily via cron or on-demand)
// File: src/app/api/study-sessions/cleanup-invites/route.ts

export async function POST() {
  // Delete invites older than 7 days
  await prisma.sessionParticipant.deleteMany({
    where: {
      status: 'INVITED',
      createdAt: {
        lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  })

  // Delete notifications for deleted invites
  await prisma.notification.deleteMany({
    where: {
      type: 'SESSION_INVITE',
      createdAt: {
        lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  })

  return NextResponse.json({ success: true })
}
```

---

#### Step 8.3: Performance Testing

**Load Testing:**

```typescript
// Test scenarios:
1. Session with 10 participants (max)
   - All with video enabled
   - All with screen share attempts
   - Multiple messages per second in chat

2. Long-running sessions (2+ hours)
   - Check for memory leaks
   - Check for connection stability
   - Check timer accuracy over time

3. Poor network conditions
   - Simulate packet loss (5%, 10%, 20%)
   - Simulate latency (100ms, 500ms, 1000ms)
   - Test reconnection logic

4. Multiple browser tabs
   - Same user, multiple sessions
   - Memory usage
   - CPU usage

5. Database performance
   - Query optimization
   - Index effectiveness
   - Connection pooling
```

**Performance Monitoring:**

```typescript
// Add performance tracking
// File: src/lib/analytics/performance.ts

export function trackVideoCallPerformance({
  sessionId,
  connectionTime,
  avgLatency,
  packetsLost,
  videoBitrate,
  audioBitrate,
}) {
  // Log to analytics service
  console.log('Video Call Performance:', {
    sessionId,
    connectionTime,
    avgLatency,
    packetsLost,
    videoBitrate,
    audioBitrate,
  })
}

// Usage in VideoCall.tsx:
useEffect(() => {
  agoraClient.on('network-quality', (stats) => {
    trackVideoCallPerformance({
      sessionId,
      avgLatency: stats.delay,
      packetsLost: stats.packetLoss,
      // ... other metrics
    })
  })
}, [])
```

---

#### Step 8.4: User Experience Polish

**Add Loading States:**

```typescript
// For all async actions:
1. Video call connecting: spinner overlay
2. Session loading: skeleton screens
3. Sending invite: button disabled with spinner
4. Joining session: progress indicator

// Example:
{isConnecting && (
  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-white">Connecting to video call...</p>
    </div>
  </div>
)}
```

**Add Success Feedback:**

```typescript
// Positive feedback for actions:
1. Session created: success toast + confetti animation
2. Partner joined: toast notification with avatar
3. Goal completed: celebration animation
4. Call ended: summary modal with stats

// Example:
toast.success('Session created successfully!', {
  icon: '🎉',
  duration: 3000,
})
```

**Add Empty States:**

```typescript
// Better empty states:
1. No active sessions: illustration + CTA
2. No study partners: invite friends button
3. No public sessions: create one yourself
4. No goals yet: add your first goal

// Already exists in some places, ensure consistency
```

**Add Keyboard Shortcuts:**

```typescript
// Global keyboard shortcuts:
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Mute/unmute: M key
    if (e.key === 'm' && isInCall) {
      toggleAudio()
    }

    // Toggle video: V key
    if (e.key === 'v' && isInCall) {
      toggleVideo()
    }

    // Leave call: Escape key
    if (e.key === 'Escape' && isInCall) {
      confirmLeaveCall()
    }
  }

  window.addEventListener('keydown', handleKeyPress)
  return () => window.removeEventListener('keydown', handleKeyPress)
}, [isInCall])
```

---

### Testing Checklist for Phase 8

**Functional Testing:**
- [ ] All features work as expected
- [ ] No console errors in production
- [ ] All API endpoints return correct responses
- [ ] Database queries are optimized
- [ ] Real-time subscriptions are stable

**Error Handling:**
- [ ] Video call connection failures handled gracefully
- [ ] Permission denied errors show helpful messages
- [ ] Network errors trigger retry logic
- [ ] Session not found redirects properly
- [ ] Full session shows clear message

**Edge Cases:**
- [ ] User closes browser during call - cleanup works
- [ ] Host leaves - new host assigned correctly
- [ ] Multiple devices - handled appropriately
- [ ] Max participants - prevents over-joining
- [ ] Stale invites - cleaned up properly

**Performance:**
- [ ] 10-user session runs smoothly
- [ ] 2+ hour session stable
- [ ] Poor network handled well
- [ ] No memory leaks
- [ ] Database queries fast (<100ms)

**User Experience:**
- [ ] All loading states shown
- [ ] Success feedback provided
- [ ] Empty states are helpful
- [ ] Keyboard shortcuts work
- [ ] Animations smooth (60fps)

**Cross-Browser Testing:**
- [ ] Chrome (desktop & mobile)
- [ ] Safari (desktop & mobile)
- [ ] Firefox (desktop)
- [ ] Edge (desktop)

**Mobile Testing:**
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Touch interactions work
- [ ] Responsive layouts correct
- [ ] Performance acceptable

---

## 🚀 Quick Start: Minimum Viable Implementation

If you want to get something working **quickly** (2-3 weeks), focus on:

### MVP Scope (Highest Priority)

1. **Phase 1.1-1.3**: Basic video call (2 weeks)
   - Simple video call component
   - Basic controls (mute, camera, leave)
   - Integration into session page

2. **Phase 3.1**: Real-time participant updates (2 days)
   - See when people join/leave

3. **Phase 8.1**: Basic error handling (3 days)
   - Connection failures
   - Permission denied
   - Session errors

**Total MVP Time: ~2.5 weeks**

This gives you a **working study-together feature** that real users can use immediately. Then iterate and add:
- Screen sharing (Phase 2)
- Email notifications (Phase 4)
- Mobile optimization (Phase 7)
- Full polish (Phase 8)

---

## 📝 Notes & Recommendations

### Technology Stack Decisions

**Video/Audio:**
- ✅ Agora RTC SDK (already installed and configured)
- Why: Professional-grade, reliable, good documentation
- Alternative considered: WebRTC native (more complex)

**Email Service:**
- Recommended: Resend.com
- Why: Simple API, generous free tier, React email templates
- Alternative: SendGrid, AWS SES

**Real-time Updates:**
- ✅ Supabase Realtime (already in use)
- Why: Already integrated, works well
- Keep using it for all real-time features

### Development Tips

1. **Test Frequently on Real Devices**
   - Video calls behave differently on real devices vs. emulators
   - Test with real network conditions

2. **Start with 2-User Sessions**
   - Easier to debug
   - Expand to multi-user after basics work

3. **Use Feature Flags**
   - Enable video calls for beta users first
   - Gradually roll out to all users

4. **Monitor Usage**
   - Track call duration, quality, errors
   - Use to improve experience

5. **Have Fallback Plans**
   - If video fails, chat still works
   - If Agora has issues, show clear error

### Security Considerations

1. **Agora Tokens:**
   - ✅ Already generating server-side (secure)
   - Expire after 24 hours (good)
   - Consider shorter expiry for production (1-2 hours)

2. **Session Access:**
   - ✅ Already checking user is invited
   - ✅ Host can remove participants
   - Consider: Rate limiting for invites

3. **Data Privacy:**
   - Video/audio not recorded by default (good)
   - If adding recording: get user consent
   - GDPR compliance for EU users

### Cost Considerations

**Agora Pricing:**
- Free tier: 10,000 minutes/month
- After free tier: ~$0.99 per 1,000 minutes
- Estimate: 100 users × 2 hours/month = 12,000 minutes = ~$2/month

**Recommendation:**
- Start with free tier
- Monitor usage
- Optimize video quality settings to reduce costs
- Consider premium tier if >100 active users

---

## 📚 Resources & Documentation

### Agora SDK Documentation
- Quick Start: https://docs.agora.io/en/video-calling/get-started/get-started-sdk
- API Reference: https://api-ref.agora.io/en/video-sdk/web/4.x/
- Sample Projects: https://github.com/AgoraIO/API-Examples-Web

### Supabase Realtime
- Documentation: https://supabase.com/docs/guides/realtime
- Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes

### Testing Resources
- WebRTC Test: https://test.webrtc.org/
- Network Simulator: Chrome DevTools Network Throttling
- Mobile Testing: BrowserStack or real devices

---

## ✅ Success Criteria

The implementation is considered successful when:

1. **Functional:**
   - ✅ Users can start/join video calls
   - ✅ Audio and video work reliably
   - ✅ Screen sharing works
   - ✅ Sessions sync in real-time
   - ✅ Notifications are delivered

2. **Performance:**
   - ✅ Video calls connect in <5 seconds
   - ✅ Latency <300ms for good networks
   - ✅ Supports 10 participants smoothly
   - ✅ Works on mobile devices

3. **User Experience:**
   - ✅ Intuitive controls
   - ✅ Clear error messages
   - ✅ Responsive on all devices
   - ✅ No major bugs

4. **Production Ready:**
   - ✅ Error handling complete
   - ✅ Edge cases handled
   - ✅ Performance tested
   - ✅ Security reviewed

---

## 🔄 Iteration Plan

**After Initial Launch:**

1. **Week 1-2:** Monitor & Fix
   - Collect user feedback
   - Fix critical bugs
   - Monitor performance metrics

2. **Week 3-4:** Enhance
   - Add requested features
   - Optimize performance
   - Improve UX based on feedback

3. **Month 2+:** Scale
   - Add advanced features (recording, AI notes)
   - Improve video quality
   - Add analytics

---

*Last Updated: [Current Date]*
*Status: Planning Phase*
*Next Step: Begin Phase 1 Implementation*
