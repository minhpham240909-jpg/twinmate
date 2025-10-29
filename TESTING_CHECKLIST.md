# 🧪 AI Agent Testing Checklist

**Purpose:** Comprehensive testing guide to verify 100% functionality
**Status:** Ready for testing
**Last Updated:** Current Session

---

## 📋 TESTING OVERVIEW

### Testing Strategy:
1. **Manual Testing:** User flows and feature verification
2. **API Testing:** Direct endpoint testing
3. **Database Verification:** Confirm data persistence
4. **Performance Benchmarks:** Measure response times

### Test Environment:
- Local development server: `npm run dev`
- Test user account required
- Test documents prepared (PDF, Word, text)
- Multiple browser tabs for multi-user tests

---

## 🔬 TEST 1: RAG Pipeline End-to-End

### Objective:
Verify document upload → chunking → embedding → retrieval → citation works perfectly.

### Steps:

#### 1.1 Upload Test Document
```bash
# Create a test PDF or use existing one
# Upload via AI chat interface or upload endpoint
POST /api/ai-agent/upload
Content-Type: multipart/form-data
{
  file: [test-document.pdf]
}
```

**Expected Result:**
- ✅ File uploads successfully
- ✅ Returns doc_source ID
- ✅ Status shows "processing" then "ready"

**Verification Query:**
```sql
SELECT id, title, source_type, status, created_at
FROM doc_source
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 1;
```

#### 1.2 Verify Chunking
**Verification Query:**
```sql
SELECT COUNT(*) as chunk_count, AVG(token_count) as avg_tokens
FROM doc_chunk
WHERE doc_id = 'DOC_ID_FROM_STEP_1';

-- Should show multiple chunks, ~500 tokens average
```

**Expected Result:**
- ✅ Multiple chunks created (depends on document size)
- ✅ Each chunk has content
- ✅ Each chunk has embedding (vector not null)
- ✅ Chunks have sequential ord (0, 1, 2, ...)

#### 1.3 Test Retrieval
Ask AI a question about the uploaded document:

**Test Query:**
```
"What are the main topics covered in the document I just uploaded?"
```

**Expected Result:**
- ✅ AI responds with content from the document
- ✅ Response includes citations
- ✅ Clicking "Sources (N)" shows document excerpts
- ✅ Citations reference the uploaded document

**Backend Verification:**
Check telemetry logs should show:
```json
{
  "step": "rag_retrieval",
  "chunksRetrieved": 5,
  "totalFound": 10
}
```

### Test Documents:
- ✅ Test PDF (academic paper, notes, etc.)
- ✅ Test Word doc (.docx)
- ✅ Test text file (.txt)

### Success Criteria:
- [ ] PDF uploads and becomes searchable
- [ ] Word doc uploads and becomes searchable
- [ ] Text file uploads and becomes searchable
- [ ] AI cites sources correctly
- [ ] Sources appear in collapsible section
- [ ] Retrieval latency < 500ms

---

## 🛠️ TEST 2: All 11 Tools Individual Testing

### 2.1 searchNotes
**Test Query:**
```
"Search my notes for information about React hooks"
```

**Expected Result:**
- ✅ Returns relevant chunks from uploaded documents
- ✅ Shows similarity scores
- ✅ Citations appear in response

**Database Verification:**
```sql
-- Check telemetry
SELECT * FROM agent_telemetry
WHERE tool_name = 'searchNotes'
ORDER BY created_at DESC LIMIT 1;
```

---

### 2.2 summarizeSession
**Test Setup:**
Create a study session with some chat messages, then ask:
```
"Can you summarize my last study session?"
```

**Expected Result:**
- ✅ Returns summary with key points
- ✅ Suggests flashcards based on session
- ✅ Suggests follow-up tasks
- ✅ Summary card appears in chat

**Database Verification:**
```sql
-- Check session exists
SELECT id, subject, status, created_at
FROM study_session
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC LIMIT 1;
```

---

### 2.3 generateQuiz
**Test Query:**
```
"Generate a 5-question quiz on Python functions"
```

