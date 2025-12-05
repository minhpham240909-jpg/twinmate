# Clerva App - Outstanding Issues

This document lists high and medium priority issues identified during the comprehensive app audit.
All critical issues have been fixed.

---

## HIGH PRIORITY ISSUES

### 1. Profile Picture Size Validation
**Location:** `src/app/api/settings/profile/route.ts`
**Issue:** No file size limit enforcement for profile picture uploads
**Impact:** Users could upload very large files, consuming storage and bandwidth
**Recommendation:** Add file size validation (e.g., max 5MB) before upload

### 2. Conversation Pagination
**Location:** `src/app/api/messages/conversations/route.ts`
**Issue:** No pagination implemented - loads all conversations at once
**Impact:** Performance degradation for users with many conversations
**Recommendation:** Implement cursor-based pagination with limit parameter

### 3. Session Timer Race Conditions
**Location:** `src/app/api/study-sessions/[sessionId]/timer/route.ts`
**Issue:** Concurrent timer start/stop operations could cause state inconsistencies
**Impact:** Timer displays could show incorrect state between participants
**Recommendation:** Add optimistic locking or mutex for timer operations

### 4. Email Change Verification Flow
**Location:** `src/app/api/settings/email/route.ts`
**Issue:** No verification that user owns the new email before completing change
**Impact:** Users could change to any email address without verification
**Recommendation:** Send verification link to new email, only complete change after verification

### 5. Search Query Sanitization
**Location:** `src/app/api/search/route.ts`
**Issue:** Complex search queries with special characters could cause issues
**Impact:** Potential query parsing errors or unexpected results
**Recommendation:** Add comprehensive input sanitization for search terms

### 6. Group Member Limit Enforcement
**Location:** `src/app/api/groups/join/route.ts`
**Issue:** Member limit only checked at invite time, not at join time
**Impact:** Groups could exceed their member limit in race conditions
**Recommendation:** Add atomic check-and-join operation with transaction

### 7. Notification Cleanup
**Location:** `src/app/api/notifications/route.ts`
**Issue:** No automatic cleanup of old notifications
**Impact:** Notification table grows indefinitely, affecting query performance
**Recommendation:** Add scheduled job to archive/delete notifications older than 30 days

### 8. Password Strength Indicator
**Location:** `src/components/auth/SignUpForm.tsx`
**Issue:** No visual password strength indicator during registration
**Impact:** Users may create weak passwords unknowingly
**Recommendation:** Add real-time password strength meter

---

## MEDIUM PRIORITY ISSUES

### 1. Presence Heartbeat Optimization
**Location:** `src/lib/presence.ts`
**Issue:** Heartbeat interval of 15 seconds may be too frequent
**Impact:** Unnecessary database writes, especially for inactive users
**Recommendation:** Implement adaptive heartbeat (30s active, 60s idle)

### 2. Message Input Character Limit Display
**Location:** `src/components/chat/ChatInput.tsx`
**Issue:** No visual indicator showing remaining characters before limit
**Impact:** Users surprised when hitting the limit
**Recommendation:** Show character count when approaching limit (e.g., 900/1000)

### 3. Session History Soft Delete
**Location:** `src/app/api/history/study-sessions/route.ts`
**Issue:** Deleted sessions still appear in some queries
**Impact:** Inconsistent user experience when viewing session history
**Recommendation:** Add consistent `isDeleted: false` filter to all session queries

### 4. Group Chat Typing Indicators
**Location:** `src/components/chat/GroupChat.tsx`
**Issue:** No typing indicators in group chats
**Impact:** Less engaging chat experience compared to DMs
**Recommendation:** Add typing indicator using presence system

### 5. Community Post Edit History
**Location:** `src/app/api/community/posts/[postId]/route.ts`
**Issue:** No edit history tracked for posts
**Impact:** No way to see what was changed in edited posts
**Recommendation:** Store edit history in separate table

### 6. Session Invite Expiration
**Location:** `src/app/api/study-sessions/[sessionId]/invite/route.ts`
**Issue:** Session invites don't expire
**Impact:** Stale invites can accumulate over time
**Recommendation:** Add 7-day expiration for pending invites

### 7. Profile Completion Gamification
**Location:** `src/app/api/settings/profile-completion/route.ts`
**Issue:** Profile completion shown but no incentive to complete
**Impact:** Users may ignore incomplete profiles
**Recommendation:** Add badges or benefits for 100% profile completion

### 8. Connection Request Message Preview
**Location:** `src/components/partners/ConnectionRequest.tsx`
**Issue:** Long connection request messages truncated without expansion
**Impact:** Important context in messages could be missed
**Recommendation:** Add "Read more" expansion for long messages

### 9. Search Result Highlighting
**Location:** `src/components/search/SearchResults.tsx`
**Issue:** Search terms not highlighted in results
**Impact:** Harder to identify why results matched
**Recommendation:** Highlight matching terms in search results

### 10. Accessibility: Focus Management
**Location:** Various modal components
**Issue:** Focus not trapped in modals, keyboard navigation incomplete
**Impact:** Reduced accessibility for keyboard/screen reader users
**Recommendation:** Add focus trap to all modals, ensure proper ARIA labels

### 11. Error Boundary Coverage
**Location:** `src/app/layout.tsx`
**Issue:** No error boundaries around major feature sections
**Impact:** Single component error could crash entire page
**Recommendation:** Add error boundaries around Chat, Sessions, Groups sections

### 12. API Response Caching
**Location:** Various GET endpoints
**Issue:** No HTTP caching headers on cacheable responses
**Impact:** Unnecessary API calls, slower page loads
**Recommendation:** Add Cache-Control headers where appropriate (e.g., user profile)

---

## NOTES

- Critical issues (6 total) have been fixed in this session
- High priority issues should be addressed before production launch
- Medium priority issues are enhancements that improve UX and performance
- No security vulnerabilities remain in the critical category

## SUMMARY

| Priority | Count | Status |
|----------|-------|--------|
| Critical | 6 | Fixed |
| High | 8 | Pending |
| Medium | 12 | Pending |

---

*Document generated: December 3, 2025*
*Audit scope: All interior app features (excluding admin dashboard)*
