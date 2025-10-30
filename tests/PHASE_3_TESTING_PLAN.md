# 🧪 Phase 3: Comprehensive Testing Plan

**Goal:** Test all AI agent features to reach 100% completion
**Status:** In Progress
**Started:** Now

---

## 📋 Testing Overview

### What We're Testing:
1. ✅ RAG Pipeline (PDF upload → chunks → search → citations)
2. ✅ All 11 AI Tools (individual verification)
3. ✅ Real-Time Partner Matching (Now/Later logic)
4. ✅ Performance Benchmarks (response times)
5. ✅ End-to-End User Workflows

### Test Environment:
- **Production URL:** https://clerva-noihcq47v-minh-phams-projects-2df8ca7e.vercel.app
- **Test Data:** Will create via SQL scripts
- **Test Documents:** Sample PDFs provided in test-data/
- **Test Users:** 5 test users with different profiles

---

## 🔧 Test Setup Requirements

### 1. Database Setup
**Prerequisites:**
- [ ] Run `tests/setup/create-test-users.sql` (5 test users)
- [ ] Run `tests/setup/create-test-data.sql` (sessions, quizzes, notes)
- [ ] Verify all tables exist with correct schema

### 2. Test Documents
**Required Files:**
- [ ] `test-data/sample-cs-notes.pdf` (Computer Science notes)
- [ ] `test-data/sample-math-lecture.pdf` (Mathematics lecture)
- [ ] `test-data/sample-biology.docx` (Biology notes)

### 3. API Access
**Required:**
- [ ] Valid auth token for test user
- [ ] Supabase access to verify database state
- [ ] Vercel logs access for debugging

---

## 📊 TEST SUITE 1: RAG Pipeline End-to-End

### Test 1.1: PDF Upload & Processing
**Objective:** Verify PDF uploads are processed correctly

**Steps:**
1. Upload `test-data/sample-cs-notes.pdf` via `/api/ai-agent/upload`
2. Wait for processing (max 30 seconds)
3. Check `doc_source` table for new record
4. Verify `status = 'ready'`
5. Check `doc_chunk` table for chunks (should be 10-20 chunks)
6. Verify all chunks have embeddings (embedding != null)

**Expected Results:**
```sql
-- Should return 1 row
SELECT * FROM "doc_source" WHERE name LIKE '%sample-cs-notes%' AND status = 'ready';

-- Should return 10-20 rows
SELECT COUNT(*) FROM "doc_chunk" WHERE source_id = (SELECT id FROM "doc_source" WHERE name LIKE '%sample-cs-notes%');
```

**Success Criteria:**
- ✅ Document uploaded successfully
- ✅ Status = 'ready' within 30 seconds
- ✅ 10-20 chunks created
- ✅ All chunks have embeddings

---

### Test 1.2: Document Search with Citations
**Objective:** Verify AI can search uploaded documents

**Steps:**
1. Ask AI: "What are the main concepts in my computer science notes?"
2. Verify AI responds with relevant content
3. Check response includes citations (📄 Sources)
4. Click "Sources" to expand
5. Verify shows document name and relevant excerpts

**Expected Behavior:**
- AI mentions specific concepts from the PDF
- Response cites "sample-cs-notes.pdf"
- Sources show actual text excerpts from PDF
- Excerpts are relevant to the question

**Success Criteria:**
- ✅ AI responds within 5 seconds
- ✅ Response is relevant to PDF content
- ✅ Citations present and accurate
- ✅ Sources expandable and readable

---

### Test 1.3: Word Document Processing
**Objective:** Verify .docx files work the same as PDFs

**Steps:**
1. Upload `test-data/sample-biology.docx`
2. Wait for processing
3. Ask: "Summarize my biology notes"
4. Verify AI cites the Word document

**Success Criteria:**
- ✅ .docx uploads successfully
- ✅ Chunks created with embeddings
- ✅ AI can search Word document content
- ✅ Citations work for Word docs

---

## 📊 TEST SUITE 2: All 11 AI Tools

### Tool 1: searchNotes
**Test ID:** T2.1
**Endpoint:** Uses RAG pipeline internally

**Test Steps:**
1. Upload document with specific content
2. Ask: "Search my notes for [specific topic]"
3. Verify AI finds and cites the document

**Verification:**
```typescript
// Expected tool call in logs
{
  tool: 'searchNotes',
  input: { query: 'specific topic', limit: 5 },
  output: { chunks: [...], sources: [...] }
}
```

**Success:** ✅ AI finds relevant notes and cites sources

---

