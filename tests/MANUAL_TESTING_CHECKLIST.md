# ✅ Manual Testing Checklist - Phase 3

**Goal:** Test all AI agent features manually
**Time Estimate:** 2-3 hours
**Status:** Ready to start

---

## 🔧 SETUP (15 minutes)

### Step 1: Create Test Data
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Run `tests/setup/create-test-users-complete.sql`
- [ ] Verify: 5 users created (should see success messages)
- [ ] Run `tests/setup/create-test-data.sql`
- [ ] Verify: Study sessions, quizzes, flashcards created

### Step 2: Get Test User Credentials
- [ ] Find Test Admin user ID from Supabase
- [ ] Option A: Sign in as test admin (if password auth works)
- [ ] Option B: Use your own account for testing

### Step 3: Prepare Test Documents
- [ ] Create a simple PDF (5-10 pages) with test content
- [ ] Name it: `test-document.pdf`
- [ ] Content suggestion: "JavaScript fundamentals: variables, loops, functions..."

---

## 📊 TEST SUITE 1: RAG Pipeline (20 minutes)

### Test 1.1: PDF Upload & Processing
**Time:** 5 minutes

1. [ ] Open AI chat panel
2. [ ] Click upload button
3. [ ] Upload `test-document.pdf`
4. [ ] Wait for "Document ready" message (max 30 seconds)
5. [ ] Check Supabase: `SELECT * FROM "doc_source" ORDER BY "createdAt" DESC LIMIT 1`
6. [ ] Verify `status = 'ready'`
7. [ ] Check chunks: `SELECT COUNT(*) FROM "doc_chunk" WHERE source_id = 'DOC_ID'`
8. [ ] Verify 10-20 chunks exist

**✅ Pass Criteria:**
- Upload works without errors
- Document processes in < 30 seconds
- Chunks created with embeddings

---

### Test 1.2: Document Search
**Time:** 5 minutes

1. [ ] Ask AI: "What are the main topics in my uploaded document?"
2. [ ] Verify AI responds within 5 seconds
3. [ ] Verify response mentions content from your PDF
4. [ ] Check for "📄 Sources" section
5. [ ] Click "Sources" to expand
6. [ ] Verify shows document name and excerpts

**✅ Pass Criteria:**
- AI finds relevant content
- Citations show correctly
- Sources are expandable

---

### Test 1.3: Multiple Document Search
**Time:** 10 minutes

1. [ ] Upload a second PDF on a different topic
2. [ ] Wait for processing
3. [ ] Ask: "Compare the topics in my two documents"
4. [ ] Verify AI references BOTH documents
5. [ ] Check sources show both document names

**✅ Pass Criteria:**
- AI can search across multiple documents
- Citations distinguish between sources

---

## 📊 TEST SUITE 2: AI Tools (60 minutes)

### Tool 1: searchNotes (5 min)
1. [ ] Ask: "Search my notes for [specific term from PDF]"
2. [ ] Verify AI finds and cites the document

**✅ Pass:** AI returns relevant notes with citations

---

### Tool 2: summarizeSession (5 min)
1. [ ] Ask: "Summarize my last study session"
2. [ ] Verify AI mentions "Python Loops Study Session"
3. [ ] Check mentions participants, topics discussed

**✅ Pass:** AI summarizes the test session created in setup

---

### Tool 3: generateQuiz (10 min)
1. [ ] Ask: "Generate a 5-question quiz on JavaScript"
2. [ ] Wait for quiz card to appear
3. [ ] Verify shows quiz title and question preview
4. [ ] Click "Take Quiz" button
5. [ ] Verify navigates to quiz page
6. [ ] Check Supabase: `SELECT * FROM "Quiz" ORDER BY "createdAt" DESC LIMIT 1`
7. [ ] Verify quiz has 5 questions

**✅ Pass:** Quiz created, saved to DB, button works

---

