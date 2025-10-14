# 📚 STUDY-SESSION MODULE - COMPLETE IMPLEMENTATION PLAN

**Status**: PLANNING PHASE ✅
**Created**: 2025-10-08
**Version**: 1.0
**Target**: Clerva 2.0 Study-Session Feature

---

## 🎯 EXECUTIVE SUMMARY

This document provides a comprehensive, phase-by-phase plan for implementing the Study-Session module in Clerva 2.0. The implementation is designed to:

✅ **Zero Breaking Changes** - Build on existing infrastructure
✅ **Reuse Proven Patterns** - Leverage chat, groups, and realtime implementations
✅ **LocalStorage Caching** - Fast UI with Supabase sync for live data
✅ **Production Ready** - Full testing, error handling, and analytics

**Estimated Timeline**: 5 implementation phases + testing
**Risk Level**: LOW (minimal conflicts with existing features)

---

## 📋 TABLE OF CONTENTS

1. [Database Schema Design](#1-database-schema-design)
2. [API Routes Architecture](#2-api-routes-architecture)
3. [Frontend Components](#3-frontend-components)
4. [LocalStorage Caching Strategy](#4-localstorage-caching-strategy)
5. [Integration Points](#5-integration-points)
6. [Implementation Phases](#6-implementation-phases)
7. [Testing Strategy](#7-testing-strategy)
8. [Security & Performance](#8-security--performance)

---

## 1. DATABASE SCHEMA DESIGN

### 1.1 Extended Prisma Schema

**File**: `prisma/schema.prisma`

```prisma
// ==========================================
// STUDY SESSIONS (EXTENDED)
// ==========================================

enum SessionType {
  SOLO
  ONE_ON_ONE
  GROUP
}

enum SessionStatus {
  SCHEDULED   // Created but not started
  ACTIVE      // Currently in progress
  COMPLETED   // Ended successfully
  CANCELLED   // Cancelled by host
}

enum SessionTool {
  CHAT
  VIDEO
  WHITEBOARD
  NOTES
  TIMER
  SCREEN_SHARE
}

model StudySession {
  id              String         @id @default(uuid())
  title           String
  description     String?        @db.Text
  type            SessionType
  status          SessionStatus  @default(SCHEDULED)

  // Creator/Host
  createdBy       String
  creator         User           @relation("SessionCreator", fields: [createdBy], references: [id], onDelete: Cascade)

  // Session Metadata
  subject         String?
  tags            String[]       @default([])
  maxParticipants Int            @default(10)
  isPublic        Boolean        @default(false)

  // Timing
  scheduledAt     DateTime?
  startedAt       DateTime       @default(now())
  endedAt         DateTime?
  durationMinutes Int?

  // Agora Video/Audio
  roomId          String?
  agoraChannel    String?        @unique
  recordingUrl    String?

  // AI-generated summary (existing fields)
  aiSummary       String?        @db.Text
  aiKeyPoints     String[]       @default([])
  aiTodos         String[]       @default([])

  // Relations
  settings        SessionSettings?
  participants    SessionParticipant[]
  goals           SessionGoal[]
  messages        SessionMessage[]
  recordings      SessionRecording[]
  whiteboardData  SessionWhiteboard[]
  notes           SessionNote[]
  analytics       SessionAnalytics?

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([createdBy])
  @@index([status])
  @@index([startedAt])
  @@index([type])
  @@index([agoraChannel])
}

// Session Settings
model SessionSettings {
  id          String   @id @default(uuid())
  sessionId   String   @unique
  session     StudySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  // Tools Enabled
  enabledTools  String[] @default(["CHAT", "VIDEO", "TIMER"]) // Array of SessionTool enum values

  // Layout Preferences
  layout      String?  @default("split-view") // "video-first", "whiteboard-first", "split-view"
  theme       String?  @default("light")      // "light", "dark", "auto"

  // Recording Settings
  autoRecord  Boolean  @default(false)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Session Participants
model SessionParticipant {
  id          String   @id @default(uuid())
  sessionId   String
  session     StudySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  role        SessionRole @default(PARTICIPANT)
  status      ParticipantStatus @default(INVITED)

  joinedAt    DateTime?
  leftAt      DateTime?

  createdAt   DateTime @default(now())

  @@unique([sessionId, userId])
  @@index([userId])
  @@index([sessionId])
  @@index([status])
}

enum SessionRole {
  HOST
  CO_HOST
  PARTICIPANT
}

enum ParticipantStatus {
  INVITED
  JOINED
  LEFT
  REMOVED
}

// Session Goals
model SessionGoal {
  id          String   @id @default(uuid())
  sessionId   String
  session     StudySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  title       String
  description String?  @db.Text
  isCompleted Boolean  @default(false)
  completedAt DateTime?

  order       Int      @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([sessionId])
}

// Session Messages (Chat within session)
model SessionMessage {
  id          String   @id @default(uuid())
  sessionId   String
  session     StudySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  senderId    String
  sender      User     @relation(fields: [senderId], references: [id], onDelete: Cascade)

  content     String   @db.Text
  type        MessageType @default(TEXT)

  createdAt   DateTime @default(now())

  @@index([sessionId])
  @@index([senderId])
  @@index([createdAt])
}

// Session Recordings
model SessionRecording {
  id          String   @id @default(uuid())
  sessionId   String
  session     StudySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  fileUrl     String
  fileName    String
  fileSize    Int?     // bytes
  type        RecordingType
  duration    Int?     // seconds

  createdAt   DateTime @default(now())

  @@index([sessionId])
}

enum RecordingType {
  VIDEO
  AUDIO
  SCREEN_SHARE
  WHITEBOARD_SNAPSHOT
}

// Whiteboard Data
model SessionWhiteboard {
  id          String   @id @default(uuid())
  sessionId   String
  session     StudySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  data        Json     // Excalidraw/Tldraw JSON data
  snapshot    String?  // URL to snapshot image

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([sessionId])
}

// Collaborative Notes
model SessionNote {
  id          String   @id @default(uuid())
  sessionId   String
  session     StudySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  content     String   @db.Text
  lastEditBy  String
  lastEditor  User     @relation(fields: [lastEditBy], references: [id])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([sessionId])
}

// Session Analytics
model SessionAnalytics {
  id              String   @id @default(uuid())
  sessionId       String   @unique
  session         StudySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  totalMessages   Int      @default(0)
  totalParticipants Int    @default(0)
  goalsCompleted  Int      @default(0)
  goalsTotal      Int      @default(0)

  whiteboardActions Int    @default(0)
  notesEdits      Int      @default(0)

  avgParticipationScore Float? // 0-100

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// Update User model to add relations
model User {
  // ... existing fields ...

  createdSessions    StudySession[]       @relation("SessionCreator")
  sessionParticipations SessionParticipant[]
  sessionMessages    SessionMessage[]
  sessionNotes       SessionNote[]

  // ... rest of existing relations ...
}
```

### 1.2 Migration Script

**File**: `create_study_sessions.sql`

```sql
-- Add new enums
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "SessionRole" AS ENUM ('HOST', 'CO_HOST', 'PARTICIPANT');
CREATE TYPE "ParticipantStatus" AS ENUM ('INVITED', 'JOINED', 'LEFT', 'REMOVED');
CREATE TYPE "RecordingType" AS ENUM ('VIDEO', 'AUDIO', 'SCREEN_SHARE', 'WHITEBOARD_SNAPSHOT');

-- Extend existing StudySession table
ALTER TABLE "StudySession" ADD COLUMN "status" "SessionStatus" DEFAULT 'SCHEDULED';
ALTER TABLE "StudySession" ADD COLUMN "createdBy" TEXT NOT NULL;
ALTER TABLE "StudySession" ADD COLUMN "subject" TEXT;
ALTER TABLE "StudySession" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "StudySession" ADD COLUMN "maxParticipants" INTEGER DEFAULT 10;
ALTER TABLE "StudySession" ADD COLUMN "isPublic" BOOLEAN DEFAULT false;
ALTER TABLE "StudySession" ADD COLUMN "scheduledAt" TIMESTAMP;
ALTER TABLE "StudySession" ADD COLUMN "agoraChannel" TEXT UNIQUE;
ALTER TABLE "StudySession" ADD COLUMN "updatedAt" TIMESTAMP DEFAULT now();

-- Add foreign key
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE;

-- Create new tables
CREATE TABLE "SessionSettings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" TEXT UNIQUE NOT NULL,
  "enabledTools" TEXT[] DEFAULT ARRAY['CHAT', 'VIDEO', 'TIMER']::TEXT[],
  "layout" TEXT DEFAULT 'split-view',
  "theme" TEXT DEFAULT 'light',
  "autoRecord" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now(),
  FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE
);

CREATE TABLE "SessionParticipant" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "SessionRole" DEFAULT 'PARTICIPANT',
  "status" "ParticipantStatus" DEFAULT 'INVITED',
  "joinedAt" TIMESTAMP,
  "leftAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT now(),
  UNIQUE ("sessionId", "userId"),
  FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "SessionGoal" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "isCompleted" BOOLEAN DEFAULT false,
  "completedAt" TIMESTAMP,
  "order" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now(),
  FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE
);

CREATE TABLE "SessionMessage" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "type" "MessageType" DEFAULT 'TEXT',
  "createdAt" TIMESTAMP DEFAULT now(),
  FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE,
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "SessionRecording" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER,
  "type" "RecordingType" NOT NULL,
  "duration" INTEGER,
  "createdAt" TIMESTAMP DEFAULT now(),
  FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE
);

CREATE TABLE "SessionWhiteboard" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "snapshot" TEXT,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now(),
  FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE
);

CREATE TABLE "SessionNote" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "lastEditBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now(),
  FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE,
  FOREIGN KEY ("lastEditBy") REFERENCES "User"("id")
);

CREATE TABLE "SessionAnalytics" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" TEXT UNIQUE NOT NULL,
  "totalMessages" INTEGER DEFAULT 0,
  "totalParticipants" INTEGER DEFAULT 0,
  "goalsCompleted" INTEGER DEFAULT 0,
  "goalsTotal" INTEGER DEFAULT 0,
  "whiteboardActions" INTEGER DEFAULT 0,
  "notesEdits" INTEGER DEFAULT 0,
  "avgParticipationScore" DOUBLE PRECISION,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now(),
  FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX "SessionSettings_sessionId_idx" ON "SessionSettings"("sessionId");
CREATE INDEX "SessionParticipant_userId_idx" ON "SessionParticipant"("userId");
CREATE INDEX "SessionParticipant_sessionId_idx" ON "SessionParticipant"("sessionId");
CREATE INDEX "SessionParticipant_status_idx" ON "SessionParticipant"("status");
CREATE INDEX "SessionGoal_sessionId_idx" ON "SessionGoal"("sessionId");
CREATE INDEX "SessionMessage_sessionId_idx" ON "SessionMessage"("sessionId");
CREATE INDEX "SessionMessage_senderId_idx" ON "SessionMessage"("senderId");
CREATE INDEX "SessionMessage_createdAt_idx" ON "SessionMessage"("createdAt");
CREATE INDEX "SessionRecording_sessionId_idx" ON "SessionRecording"("sessionId");
CREATE INDEX "SessionWhiteboard_sessionId_idx" ON "SessionWhiteboard"("sessionId");
CREATE INDEX "SessionNote_sessionId_idx" ON "SessionNote"("sessionId");
CREATE INDEX "StudySession_createdBy_idx" ON "StudySession"("createdBy");
CREATE INDEX "StudySession_status_idx" ON "StudySession"("status");
CREATE INDEX "StudySession_type_idx" ON "StudySession"("type");
CREATE INDEX "StudySession_agoraChannel_idx" ON "StudySession"("agoraChannel");
```

---

## 2. API ROUTES ARCHITECTURE

### 2.1 API Endpoints Overview

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/study-sessions/create` | Create new session | ✅ |
| GET | `/api/study-sessions/list` | List user's sessions | ✅ |
| GET | `/api/study-sessions/[sessionId]` | Get session details | ✅ |
| POST | `/api/study-sessions/[sessionId]/join` | Join a session | ✅ |
| POST | `/api/study-sessions/[sessionId]/leave` | Leave a session | ✅ |
| PATCH | `/api/study-sessions/[sessionId]/settings` | Update settings | ✅ (host) |
| POST | `/api/study-sessions/[sessionId]/invite` | Invite participants | ✅ (host) |
| POST | `/api/study-sessions/[sessionId]/start` | Start session (activate) | ✅ (host) |
| POST | `/api/study-sessions/[sessionId]/end` | End session | ✅ (host) |
| POST | `/api/study-sessions/[sessionId]/goals` | Add/update goals | ✅ |
| POST | `/api/study-sessions/[sessionId]/recording` | Toggle recording | ✅ (host) |
| GET | `/api/study-sessions/[sessionId]/agora-token` | Get Agora token | ✅ (participant) |
| POST | `/api/study-sessions/[sessionId]/messages` | Send chat message | ✅ (participant) |
| GET | `/api/study-sessions/[sessionId]/messages` | Get chat history | ✅ (participant) |
| PATCH | `/api/study-sessions/[sessionId]/whiteboard` | Update whiteboard | ✅ (participant) |
| PATCH | `/api/study-sessions/[sessionId]/notes` | Update notes | ✅ (participant) |
| GET | `/api/study-sessions/history` | Get past sessions | ✅ |

### 2.2 Detailed API Specifications

#### POST `/api/study-sessions/create`

**Request Body**:
```typescript
{
  title: string
  description?: string
  type: 'SOLO' | 'ONE_ON_ONE' | 'GROUP'
  subject?: string
  tags?: string[]
  maxParticipants?: number
  isPublic?: boolean
  scheduledAt?: string (ISO 8601)
  inviteUserIds?: string[] // User IDs to invite
  settings?: {
    enabledTools?: string[]
    layout?: string
    theme?: string
    autoRecord?: boolean
  }
}
```

**Response**:
```typescript
{
  success: true
  session: {
    id: string
    title: string
    status: 'SCHEDULED'
    agoraChannel: string
    createdAt: string
  }
  invitesSent: number
}
```

#### GET `/api/study-sessions/list`

**Query Params**:
```
?status=SCHEDULED|ACTIVE|COMPLETED
&type=SOLO|ONE_ON_ONE|GROUP
&limit=20
&offset=0
```

**Response**:
```typescript
{
  success: true
  sessions: [{
    id: string
    title: string
    status: string
    type: string
    scheduledAt: string | null
    participantCount: number
    createdBy: {
      id: string
      name: string
      avatarUrl: string
    }
  }]
  total: number
}
```

*(Continue with all other endpoints...)*

---

## 3. FRONTEND COMPONENTS

### 3.1 Component Hierarchy

```
/study-sessions (page)
├── StudySessionsPage (main page)
│   ├── Tabs: "My Sessions" | "Browse Sessions" | "Past Sessions"
│   ├── SessionListView
│   │   ├── SessionCard (clickable)
│   │   └── CreateSessionButton
│   └── Modals
│       ├── CreateSessionModal
│       ├── SessionDetailsModal
│       └── SessionInviteModal

/study-sessions/[sessionId] (active session room)
├── ActiveSessionPage
│   ├── SessionHeader (title, timer, participants count)
│   ├── VideoCallInterface (Agora)
│   │   ├── LocalVideoTrack
│   │   ├── RemoteVideoTracks
│   │   └── CallControls (mic, camera, screen share, end call)
│   ├── SessionToolbar (tab switcher)
│   └── SessionContent (tab-based layout)
│       ├── ChatTab (SessionChat)
│       ├── WhiteboardTab (SessionWhiteboard)
│       ├── NotesTab (SessionNotes)
│       ├── GoalsTab (SessionGoals)
│       └── ParticipantsTab (SessionParticipants)
```

### 3.2 Key Components

#### `<StudySessionsPage />`

**File**: `/src/app/study-sessions/page.tsx`

**Features**:
- Tab navigation (My Sessions / Browse / History)
- LocalStorage caching for session lists
- Search/filter by subject, tags, status
- Create session button
- Session cards with quick actions (Join, View Details, Cancel)

**State**:
```typescript
const [sessions, setSessions] = useState<Session[]>(() => {
  // Load from localStorage
  const cached = localStorage.getItem('studySessions')
  return cached ? JSON.parse(cached) : []
})
const [activeTab, setActiveTab] = useState<'my-sessions' | 'browse' | 'history'>('my-sessions')
const [showCreateModal, setShowCreateModal] = useState(false)
```

#### `<CreateSessionModal />`

**Features**:
- Step wizard: Basics → Settings → Invite
- Form validation
- Preview session before creating
- Invite participants by username search

#### `<ActiveSessionPage />`

**File**: `/src/app/study-sessions/[sessionId]/page.tsx`

**Features**:
- Real-time video/audio via Agora (reuse chat implementation)
- Tab-based tools (chat, whiteboard, notes, goals)
- Participant presence indicators
- Session timer
- Recording indicator (if enabled)
- End session button (host only)

**Hooks**:
```typescript
const { session, participants, loading } = useStudySession(sessionId)
const { isInCall, startCall, endCall, toggleVideo, toggleAudio } = useAgoraCall(session.agoraChannel)
const { messages, sendMessage } = useSessionChat(sessionId)
const { goals, addGoal, toggleGoal } = useSessionGoals(sessionId)
```

---

## 4. LOCALSTORAGE CACHING STRATEGY

### 4.1 Cache Keys

| Key | Purpose | Refresh Trigger |
|-----|---------|-----------------|
| `studySessions` | All user's sessions (list) | On session create/join/leave |
| `activeStudySession_{sessionId}` | Active session state | On session start/end |
| `studySessionHistory` | Past sessions list | On session complete |
| `upcomingStudySessions` | Scheduled sessions | On new invite/schedule |
| `sessionPreferences` | User's default session settings | On settings update |

### 4.2 Cache Implementation Pattern

```typescript
// Initial load from cache
const [sessions, setSessions] = useState<Session[]>(() => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('studySessions')
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch (e) {
        return []
      }
    }
  }
  return []
})

// Fetch fresh data + update cache
useEffect(() => {
  if (!user) return

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/study-sessions/list')
      const data = await res.json()
      if (data.success) {
        setSessions(data.sessions)
        localStorage.setItem('studySessions', JSON.stringify(data.sessions))
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    }
  }

  fetchSessions()

  // Poll every 30 seconds for live updates
  const interval = setInterval(fetchSessions, 30000)
  return () => clearInterval(interval)
}, [user])
```

### 4.3 What NOT to Cache

❌ **Never cache**:
- Agora tokens (security risk)
- Real-time chat messages (use Supabase Realtime)
- Participant presence status (use Supabase Realtime)
- Recording URLs with sensitive access tokens

✅ **Safe to cache**:
- Session metadata (title, description, schedule)
- User preferences (layout, theme)
- Past session summaries
- Goal lists (with Supabase sync)

---

## 5. INTEGRATION POINTS

### 5.1 Dashboard Integration

**Add "Study Sessions" Card**:

**File**: `/src/app/dashboard/page.tsx`

```tsx
{/* NEW: Study Sessions Card */}
<button
  onClick={() => router.push('/study-sessions')}
  className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-105 cursor-pointer text-left w-full"
>
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-sm font-medium text-gray-600">Active Sessions</h3>
    <span className="text-2xl">📚</span>
  </div>
  <p className="text-3xl font-bold text-gray-900">{activeSessionsCount}</p>
  <p className="text-xs text-blue-600 mt-2">Click to view →</p>
</button>
```

### 5.2 Chat Integration

**Add "Start Study Session" Button**:

When viewing a partner/group chat, add button to start session:

```tsx
<button
  onClick={() => handleStartSession(conversation.id, conversation.type)}
  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
>
  Start Study Session
</button>
```

**Handler**:
```typescript
const handleStartSession = async (partnerId: string, type: 'partner' | 'group') => {
  const sessionType = type === 'partner' ? 'ONE_ON_ONE' : 'GROUP'

  const response = await fetch('/api/study-sessions/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `Study Session with ${conversation.name}`,
      type: sessionType,
      inviteUserIds: type === 'partner' ? [partnerId] : [], // For groups, get member IDs
    }),
  })

  const data = await response.json()
  if (data.success) {
    router.push(`/study-sessions/${data.session.id}`)
  }
}
```

### 5.3 Groups Integration

**Add "Start Group Session" in Group Details**:

Similar to chat integration but pulls all group members.

### 5.4 Notifications Integration

**New Notification Types**:

Add to `prisma/schema.prisma`:
```prisma
enum NotificationType {
  // ... existing types ...
  SESSION_INVITE
  SESSION_STARTED
  SESSION_ENDED
  SESSION_REMINDER
}
```

**Send notification when invited**:
```typescript
await prisma.notification.create({
  data: {
    userId: inviteeId,
    type: 'SESSION_INVITE',
    title: 'Study Session Invite',
    message: `${inviterName} invited you to "${session.title}"`,
    actionUrl: `/study-sessions/${sessionId}`,
  },
})
```

---

## 6. IMPLEMENTATION PHASES

### Phase 1: Database & Core API (Days 1-2)

**Tasks**:
1. ✅ Extend Prisma schema (StudySession + related models)
2. ✅ Run migration SQL on Supabase
3. ✅ Generate Prisma client: `npx prisma generate`
4. ✅ Create core API routes:
   - POST `/api/study-sessions/create`
   - GET `/api/study-sessions/list`
   - GET `/api/study-sessions/[sessionId]`
   - POST `/api/study-sessions/[sessionId]/join`
   - POST `/api/study-sessions/[sessionId]/start`
   - POST `/api/study-sessions/[sessionId]/end`

**Testing**:
- Unit tests for API routes
- Verify Prisma queries work
- Test session lifecycle (create → join → start → end)

**Deliverables**:
- `create_study_sessions.sql`
- API route files
- Postman/Thunder Client test collection

---

### Phase 2: Real-time & Agora Integration (Days 2-3)

**Tasks**:
1. ✅ Add Supabase Realtime subscription for sessions:
   ```typescript
   export function subscribeToStudySession(
     sessionId: string,
     onUpdate: (update: SessionUpdate) => void
   )
   ```
2. ✅ Create Agora token endpoint:
   - Reuse `/api/messages/agora-token` OR
   - Create `/api/study-sessions/[sessionId]/agora-token`
3. ✅ Build `useAgoraCall` custom hook (extract from chat)
4. ✅ Build `useStudySession` custom hook (manages session state)
5. ✅ Create session chat API:
   - POST `/api/study-sessions/[sessionId]/messages`
   - GET `/api/study-sessions/[sessionId]/messages`

**Testing**:
- Test Realtime updates (participants joining/leaving)
- Test Agora video/audio in session room
- Test chat message sync

**Deliverables**:
- `/src/lib/supabase/realtime.ts` (updated)
- `/src/hooks/useAgoraCall.ts`
- `/src/hooks/useStudySession.ts`
- Chat API routes

---

### Phase 3: Frontend - Session List & Creation (Days 3-4)

**Tasks**:
1. ✅ Create `/src/app/study-sessions/page.tsx`
   - Tab navigation (My Sessions, Browse, History)
   - Session list view
   - LocalStorage caching
2. ✅ Build `<CreateSessionModal />` component
   - Form with title, description, type
   - Settings wizard (tools, layout, theme)
   - Participant invite search
3. ✅ Build `<SessionCard />` component
   - Display session info
   - Quick actions (Join, View, Cancel)
4. ✅ Add dashboard integration (session count card)

**Testing**:
- Test session creation flow
- Test localStorage caching
- Test session list filtering
- Test invite functionality

**Deliverables**:
- Study sessions page
- CreateSessionModal component
- SessionCard component
- Dashboard integration

---

### Phase 4: Active Session Room (Days 4-5)

**Tasks**:
1. ✅ Create `/src/app/study-sessions/[sessionId]/page.tsx`
   - Session header (title, timer, participants)
   - Video call interface (Agora)
   - Tab-based tools layout
2. ✅ Build session tools:
   - `<SessionChat />` - Real-time chat
   - `<SessionGoals />` - Goals sidebar with progress
   - `<SessionParticipants />` - Participant list with status
   - `<SessionTimer />` - Pomodoro/countdown timer
3. ✅ Build `<SessionWhiteboard />` (Phase 4b - optional for MVP)
4. ✅ Build `<SessionNotes />` (Phase 4b - optional for MVP)
5. ✅ Add recording toggle (host only)

**Testing**:
- Test joining session
- Test video/audio calls
- Test chat sync
- Test goal creation/completion
- Test participant presence

**Deliverables**:
- Active session page
- All tool components
- Video call integration
- Recording controls

---

### Phase 5: Analytics & History (Day 5)

**Tasks**:
1. ✅ Create session analytics:
   - Calculate analytics on session end
   - Save to `SessionAnalytics` table
2. ✅ Build session history view:
   - GET `/api/study-sessions/history`
   - Display past sessions with analytics
   - Show recordings (if available)
3. ✅ Generate AI summary (using OpenAI):
   - POST `/api/study-sessions/[sessionId]/ai-summary`
   - Summarize chat, goals, duration
4. ✅ Add past sessions tab to study-sessions page

**Testing**:
- Test analytics calculation
- Test history retrieval
- Test AI summary generation
- Verify recordings are accessible

**Deliverables**:
- Analytics API
- History view
- AI summary integration
- Complete session lifecycle

---

## 7. TESTING STRATEGY

### 7.1 Unit Tests

**API Routes**:
```typescript
// src/app/api/study-sessions/__tests__/create.test.ts
describe('POST /api/study-sessions/create', () => {
  it('should create a new session', async () => {
    const response = await request(app)
      .post('/api/study-sessions/create')
      .send({ title: 'Test Session', type: 'SOLO' })
      .set('Authorization', `Bearer ${authToken}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.session.id).toBeDefined()
  })

  it('should reject unauthenticated requests', async () => {
    const response = await request(app)
      .post('/api/study-sessions/create')
      .send({ title: 'Test' })

    expect(response.status).toBe(401)
  })
})
```

### 7.2 Integration Tests

**Session Lifecycle**:
```typescript
describe('Study Session Lifecycle', () => {
  it('should complete full lifecycle: create → join → start → end', async () => {
    // 1. Create session
    const createRes = await createSession({ title: 'Test' })
    const sessionId = createRes.body.session.id

    // 2. Join session
    const joinRes = await joinSession(sessionId, user2.id)
    expect(joinRes.body.success).toBe(true)

    // 3. Start session
    const startRes = await startSession(sessionId)
    expect(startRes.body.session.status).toBe('ACTIVE')

    // 4. End session
    const endRes = await endSession(sessionId)
    expect(endRes.body.session.status).toBe('COMPLETED')
    expect(endRes.body.session.durationMinutes).toBeGreaterThan(0)
  })
})
```

### 7.3 E2E Tests (Playwright/Cypress)

```typescript
test('Create and join study session', async ({ page, context }) => {
  // User 1: Create session
  await page.goto('/study-sessions')
  await page.click('button:has-text("Create Session")')
  await page.fill('input[name="title"]', 'Math Study Group')
  await page.click('button:has-text("Create")')

  // Copy invite link
  const inviteLink = await page.locator('[data-testid="invite-link"]').textContent()

  // User 2: Join via link (new context)
  const page2 = await context.newPage()
  await page2.goto(inviteLink)
  await page2.click('button:has-text("Join Session")')

  // Verify both users see each other
  await expect(page.locator('[data-testid="participant-list"]')).toContainText('2 participants')
  await expect(page2.locator('[data-testid="participant-list"]')).toContainText('2 participants')
})
```

### 7.4 Existing App Tests

**CRITICAL**: Run all existing tests to ensure no regression:

```bash
npm run test           # Unit tests
npm run test:e2e       # End-to-end tests
npm run lint           # Linting
npm run type-check     # TypeScript checks
```

**All tests must remain GREEN ✅**

---

## 8. SECURITY & PERFORMANCE

### 8.1 Security Considerations

1. **Authentication**:
   - All API routes require valid Supabase session
   - Verify user is participant before allowing access

2. **Authorization**:
   - Only HOST can end session, toggle recording, update settings
   - Only participants can access session data

3. **Input Validation**:
   ```typescript
   import { z } from 'zod'

   const createSessionSchema = z.object({
     title: z.string().min(1).max(100),
     description: z.string().max(500).optional(),
     type: z.enum(['SOLO', 'ONE_ON_ONE', 'GROUP']),
     maxParticipants: z.number().min(2).max(50).optional(),
   })
   ```

4. **Rate Limiting**:
   - Prevent spam session creation (max 10 per hour)
   - Throttle message sending (max 60/minute)

5. **Data Privacy**:
   - Never expose other users' email/phone
   - Recording URLs should be signed/temporary

### 8.2 Performance Optimizations

1. **Lazy Loading**:
   ```typescript
   // Load whiteboard only when tab is active
   const Whiteboard = dynamic(() => import('@/components/SessionWhiteboard'), {
     loading: () => <LoadingSpinner />,
     ssr: false
   })
   ```

2. **Pagination**:
   - Session list: 20 per page
   - Chat history: 50 messages, load more on scroll

3. **Caching Strategy**:
   - LocalStorage for session lists (instant load)
   - Supabase Realtime for live updates
   - Cache invalidation on session end

4. **WebSocket Optimization**:
   - Single Supabase Realtime connection per session
   - Unsubscribe when leaving session

5. **Database Indexing**:
   - All foreign keys indexed
   - Compound index on (userId, status) for fast filtering

---

## 9. FINAL DELIVERABLES CHECKLIST

### Documentation

- [ ] `STUDY_SESSION_IMPLEMENTATION_PLAN.md` (this document)
- [ ] `README_STUDY_SESSIONS.md` (user-facing feature guide)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Component documentation (Storybook - optional)

### Code

- [ ] Prisma schema updates
- [ ] SQL migration scripts
- [ ] All API routes (12+ endpoints)
- [ ] Frontend components (10+ components)
- [ ] Custom hooks (useAgoraCall, useStudySession, useSessionChat, useSessionGoals)
- [ ] Realtime subscription functions

### Testing

- [ ] Unit tests (API routes)
- [ ] Integration tests (session lifecycle)
- [ ] E2E tests (user flows)
- [ ] All existing tests still passing ✅

### Integration

- [ ] Dashboard integration
- [ ] Chat integration
- [ ] Groups integration
- [ ] Notifications integration

---

## 10. DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] Run database migration on production Supabase
- [ ] Verify environment variables are set
- [ ] Run full test suite (all green)
- [ ] Test on staging environment
- [ ] Performance audit (Lighthouse score > 90)
- [ ] Security audit (no exposed tokens, proper auth)
- [ ] Zero build warnings/errors
- [ ] Backward compatibility verified (all existing features work)
- [ ] Create rollback plan (database backup)

---

## 11. FUTURE ENHANCEMENTS (POST-MVP)

**Phase 2 Features**:
- Screen sharing (Agora Screen Share API)
- Live whiteboard collaboration (Excalidraw/Tldraw)
- Rich text notes (Quill/TipTap editor)
- File sharing in session
- Breakout rooms (split participants into sub-sessions)
- Session templates (save settings as template)
- Public session discovery (browse open sessions)
- Session ratings/reviews
- Calendar integration (Google Calendar, iCal)
- Mobile app support (React Native)

---

## CONCLUSION

This plan provides a **complete, production-ready roadmap** for implementing the Study-Session module in Clerva 2.0. By following the phased approach and reusing existing patterns, we minimize risk and ensure zero breaking changes.

**Next Steps**:
1. Review and approve this plan
2. Begin Phase 1 implementation
3. Iterate through phases with testing at each step

**Estimated Timeline**: 5-7 days for full implementation + testing.

---

**Document Status**: ✅ READY FOR IMPLEMENTATION
**Last Updated**: 2025-10-08
**Approved By**: [Pending]
