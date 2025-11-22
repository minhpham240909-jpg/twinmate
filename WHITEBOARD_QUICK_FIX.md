# Whiteboard Not Showing - Quick Fix Guide

## 🔴 **CRITICAL: Do This First**

### Step 1: Check Browser Console (1 minute)

1. Go to your beta site
2. Navigate to a study session
3. Click "Whiteboard" tab
4. Press F12 (or Cmd+Option+I on Mac)
5. Look at the Console tab

**What to look for**:
```
❌ "Refused to load the script because it violates Content Security Policy"
❌ "Refused to create a worker from 'blob:...'"
❌ "worker-src", "script-src", "CSP"
```

**If you see CSP errors** → 95% chance CSP is blocking tldraw

---

## 🎯 **Most Likely Issues** (Ranked)

### Issue #1: CSP Blocking (95% likelihood) 🔴

**Symptom**: Browser console shows CSP violation errors

**Quick Test**: Temporarily disable CSP

**Where**: `next.config.ts` lines 70-92

**What to do**: Comment out the entire CSP header temporarily

---

### Issue #2: React 19 Incompatibility (30% likelihood) 🟡

**Symptom**: No errors, whiteboard just doesn't render

**Reason**: Tldraw was built for React 18, you're using React 19

**Evidence**: `package.json` line 70: `"react": "^19.2.0"`

**Quick Check**:
```bash
npm info tldraw peerDependencies
# Will likely show: "react": "^18.0.0"
```

---

### Issue #3: Static Import (40% likelihood) 🟡

**Symptom**: Whiteboard briefly flashes then disappears

**Reason**: Tldraw is imported statically, needs dynamic import

**Where**: `SessionWhiteboard.tsx` line 4

**Current**:
```typescript
import { Tldraw } from 'tldraw'
```

**Should be**:
```typescript
const Tldraw = dynamic(() => import('tldraw').then(m => m.Tldraw), { ssr: false })
```

---

## 🔧 **Quick Diagnostic Commands**

### Check what you see in console:
```javascript
// Paste in browser console on whiteboard page
console.log('Tldraw loaded:', typeof window.Tldraw)
console.log('Worker support:', typeof Worker)
console.log('Blob support:', typeof Blob)
```

### Check DOM:
```javascript
// Find whiteboard container
document.querySelector('[style*="height: 600px"]')
// Should have children if tldraw rendered
```

---

## 📊 **Decision Tree**

```
Browser Console has errors?
├─ YES → CSP errors?
│  ├─ YES → Fix CSP (Solution 1)
│  └─ NO → React errors? → Check React 19 (Solution 2)
└─ NO → Whiteboard div is empty?
   ├─ YES → Use dynamic import (Solution 3)
   └─ NO → Check styles (Solution 4)
```

---

## 🚀 **Solutions** (When Ready to Fix)

### Solution 1: Fix CSP (If CSP errors in console)
Add `blob:` to CSP directives in `next.config.ts`

### Solution 2: Downgrade React (If no errors but doesn't render)
Change React 19 → React 18 in `package.json`

### Solution 3: Dynamic Import (If flashing/disappearing)
Use `dynamic()` import for Tldraw component

### Solution 4: Container Styles (If rendering but broken)
Add `overflow-hidden` to container div

---

## 📝 **What to Report Back**

Please check and report:

1. **Browser Console Errors**:
   - [ ] Screenshot of console errors
   - [ ] Copy/paste error messages
   - [ ] Note if "CSP" or "blob" appears

2. **Network Tab**:
   - [ ] Does `tldraw.css` load? (should be ~98KB)
   - [ ] Any failed network requests?

3. **DOM Inspector**:
   - [ ] Is whiteboard container div empty?
   - [ ] Screenshot of DOM structure

4. **React DevTools** (if installed):
   - [ ] Does `SessionWhiteboard` component show?
   - [ ] Does `Tldraw` component show under it?

---

## 🎯 **Expected Outcome**

**Most likely**: Console will show CSP error blocking blob: URLs

**Then we know**: Need to fix CSP in `next.config.ts`

**Confidence**: 95% this is the issue

---

**Next**: Check console and report what you see!