### Tool 4: addFlashcards (10 min)
1. [ ] Ask: "Create flashcards for Python loops"
2. [ ] Wait for flashcard card to appear
3. [ ] Verify shows deck name and card preview
4. [ ] Click "Review Cards" button
5. [ ] Verify navigates to flashcards
6. [ ] Check Supabase: `SELECT * FROM "FlashcardDeck" ORDER BY "createdAt" DESC LIMIT 1`
7. [ ] Count cards: `SELECT COUNT(*) FROM "Flashcard" WHERE "deckId" = 'DECK_ID'`

**✅ Pass:** Flashcards created, saved, button works

---

### Tool 5: createStudyPlan (10 min)
1. [ ] Ask: "Create a study plan for learning React in 2 weeks"
2. [ ] Wait for study plan card
3. [ ] Verify shows timeline and milestones
4. [ ] Click "View Plan" button (if exists)
5. [ ] Check Supabase: `SELECT * FROM "study_plan" ORDER BY "createdAt" DESC LIMIT 1`

**✅ Pass:** Plan created with milestones

---

### Tool 6: buildLearningProfile (5 min)
1. [ ] Take the JavaScript quiz you created
2. [ ] Answer some questions correctly, some incorrectly
3. [ ] Ask: "Update my learning profile based on quiz results"
4. [ ] Check Supabase: `SELECT * FROM "LearningProfile" WHERE "userId" = 'YOUR_ID'`
5. [ ] Verify strengths/weaknesses updated

**✅ Pass:** Profile reflects quiz performance

---

### Tool 7: matchCandidates (5 min)
1. [ ] Ask: "Find me study partners for Computer Science"
2. [ ] Verify AI shows compatible candidates
3. [ ] Check shows: Sarah Johnson, Alex Chen, Michael Kim
4. [ ] Verify compatibility scores shown
5. [ ] Verify mentions shared subjects

**✅ Pass:** Shows 3-4 candidates with compatibility %

---

### Tool 8: matchInsight - Online (5 min)
1. [ ] Verify Sarah is online in presence table
2. [ ] Ask: "When can I study with Sarah Johnson?"
3. [ ] Verify shows "Sarah is online now 🟢"
4. [ ] Verify shows "Start Now" button or similar
5. [ ] Check mentions immediate availability

**✅ Pass:** Correctly identifies online status + Start Now option

---

### Tool 9: matchInsight - Offline (5 min)
1. [ ] Ask: "When can I study with Emily Rodriguez?"
2. [ ] Verify shows "Emily is offline"
3. [ ] Verify shows "Next Best Times" or availability windows
4. [ ] Check mentions Monday, Wednesday, Friday 16:00-18:00

**✅ Pass:** Shows offline status + scheduled times

---

### Tool 10: getOnlineUsers (3 min)
1. [ ] Ask: "Who is online right now?"
2. [ ] Verify lists: Test Admin, Sarah Johnson, Alex Chen, Michael Kim
3. [ ] Verify doesn't show Emily Rodriguez (offline)

**✅ Pass:** Lists only online users

---

### Tool 11: getAvailability (3 min)
1. [ ] Ask: "Show my availability this week"
2. [ ] Verify lists days: Monday-Friday
3. [ ] Verify shows time windows: 09:00-12:00, 14:00-17:00

**✅ Pass:** Shows correct availability from test data

---

### Tool 12: sendNudge (4 min)
1. [ ] Ask: "Remind Sarah to join our study session"
2. [ ] Check Supabase: `SELECT * FROM "Notification" WHERE "userId" = 'SARAH_ID' ORDER BY "createdAt" DESC LIMIT 1`
3. [ ] Verify notification created
4. [ ] Verify type = 'nudge'

**✅ Pass:** Notification created in database

---

## 📊 TEST SUITE 3: User Experience (20 minutes)

### Test 3.1: Streaming Responses
**Time:** 5 minutes

1. [ ] Ask a simple question: "What is React?"
2. [ ] Watch response appear word-by-word
3. [ ] Open DevTools → Network tab
4. [ ] Ask another question
5. [ ] Check TTFB (Time to First Byte)
6. [ ] Verify < 500ms

**✅ Pass Criteria:**
- Smooth streaming (no jumps)
- First token < 500ms
- ChatGPT-like experience

---

