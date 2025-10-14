# 🎯 Picture-in-Picture + Quick Actions Implementation Plan

## 📋 WHAT WE'RE BUILDING

**Option F: PiP Mode + Quick Actions Menu**

Users can:
1. **Keep video fullscreen** and use **Quick Actions** for quick access
2. **Minimize video to PiP** and get **full access** to all session features

---

## 🏗️ ARCHITECTURE OVERVIEW

### **Two Modes:**

#### **Mode 1: Fullscreen Video (Default)**
```
┌─────────────────────────────────────────────┐
│ 📹 FULLSCREEN VIDEO CALL                   │
│                                             │
│ [Floating Quick Actions Menu - Left Side]  │
│ ┌────────┐                                 │
│ │ ⏱️     │ ← Timer overlay                │
│ │ 💬     │ ← Chat overlay                 │
│ │ ✅     │ ← Goals overlay                │
│ │ 👥     │ ← Participants overlay         │
│ │ 📨     │ ← Invite modal                 │
│ │ ⬇️     │ ← Minimize to PiP             │
│ └────────┘                                 │
│                                             │
│ [Video Controls - Bottom Center]           │
│ 🎤 📹 🖥️ ❌                               │
└─────────────────────────────────────────────┘
```

#### **Mode 2: Picture-in-Picture**
```
┌─────────────────────────────────────────────┐
│ 📊 FULL STUDY SESSION PAGE                 │
│ ┌────────────────────────────────────────┐ │
│ │ Tabs: Timer | Chat | Goals | Parts    │ │
│ │                                        │ │
│ │ [Full access to all features]         │ │
│ │ - Create/edit goals                   │ │
│ │ - Read full chat history              │ │
│ │ - See all participants                │ │
│ │ - Invite new members                  │ │
│ │ - Control timer                       │ │
│ └────────────────────────────────────────┘ │
│                                             │
│ ┌──────────────┐ ← Floating PiP Video      │
│ │ 📹 Video     │   (Draggable & Resizable) │
│ │ [You][Partner]│                           │
│ │ 🎤📹⬆️❌    │   Controls always visible │
│ └──────────────┘                           │
└─────────────────────────────────────────────┘
```

---

## 🛠️ IMPLEMENTATION STEPS

### **Phase 1: Add PiP Toggle Button** ✅

**Files to modify:**
- `VideoCall.tsx` - Add minimize button
- `page.tsx` - Add state for `pipMode`

**What it does:**
- Button in fullscreen video: "⬇️ Minimize"
- Switches from fullscreen → PiP mode
- Video becomes small floating window
- Study session page becomes fully visible

---

### **Phase 2: Create PiP Video Component**

**New file to create:**
- `PipVideoWindow.tsx` - Floating draggable video window

**Features:**
- Draggable anywhere on screen
- Resizable (small/medium/large)
- Always on top (z-index: 9999)
- Shows video feeds + basic controls
- "⬆️ Maximize" button to go back fullscreen

**Technical:**
```typescript
- Position: fixed
- Size: 320x240px (default)
- Can drag with mouse
- Can resize by corners
- Persists position in localStorage
```

---

### **Phase 3: Quick Actions Floating Menu**

**Add to VideoCall.tsx:**
- Floating button menu on left side
- 6 action buttons:
  1. ⏱️ Timer
  2. 💬 Chat
  3. ✅ Goals
  4. 👥 Participants
  5. 📨 Invite
  6. ⬇️ Minimize to PiP

**Behavior:**
- Always visible in fullscreen mode
- Hidden in PiP mode
- Click button → Shows overlay

---

### **Phase 4: Create Overlay Components**

**New files to create:**

1. **`TimerOverlay.tsx`**
   - Shows timer controls
   - Start/pause/reset
   - Semi-transparent background
   - Closes when clicking outside

2. **`ChatOverlay.tsx`**
   - Shows recent messages (last 10)
   - Quick send message input
   - "View Full Chat" button
   - Semi-transparent background

3. **`GoalsOverlay.tsx`**
   - Shows session goals
   - Check/uncheck boxes
   - "View All Goals" button
   - Semi-transparent background

4. **`ParticipantsOverlay.tsx`**
   - Shows who's online
   - Shows who's in video call
   - Online status indicators
   - Semi-transparent background

**Design pattern:**
```typescript
interface OverlayProps {
  sessionId: string
  onClose: () => void
}

// All overlays follow same pattern:
- Positioned over video (z-index: 50)
- Dark glassmorphism background
- Close button (X)
- Minimal, quick-access UI
```

---

### **Phase 5: Connect Everything Together**

**Update `page.tsx`:**
```typescript
const [videoPipMode, setVideoPipMode] = useState(false)

// When PiP mode ON:
- Show study session page normally
- Show PipVideoWindow floating
- Hide fullscreen video

// When PiP mode OFF:
- Show fullscreen video
- Show Quick Actions menu
- Hide study session page
```