**Expected Result:**
- ✅ Quiz created with 5 questions
- ✅ Each question has 4 options
- ✅ Correct answers marked
- ✅ Quiz card appears with "Take Quiz" button
- ✅ Clicking button navigates to quiz page

**Database Verification:**
```sql
-- Check quiz created
SELECT id, title, subject, question_count
FROM quiz
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC LIMIT 1;

-- Check questions
SELECT id, question_text, correct_answer
FROM quiz_question
WHERE quiz_id = 'QUIZ_ID_FROM_ABOVE';
```

**Performance:**
- ⏱️ Should complete in < 10 seconds

---

### 2.4 addFlashcards
**Test Query:**
```
"Create flashcards for the following terms: React, useState, useEffect"
```

**Expected Result:**
- ✅ Flashcards created (at least 3)
- ✅ Each has front and back text
- ✅ Card shows "N cards saved"
- ✅ "Review Cards" button appears
- ✅ Clicking navigates to flashcards

**Database Verification:**
```sql
-- Check flashcards
SELECT id, front, back, created_at
FROM flashcard
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC LIMIT 5;
```

---

### 2.5 createStudyPlan
**Test Query:**
```
"Create a 1-week study plan for learning JavaScript"
```

**Expected Result:**
- ✅ Study plan created with title
- ✅ Multiple tasks across 7 days
- ✅ Each task has description and duration
- ✅ Plan card appears with "View Plan" button

**Database Verification:**
```sql
-- Check study plan
SELECT id, title, subject, start_date, end_date
FROM study_plan
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC LIMIT 1;

-- Check tasks
SELECT id, title, day_of_week, duration_minutes
FROM study_task
WHERE plan_id = 'PLAN_ID_FROM_ABOVE';
```

---

### 2.6 buildLearningProfile
**Test Setup:**
1. Take a quiz (from 2.3)
2. Ask AI to analyze performance

**Test Query:**
```
"Analyze my quiz performance and update my learning profile"
```

**Expected Result:**
- ✅ Profile updated with strengths
- ✅ Profile updated with weaknesses
- ✅ Recommendations based on performance

**Database Verification:**
```sql
-- Check profile updates
SELECT subjects, strengths, weaknesses
FROM learning_profile
WHERE user_id = 'YOUR_USER_ID';
```

---

### 2.7 matchCandidates
**Test Setup:**
Create 2-3 test users with overlapping subjects in their profiles.

**Test Query:**
```
"Find me study partners who are learning React"
```

**Expected Result:**
- ✅ Returns list of compatible candidates
- ✅ Shows compatibility scores
- ✅ Shows subject overlap
- ✅ Shows learning style match

**Database Verification:**
```sql
-- Check other users exist with matching subjects
SELECT user_id, subjects, study_style
FROM Profile
WHERE 'React' = ANY(subjects)
AND user_id != 'YOUR_USER_ID';
```

---

### 2.8 matchInsight
**Test Query:**
```
"Give me detailed insight on studying with [PARTNER_ID]"
```

**Expected Result:**
- ✅ Detailed compatibility analysis
- ✅ Shows `canStudyNow: true/false`
- ✅ If false, shows `nextBestTimes` array
- ✅ Card shows "Start Now" or "Schedule Later"
- ✅ Clicking button takes appropriate action

**Database Verification:**
```sql
-- Check presence
SELECT user_id, is_online, last_seen
FROM presence
WHERE user_id = 'PARTNER_ID';

-- Check availability
SELECT day_of_week, start_time, end_time
FROM availability
WHERE user_id = 'PARTNER_ID';
```

---

### 2.9 getOnlineUsers
**Test Setup:**
Set your presence to online, have test users online.

**Test Query:**
```
"Who is online right now that I can study with?"
```

**Expected Result:**
- ✅ Returns list of online users
- ✅ Shows when they came online
- ✅ Shows current activity (if set)

**Database Verification:**
```sql
-- Check presence table
SELECT user_id, is_online, current_activity, last_seen
FROM presence
WHERE is_online = true
AND user_id != 'YOUR_USER_ID';
```