### Tool 2: summarizeSession
**Test ID:** T2.2
**File:** `packages/ai-agent/src/tools/summarizeSession.ts`

**Test Steps:**
1. Create test study session with transcript in database
2. Ask: "Summarize my last study session"
3. Verify AI generates summary with key points

**SQL Setup:**
```sql
INSERT INTO "StudySession" (id, "userId", title, description, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'TEST_USER_ID', 'Python Study Session', 'Discussed loops and functions', NOW(), NOW());
```

**Success:** ✅ AI summarizes session with key topics, participants, duration

---

### Tool 3: generateQuiz
**Test ID:** T2.3
**File:** `packages/ai-agent/src/tools/generateQuiz.ts`

**Test Steps:**
1. Ask: "Generate a 5-question quiz on JavaScript"
2. Verify AI creates quiz card with questions
3. Click "Take Quiz" button
4. Check database for quiz record

**Database Verification:**
```sql
-- Should have 1 new quiz
SELECT * FROM "Quiz" WHERE "userId" = 'TEST_USER_ID' ORDER BY "createdAt" DESC LIMIT 1;

-- Should have 5 questions
SELECT COUNT(*) FROM "QuizQuestion" WHERE "quizId" = 'QUIZ_ID';
```

**Success:** ✅ Quiz saved to DB, Take Quiz button works, navigates to quiz

---

### Tool 4: addFlashcards
**Test ID:** T2.4
**File:** `packages/ai-agent/src/tools/addFlashcards.ts`

**Test Steps:**
1. Ask: "Create flashcards for Python loops"
2. Verify AI creates flashcard card with preview
3. Click "Review Cards" button
4. Check database for flashcard deck and cards

**Database Verification:**
```sql
-- New deck
SELECT * FROM "FlashcardDeck" WHERE "userId" = 'TEST_USER_ID' ORDER BY "createdAt" DESC LIMIT 1;

-- Cards in deck (should be 5-10)
SELECT COUNT(*) FROM "Flashcard" WHERE "deckId" = 'DECK_ID';
```

**Success:** ✅ Deck created, cards saved, Review button works

---

### Tool 5: createStudyPlan
**Test ID:** T2.5
**File:** `packages/ai-agent/src/tools/createStudyPlan.ts`

**Test Steps:**
1. Ask: "Create a study plan for learning React in 2 weeks"
2. Verify AI generates plan card
3. Click "View Plan" button
4. Check database for study plan

**Database Verification:**
```sql
SELECT * FROM "study_plan" WHERE "userId" = 'TEST_USER_ID' ORDER BY "createdAt" DESC LIMIT 1;
```

**Success:** ✅ Plan saved, includes timeline, topics, milestones

---

### Tool 6: buildLearningProfile
**Test ID:** T2.6
**File:** `packages/ai-agent/src/tools/buildLearningProfile.ts`

**Test Steps:**
1. Take a quiz (from Tool 3 test)
2. Ask: "Update my learning profile based on my quiz results"
3. Check `LearningProfile` table for updates

**Database Verification:**
```sql
SELECT * FROM "LearningProfile" WHERE "userId" = 'TEST_USER_ID';
-- Check strengths, weaknesses, updated_at
```

**Success:** ✅ Profile updated with strengths/weaknesses from quiz

---

### Tool 7: matchCandidates
**Test ID:** T2.7
**File:** `packages/ai-agent/src/tools/matchCandidates.ts`

**Test Steps:**
1. Ensure 2+ test users with overlapping subjects exist
2. Ask: "Find me study partners for Computer Science"
3. Verify AI shows compatible candidates with compatibility scores

**Expected Output:**
```
I found 2 compatible study partners:
1. Sarah Johnson (85% match) - Studies CS, Math, Physics
2. Alex Chen (72% match) - Studies CS, Algorithms
```

**Success:** ✅ Shows candidates, compatibility scores, shared subjects

---

### Tool 8: matchInsight
**Test ID:** T2.8
**File:** `packages/ai-agent/src/tools/matchInsight.ts`

**Test Steps:**
1. Ask: "When is the best time to study with Sarah Johnson?"
2. Verify AI shows:
   - "Start Now" if Sarah is online
   - "Next Best Times" if Sarah is offline
3. Check availability windows

**Expected Output (Online):**
```
Sarah is online now! 🟢
You can start a study session immediately.
[Start Now Button]
```

**Expected Output (Offline):**
```
Sarah is offline. Best times to study together:
- Tomorrow at 2:00 PM (both available)
- Thursday at 10:00 AM (both available)
[Schedule Later Button]
```

