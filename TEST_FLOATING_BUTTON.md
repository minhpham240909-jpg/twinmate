# Testing Floating Button - Debug Steps

## Flow Analysis:

1. **User is on session page** (`/study-sessions/[sessionId]`)
   - BackgroundSessionContext: `activeSessionId = null` (cleared by useEffect line 107)
   - FloatingSessionButton: Won't show (no activeSessionId)
   - ✅ CORRECT - shouldn't show on session page

2. **User clicks "Go to Dashboard"** (line 244)
   - Calls `setActiveSessionId(sessionId)`
   - This updates BackgroundSessionContext state
   - This also updates localStorage
   - Then navigates to `/dashboard`

3. **User arrives on dashboard** (`/dashboard`)
   - BackgroundSessionContext: Should have `activeSessionId = sessionId`
   - FloatingSessionButton: Should check context and show button
   - pathname = `/dashboard` (doesn't start with `/study-sessions/${sessionId}`)
   - ✅ Should show button

## Potential Issue:

The problem might be in the **session page useEffect** (lines 103-118):

```typescript
useEffect(() => {
  const clearBackgroundSession = () => {
    const storedSessionId = localStorage.getItem('activeSessionId')
    if (storedSessionId === sessionId) {
      setActiveSessionId(null)  // <-- This clears it!
    }
  }
  clearBackgroundSession()
  // ...
}, [sessionId, setActiveSessionId])
```

This runs EVERY TIME the component mounts, including when you first load the page!

## The Bug:

When you're ON the session page and click "Go to Dashboard":
1. `setActiveSessionId(sessionId)` is called
2. localStorage is updated
3. **BUT** the useEffect (line 103) runs and sees that localStorage has the session
4. It immediately calls `setActiveSessionId(null)` and clears it!
5. Then navigation happens
6. You arrive at dashboard with NO active session

## The Fix Needed:

We need to delay the clearing until AFTER navigation completes, OR only clear when actually returning to the page, not when leaving it.