---

### 2.10 getAvailability
**Test Query:**
```
"When is [PARTNER_NAME] available this week?"
```

**Expected Result:**
- ✅ Returns availability windows
- ✅ Shows day of week + time ranges
- ✅ Timezone-aware display

**Database Verification:**
```sql
SELECT day_of_week, start_time, end_time, timezone
FROM availability
WHERE user_id = 'PARTNER_ID'
ORDER BY day_of_week, start_time;
```

---

### 2.11 sendNudge
**Test Query:**
```
"Send a nudge to [PARTNER_NAME] to study together"
```

**Expected Result:**
- ✅ Notification created
- ✅ Shows success message
- ✅ Partner receives notification (check their account)

**Database Verification:**
```sql
-- Check notification created
SELECT id, user_id, type, title, message, is_read
FROM notification
WHERE user_id = 'PARTNER_ID'
ORDER BY created_at DESC LIMIT 1;
```

---

## 🤝 TEST 3: Real-Time Partner Matching

### Test Scenario: Study Now Flow

**Setup:**
1. Create User A (you)
2. Create User B (test account)
3. Set both users' profiles with subject: "Python"
4. Set User B online (presence.is_online = true)
5. Add availability window for User B (current time)

**Test Steps:**

**Step 1:** Ask for partners
```
"Find me someone to study Python with right now"
```

**Expected:**
- ✅ Returns User B
- ✅ Shows high compatibility
- ✅ Card shows "Start Now" button

**Step 2:** Click "Start Now"

**Expected:**
- ✅ Navigates to `/study-sessions/create?partnerId=USER_B_ID`
- ✅ Session creation form pre-filled
- ✅ Can create session immediately

---

### Test Scenario: Schedule Later Flow

**Setup:**
1. Set User B offline (presence.is_online = false)
2. User B has availability windows for future times

**Test Steps:**

**Step 1:** Ask for partners
```
"Find me someone to study Python with"
```

**Expected:**
- ✅ Returns User B
- ✅ Shows compatibility
- ✅ Card shows "Schedule Later" button

**Step 2:** Click "Schedule Later"

**Expected:**
- ✅ Shows next best times (e.g., "Monday 2-4pm", "Wednesday 10am-12pm")
- ✅ Can select a time to schedule

**Database Verification:**
```sql
-- Verify nextBestTimes calculation
SELECT a.day_of_week, a.start_time, a.end_time, p.is_online
FROM availability a
JOIN presence p ON p.user_id = a.user_id
WHERE a.user_id = 'USER_B_ID';
```

---

## ⚡ TEST 4: Performance Benchmarks

### 4.1 Simple Query Performance
**Test Query:**
```
"What is React?"
```

**Expected:**
- ⏱️ First token appears in < 500ms (streaming)
- ⏱️ Complete response in < 3 seconds
- ✅ No RAG retrieval needed (general knowledge)

**Measurement:**
```javascript
// Browser DevTools Network tab
// Look for /api/ai-agent/stream request
// Check "Waiting (TTFB)" time
```

---

### 4.2 Complex Query Performance (with RAG)
**Test Query:**
```
"Based on my notes, create a 10-question quiz on the main topics"
```

**Expected:**
- ⏱️ RAG retrieval: < 500ms
- ⏱️ Quiz generation: < 10 seconds total
- ⏱️ First token: < 1 second (streaming)

**Telemetry Verification:**
```json
{
  "step_complete": {
    "rag_retrieval": "< 500ms",
    "llm_call": "< 3000ms",
    "tool_execution": "< 5000ms",
    "total": "< 10000ms"
  }
}
```

---

### 4.3 Document Processing Performance
**Test:** Upload a 10-page PDF

**Expected:**
- ⏱️ Upload: < 5 seconds
- ⏱️ Extraction: < 10 seconds
- ⏱️ Chunking: < 5 seconds
- ⏱️ Embedding generation: < 15 seconds (5 chunks × 3s)
- ⏱️ Total: < 30 seconds

