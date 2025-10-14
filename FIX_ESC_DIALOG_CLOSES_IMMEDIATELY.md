# Fix: ESC Dialog Closes Immediately

## Issue Description

**Problem:** When pressing ESC to leave the call, the confirmation dialog appears but closes immediately (within 1 second).

**Expected Behavior:** Dialog should stay open until user clicks "OK" or "Cancel".

**Root Cause:** The keyboard event listener was still active while the dialog was open. When the user pressed ESC, it triggered:
1. First ESC press → Opens the dialog
2. Same ESC key event → Closes the dialog (because browser's `confirm()` also responds to ESC)

Result: Dialog appears and disappears instantly.

---

## Solution Implemented

### Strategy

Added a flag to temporarily disable keyboard shortcuts while the confirmation dialog is open.

### Code Changes

**File:** `src/components/study-sessions/VideoCall.tsx`

#### 1. Added Dialog State Tracker

```typescript
const isShowingDialogRef = useRef(false)
```

#### 2. Updated Keyboard Handler

```typescript
const handleKeyPress = (e: KeyboardEvent) => {
  // Ignore if dialog is open
  if (isShowingDialogRef.current) {
    return
  }

  // ... rest of keyboard handling

  // ESC key - Leave call
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation() // Also stop event propagation
    handleLeaveCall()
  }
}
```

#### 3. Updated Leave Call Handler

```typescript
const handleLeaveCall = async () => {
  // Mark that dialog is showing
  isShowingDialogRef.current = true

  // Show confirmation dialog
  const shouldLeave = confirm('Are you sure you want to leave the call?')

  // Mark that dialog is closed
  isShowingDialogRef.current = false

  if (shouldLeave) {
    await leaveCall()
    onCallEnd()
  }
}
```

---

## How It Works

### Before Fix:
```
User presses ESC
  ↓
Dialog opens
  ↓
ESC key event continues
  ↓
Browser closes dialog (ESC closes confirm dialogs)
  ↓
Dialog disappears immediately
```

### After Fix:
```
User presses ESC
  ↓
Set isShowingDialogRef = true
  ↓
Dialog opens
  ↓
Any ESC presses ignored (isShowingDialogRef is true)
  ↓
User clicks OK or Cancel
  ↓
Set isShowingDialogRef = false
  ↓
Dialog properly handled
```

---

## Key Improvements

1. **Dialog Flag:** `isShowingDialogRef` tracks if dialog is open
2. **Early Return:** Keyboard handler exits early if dialog is showing
3. **Stop Propagation:** `e.stopPropagation()` prevents event bubbling
4. **State Management:** Flag set before dialog, cleared after

---

## Testing

### Test Scenario 1: ESC Dialog
1. Join video call
2. Press ESC
3. **Expected:** Dialog stays open
4. **Expected:** Can click "OK" to leave
5. **Expected:** Can click "Cancel" to stay

### Test Scenario 2: Multiple ESC Presses
1. Join video call
2. Press ESC (dialog opens)
3. Press ESC again while dialog open
4. **Expected:** Dialog stays open
5. **Expected:** No new dialogs appear

### Test Scenario 3: Leave Button Still Works
1. Join video call
2. Click the red "Leave Call" button
3. **Expected:** Dialog appears and stays
4. **Expected:** Works exactly as before

---

## Edge Cases Handled

✅ **Dialog is showing** → Keyboard shortcuts disabled
✅ **User spams ESC** → Only first press counts
✅ **Click button vs. keyboard** → Both work the same
✅ **Cancel dialog** → Can use ESC again

---

## No Breaking Changes

- ✅ Leave button still works
- ✅ M and V keys still work
- ✅ All other features unchanged
- ✅ Only fixes the ESC dialog issue

---

*Fix Applied: January 13, 2025*
*Issue: ESC dialog closes immediately*
*Status: ✅ Fixed*