**Update `VideoCall.tsx`:**
```typescript
// Props
pipMode: boolean
onTogglePip: () => void

// Render logic
if (pipMode) {
  return <PipVideoWindow ... />
} else {
  return <FullscreenVideo with QuickActions ... />
}
```

---

## 📐 COMPONENT STRUCTURE

```
page.tsx (Study Session)
├── [PiP Mode OFF]
│   └── VideoCall (fullscreen)
│       ├── VideoGrid
│       ├── Controls
│       ├── QuickActionsMenu
│       │   ├── TimerOverlay
│       │   ├── ChatOverlay
│       │   ├── GoalsOverlay
│       │   └── ParticipantsOverlay
│       └── InCallMessagePopup
│
└── [PiP Mode ON]
    ├── Study Session Page (normal view)
    │   ├── Tabs: Timer, Chat, Goals, Parts
    │   └── All features accessible
    └── PipVideoWindow (floating)
        ├── VideoGrid (small)
        ├── Basic Controls
        └── Maximize Button
```

---

## 🎨 DESIGN SPECIFICATIONS

### **PiP Window:**
- **Default size:** 320x240px
- **Min size:** 240x180px
- **Max size:** 640x480px
- **Position:** Bottom-right corner (default)
- **Background:** Dark with border
- **Controls:** Always visible
- **Draggable:** Yes
- **Resizable:** Yes (corners)

### **Quick Actions Menu:**
- **Position:** Left side, 20px from edge
- **Size:** 60px wide buttons
- **Spacing:** 10px between buttons
- **Background:** Dark semi-transparent
- **Hover:** Tooltip shows label
- **Active:** Highlighted when overlay open

### **Overlays:**
- **Width:** 400px
- **Max height:** 60% of viewport
- **Position:** Center of video area
- **Background:** `bg-gray-900/95 backdrop-blur-lg`
- **Border:** `border border-white/10`
- **Shadow:** `shadow-2xl`
- **Animation:** Fade in/out

---

## ⚙️ STATE MANAGEMENT

```typescript
// In page.tsx
const [videoPipMode, setVideoPipMode] = useState(false)

// In VideoCall.tsx
const [activeOverlay, setActiveOverlay] = useState<OverlayType | null>(null)
const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 })
const [pipSize, setPipSize] = useState({ width: 320, height: 240 })
```

---

## 🔄 USER FLOWS

### **Flow 1: Using Quick Actions**
```
1. User in fullscreen video
2. Clicks ⏱️ Timer button
3. TimerOverlay appears over video
4. Can start/pause timer
5. Clicks X or outside → Overlay closes
6. Still in video call
```

### **Flow 2: Entering PiP Mode**
```
1. User in fullscreen video
2. Clicks ⬇️ Minimize button
3. Video shrinks to floating window
4. Study session page becomes visible
5. User can access all tabs/features
6. Video stays connected
```

### **Flow 3: Exiting PiP Mode**
```
1. User in PiP mode
2. Clicks ⬆️ Maximize button on PiP window
3. Video expands to fullscreen
4. Study session page hidden
5. Back to fullscreen video with Quick Actions
```

---

## 🧪 TESTING CHECKLIST

After implementation:

- [ ] PiP window appears in correct position
- [ ] PiP window is draggable
- [ ] PiP window is resizable
- [ ] Video feeds work in PiP mode
- [ ] Controls work in PiP mode
- [ ] Quick Actions menu appears in fullscreen
- [ ] Timer overlay shows and works
- [ ] Chat overlay shows recent messages
- [ ] Goals overlay shows and updates
- [ ] Participants overlay shows online status
- [ ] Invite button opens modal
- [ ] Can switch between PiP and fullscreen
- [ ] No video/audio disruption when switching
- [ ] Position/size persists across sessions

---

## 📊 TECHNICAL COMPLEXITY

| Component | Lines of Code | Complexity | Time Estimate |
|-----------|--------------|------------|---------------|
| PipVideoWindow | ~200 | Medium | 1 hour |
| QuickActionsMenu | ~100 | Easy | 30 min |
| TimerOverlay | ~150 | Easy | 30 min |
| ChatOverlay | ~200 | Medium | 45 min |
| GoalsOverlay | ~150 | Easy | 30 min |
| ParticipantsOverlay | ~150 | Easy | 30 min |
| Drag/Resize Logic | ~100 | Hard | 1 hour |
| State Integration | ~50 | Medium | 30 min |
| **TOTAL** | **~1100** | **Medium** | **~5 hours** |

---

## 🚀 READY TO START?

This is a significant feature addition (~1100 lines of code).

**Do you want me to:**

A) **Implement everything now** (will take many messages due to file size)
B) **Implement Phase 1-2 first** (PiP mode only), test, then add Quick Actions
C) **See a working example first** (I create a simplified demo)
D) **Get more details** on a specific part before starting

**What's your preference?** 🎯