### Test 3.2: Command Palette (5 min)
1. [ ] Press Cmd+K (Mac) or Ctrl+K (Windows)
2. [ ] Verify command palette opens
3. [ ] Try: Type "quiz"
4. [ ] Verify "Generate Quiz" appears
5. [ ] Select it
6. [ ] Verify AI chat starts quiz generation

**✅ Pass:** Palette opens, actions work

---

### Test 3.3: One-Click Buttons (5 min)
1. [ ] Generate a quiz
2. [ ] Verify "Take Quiz" button appears
3. [ ] Click button
4. [ ] Verify navigates to quiz

1. [ ] Generate flashcards
2. [ ] Verify "Review Cards" button appears
3. [ ] Click button
4. [ ] Verify navigates to flashcards

**✅ Pass:** All buttons work and navigate correctly

---

### Test 3.4: Collapsible Sources (5 min)
1. [ ] Ask a question about uploaded document
2. [ ] Verify response includes citations
3. [ ] Check "📄 Sources (N)" appears (collapsed by default)
4. [ ] Click to expand
5. [ ] Verify shows document excerpts
6. [ ] Click again to collapse

**✅ Pass:** Sources expand/collapse smoothly

---

## 📊 TEST SUITE 4: Performance (15 minutes)

### Test 4.1: Simple Question
**Target:** < 3 seconds

1. [ ] Open DevTools → Network
2. [ ] Clear network log
3. [ ] Ask: "What is Python?"
4. [ ] Measure total time
5. [ ] Record: _____ seconds

**✅ Pass:** < 3 seconds

---

### Test 4.2: Quiz Generation
**Target:** < 10 seconds

1. [ ] Ask: "Generate a 10-question quiz on algorithms"
2. [ ] Start timer
3. [ ] Wait for quiz card to appear
4. [ ] Record: _____ seconds

**✅ Pass:** < 10 seconds

---

### Test 4.3: Complex RAG Query
**Target:** < 5 seconds

1. [ ] Ask: "Compare the main concepts across all my documents"
2. [ ] Measure response time
3. [ ] Record: _____ seconds

**✅ Pass:** < 5 seconds

---

### Test 4.4: PDF Processing
**Target:** < 30 seconds

1. [ ] Upload a 10-page PDF
2. [ ] Start timer
3. [ ] Wait for "ready" status
4. [ ] Record: _____ seconds

**✅ Pass:** < 30 seconds

---

## 📊 TEST SUITE 5: Error Handling (10 minutes)

### Test 5.1: Invalid Upload
1. [ ] Try uploading a .txt file
2. [ ] Verify helpful error message
3. [ ] No console errors

**✅ Pass:** Graceful error handling

---

### Test 5.2: Offline User Request
1. [ ] Ask: "Start a study session with Emily Rodriguez now"
2. [ ] Verify AI says she's offline
3. [ ] Suggests scheduling instead

**✅ Pass:** Handles offline gracefully

---

### Test 5.3: Empty Query
1. [ ] Send empty message
2. [ ] Verify AI asks for clarification
3. [ ] No errors

**✅ Pass:** Handles empty input

---

## 📊 FINAL VERIFICATION

### Checklist:
- [ ] All 12 tools tested and working
- [ ] RAG pipeline works end-to-end
- [ ] Streaming smooth and fast
- [ ] Command palette functional
- [ ] One-click buttons work
- [ ] Sources collapsible
- [ ] Performance targets met
- [ ] Error handling graceful
- [ ] No console errors
- [ ] No browser warnings

### Results Summary:
- **Tests Passed:** __ / __
- **Tests Failed:** __ / __
- **Success Rate:** ___%

---

## 🐛 ISSUES FOUND

**Document any issues here:**

### Issue 1:
- **Test:**
- **Expected:**
- **Actual:**
- **Severity:** High / Medium / Low

### Issue 2:
[Add more as needed]

---

## ✅ COMPLETION

Once all tests pass:
1. [ ] Update progress to 100%
2. [ ] Document test results
3. [ ] Create completion summary
4. [ ] Celebrate! 🎉

**Testing completed on:** __________
**Completed by:** __________
**Final status:** ✅ PASSED / ❌ FAILED