---

### 4.4 Streaming Performance
**Test:** Ask any question and watch streaming

**Expected:**
- ⏱️ First chunk arrives: < 500ms
- ⏱️ Chunks arrive continuously (no gaps > 1s)
- ✅ UI updates smoothly in real-time
- ✅ No flickering or UI jank

---

## 🎨 TEST 5: UI/UX Features

### 5.1 Command Palette
**Test Steps:**
1. Press Cmd+K (or Ctrl+K on Windows)
2. Palette opens
3. Type "quiz"
4. Select "Generate Quiz"
5. AI panel opens with pre-filled prompt

**Expected:**
- ✅ Keyboard shortcut works from any page
- ✅ Palette is searchable
- ✅ Arrow keys navigate options
- ✅ Enter key selects
- ✅ Esc closes palette

---

### 5.2 One-Click Saves
**Test Steps:**
1. Generate a quiz
2. Quiz card appears
3. Click "Take Quiz" button
4. Navigates to quiz page

**Expected:**
- ✅ Button shows loading state
- ✅ Button shows success checkmark
- ✅ Navigation happens automatically
- ✅ No additional clicks needed

---

### 5.3 Collapsible Sources
**Test Steps:**
1. Upload a document
2. Ask a question about it
3. AI responds with answer
4. "📄 Sources (N)" appears at bottom
5. Click to expand
6. See document excerpts

**Expected:**
- ✅ Sources collapsed by default
- ✅ Click toggles expand/collapse
- ✅ Shows correct document excerpts
- ✅ Shows source document name
- ✅ Clean, readable formatting

---

## ✅ FINAL VERIFICATION CHECKLIST

### Core Functionality:
- [ ] PDF upload → chunks → searchable
- [ ] Word doc upload → chunks → searchable
- [ ] Text file upload → chunks → searchable
- [ ] Streaming responses work perfectly
- [ ] All 11 tools tested and working
- [ ] Real-time matching (Now/Later) works
- [ ] Telemetry tracking all steps
- [ ] Error handling graceful

### UI/UX:
- [ ] Cmd+K command palette works
- [ ] One-click save buttons work
- [ ] Collapsible sources work
- [ ] Cards render correctly
- [ ] Buttons show loading states
- [ ] Navigation works smoothly

### Performance:
- [ ] Simple queries: 2-3 seconds ✓
- [ ] Complex queries: < 10 seconds ✓
- [ ] First token: < 500ms ✓
- [ ] PDF processing: < 30 seconds ✓
- [ ] No UI jank or lag ✓

### Security:
- [ ] RLS policies enforce user isolation
- [ ] All tools filter by userId
- [ ] No cross-user data leaks
- [ ] Service role access controlled

### Production Readiness:
- [ ] Zero build errors ✓
- [ ] All TypeScript types correct ✓
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Deployment successful

---

## 📝 TESTING NOTES

### Known Limitations:
- PDF extraction requires pdf-parse library (✅ installed)
- Word extraction requires mammoth library (✅ installed)
- Streaming requires SSE-compatible browser (all modern browsers)
- Command palette requires JavaScript enabled

### Edge Cases Handled:
- ✅ Empty documents return helpful message
- ✅ Failed uploads show error message
- ✅ Offline partners show "Schedule Later"
- ✅ No citations = no sources section
- ✅ Network errors handled gracefully

### Future Enhancements:
- [ ] Automated E2E tests with Playwright
- [ ] Load testing with k6 or Artillery
- [ ] Performance monitoring dashboard
- [ ] Error tracking with Sentry

---

## 🎯 SUCCESS CRITERIA

When all tests pass:
- ✅ 100% feature parity with PRD
- ✅ All tools working flawlessly
- ✅ Performance targets met
- ✅ Security verified
- ✅ UI/UX polished
- ✅ Ready for production deployment

**Status: READY FOR MANUAL TESTING** 🚀

Run through this checklist in your local/staging environment, then deploy to production with confidence!