**Success:** ✅ Shows correct status, availability windows, actionable buttons

---

### Tool 9: getOnlineUsers
**Test ID:** T2.9
**File:** `packages/ai-agent/src/tools/getOnlineUsers.ts`

**Test Steps:**
1. Set 2 test users online in `presence` table
2. Ask: "Who is online right now?"
3. Verify AI lists online users

**Database Setup:**
```sql
INSERT INTO "presence" (user_id, is_online, last_seen)
VALUES
  ('TEST_USER_2', true, NOW()),
  ('TEST_USER_3', true, NOW());
```

**Success:** ✅ Shows all online users with status

---

### Tool 10: getAvailability
**Test ID:** T2.10
**File:** `packages/ai-agent/src/tools/getAvailability.ts`

**Test Steps:**
1. Add availability windows for test user
2. Ask: "Show my availability this week"
3. Verify AI lists time windows

**Database Setup:**
```sql
UPDATE "Profile" SET
  "availableDays" = ARRAY['Monday', 'Wednesday', 'Friday'],
  "availableHours" = ARRAY['14:00-16:00', '18:00-20:00']
WHERE "userId" = 'TEST_USER_ID';
```

**Success:** ✅ Shows availability days and time windows

---

### Tool 11: sendNudge
**Test ID:** T2.11
**File:** `packages/ai-agent/src/tools/sendNudge.ts`

**Test Steps:**
1. Ask: "Remind Sarah to join our study session"
2. Verify notification created
3. Check Sarah receives notification

**Database Verification:**
```sql
SELECT * FROM "Notification"
WHERE "userId" = 'SARAH_USER_ID'
AND type = 'nudge'
ORDER BY "createdAt" DESC LIMIT 1;
```

**Success:** ✅ Notification created, appears in Sarah's notifications

---

## 📊 TEST SUITE 3: Real-Time Partner Matching

### Test 3.1: Match Online Partner (Start Now)
**Objective:** Verify "Start Now" appears when partner is online

**Setup:**
```sql
-- User 1: You (TEST_USER_ID)
-- User 2: Sarah (TEST_USER_2)

-- Set both users with overlapping subjects
UPDATE "Profile" SET subjects = ARRAY['Computer Science', 'Math'] WHERE "userId" IN ('TEST_USER_ID', 'TEST_USER_2');

-- Set Sarah online
INSERT INTO "presence" (user_id, is_online, last_seen)
VALUES ('TEST_USER_2', true, NOW())
ON CONFLICT (user_id) DO UPDATE SET is_online = true, last_seen = NOW();
```

**Test:**
1. Ask: "Find me a study partner for Computer Science"
2. Verify response shows Sarah
3. Verify shows "Start Now" button
4. Verify mentions "Sarah is online now 🟢"

**Success Criteria:**
- ✅ Shows online indicator
- ✅ "Start Now" button present
- ✅ Button creates study session immediately

---

### Test 3.2: Match Offline Partner (Schedule Later)
**Objective:** Verify "Next Best Times" when partner offline

**Setup:**
```sql
-- Set Sarah offline
UPDATE "presence" SET is_online = false WHERE user_id = 'TEST_USER_2';

-- Add availability windows
UPDATE "Profile" SET
  "availableDays" = ARRAY['Monday', 'Wednesday'],
  "availableHours" = ARRAY['14:00-16:00']
WHERE "userId" = 'TEST_USER_2';
```

**Test:**
1. Ask: "When can I study with Sarah?"
2. Verify shows "Sarah is offline"
3. Verify shows "Next Best Times"
4. Verify lists availability windows

**Success Criteria:**
- ✅ Shows offline status
- ✅ Lists next available times
- ✅ "Schedule Later" button works

---

## 📊 TEST SUITE 4: Performance Benchmarks

### Test 4.1: Simple Question Response Time
**Target:** < 3 seconds total

**Test:**
1. Open browser DevTools → Network tab
2. Ask: "What is React?"
3. Measure time from send to first token
4. Measure time from send to complete response

**Metrics:**
- **First Token (TTFB):** Should be < 500ms ⏱️
- **Complete Response:** Should be < 3s ⏱️

**Record:**
- Actual TTFB: ___ms
- Actual Total: ___ms
- Status: ✅ Pass / ❌ Fail

---

### Test 4.2: Quiz Generation Time
**Target:** < 10 seconds

**Test:**
1. Ask: "Generate a 10-question quiz on JavaScript"
2. Measure time to quiz card appears

**Record:**
- Actual Time: ___s
- Status: ✅ Pass / ❌ Fail

---

### Test 4.3: PDF Processing Time
**Target:** < 30 seconds

**Test:**
1. Upload 5-page PDF
2. Measure time until status = 'ready'

**Record:**
- Actual Time: ___s
- Status: ✅ Pass / ❌ Fail

---

### Test 4.4: Document Search Time
**Target:** < 5 seconds

**Test:**
1. Ask question about uploaded document
2. Measure response time

**Record:**
- Actual Time: ___s
- Status: ✅ Pass / ❌ Fail

---

## 📊 TEST SUITE 5: End-to-End Workflows

### Workflow 1: Complete Study Session
**Scenario:** New user → upload notes → find partner → create session

**Steps:**
1. Sign up as new user
2. Upload lecture notes (PDF)
3. Ask: "Summarize my notes"
4. Ask: "Create a quiz on this topic"
5. Take the quiz
6. Ask: "Find me a study partner"
7. Start study session with matched partner

**Success:** ✅ All steps work smoothly, no errors

---

### Workflow 2: Flashcard Study Loop
**Scenario:** Create flashcards → review → update learning profile

**Steps:**
1. Ask: "Create flashcards for Python functions"
2. Click "Review Cards"
3. Review all cards (mark known/unknown)
4. Ask: "Update my learning profile"
5. Verify profile shows Python functions as strength

**Success:** ✅ Learning profile accurately reflects performance

---

### Workflow 3: Partner Scheduling
**Scenario:** Find partner → check availability → schedule session

**Steps:**
1. Ask: "Find partners for Biology"
2. Select a partner
3. Ask: "When can I study with [partner name]?"
4. Review suggested times
5. Click "Schedule" for a time slot
6. Verify session created in calendar

**Success:** ✅ Session scheduled, both users notified

---

## 📋 Final Verification Checklist

### Core Features:
- [ ] PDF upload works
- [ ] Word upload works
- [ ] Streaming responses appear
- [ ] All 11 tools tested and working
- [ ] Citations/sources expandable
- [ ] Command palette (Cmd+K) works
- [ ] One-click buttons work
- [ ] Real-time matching works

### Performance:
- [ ] Simple questions < 3s
- [ ] Quiz generation < 10s
- [ ] First token < 500ms
- [ ] PDF processing < 30s

### Security:
- [ ] RLS prevents cross-user data access
- [ ] Tools filter by ctx.userId
- [ ] No permission errors in logs

### User Experience:
- [ ] No console errors
- [ ] Smooth animations
- [ ] Loading states clear
- [ ] Error messages helpful

---

## 📝 Test Results Template

```markdown
## Test Execution Results

**Date:** ___________
**Tester:** ___________
**Environment:** Production

### Suite 1: RAG Pipeline
- Test 1.1: PDF Upload - ✅ Pass / ❌ Fail
- Test 1.2: Document Search - ✅ Pass / ❌ Fail
- Test 1.3: Word Upload - ✅ Pass / ❌ Fail

### Suite 2: 11 Tools
- searchNotes - ✅ Pass / ❌ Fail
- summarizeSession - ✅ Pass / ❌ Fail
- generateQuiz - ✅ Pass / ❌ Fail
- addFlashcards - ✅ Pass / ❌ Fail
- createStudyPlan - ✅ Pass / ❌ Fail
- buildLearningProfile - ✅ Pass / ❌ Fail
- matchCandidates - ✅ Pass / ❌ Fail
- matchInsight - ✅ Pass / ❌ Fail
- getOnlineUsers - ✅ Pass / ❌ Fail
- getAvailability - ✅ Pass / ❌ Fail
- sendNudge - ✅ Pass / ❌ Fail

### Suite 3: Partner Matching
- Test 3.1: Start Now - ✅ Pass / ❌ Fail
- Test 3.2: Schedule Later - ✅ Pass / ❌ Fail

### Suite 4: Performance
- Simple Question: ___ms - ✅ Pass / ❌ Fail
- Quiz Generation: ___s - ✅ Pass / ❌ Fail
- PDF Processing: ___s - ✅ Pass / ❌ Fail
- Document Search: ___s - ✅ Pass / ❌ Fail

### Overall Status:
- **Tests Passed:** __ / __
- **Tests Failed:** __ / __
- **Success Rate:** ___%
```

---

## 🚀 Next Steps After Testing

1. Document all test results
2. Fix any failing tests
3. Create bug reports for issues found
4. Update progress to 100%
5. Create final completion summary
6. Celebrate! 🎉
