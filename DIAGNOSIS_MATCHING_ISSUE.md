# 🔍 AI Agent Partner Matching - Complete Diagnosis

## Executive Summary

**Status**: ✅ **ISSUE IDENTIFIED**

The `matchCandidates` tool is **fully functional** and returns correct results. However, the AI agent is **not calling it** because the system prompt lacks explicit instructions about when to use this tool.

---

## Test Results

### ✅ Test 1: Database Check
```
✅ Found 4 users in database:
   1. bao pham (clervaclever@gmail.com)
   2. Gia Khang Phạm (giakhangpham94@gmail.com)
   3. Gia Khang Phạm (giakhang.pham@example.com)
   4. Minh Pham (minhpham240909@gmail.com)

✅ All users have profiles
✅ 3 potential partners exist for any given user
```

### ✅ Test 2: Tool Functionality
```
Tool: matchCandidates
Input: { userId: "2f8dc3ae-fb4d-4d65-abf0-b10714228120", limit: 10, minScore: 0.1 }

OUTPUT:
✅ 3 matches found successfully
   - Gia Khang Phạm: 48.4% compatibility
   - Minh Pham: 33.3% compatibility
   - Gia Khang Phạm: 33.3% compatibility

LOGS:
[matchCandidates] Profile: found: true, subjects: 3
[matchCandidates] Candidates found: 3
[matchCandidates] Scored: 3 Filtered: 3
[matchCandidates] RETURN: 3 matches

CONCLUSION: Tool works perfectly! ✅
```

### ✅ Test 3: Tool Registration
```
✅ matchCandidates is registered in ToolRegistry
✅ Tool is available to AI agent
✅ Tool description exists
```

---

## 🔴 The Problem

### Root Cause: Missing System Prompt Instructions

**Location**: `packages/ai-agent/src/lib/orchestrator.ts` (line 486-560)

The system prompt has **explicit rules for searchUsers** but **NO rules for matchCandidates**:

#### What EXISTS (searchUsers):
```typescript
🔴 CRITICAL SEARCH RULES - FOLLOW WITHOUT EXCEPTION 🔴

⚠️ RULE 1 - NAME SEARCH DETECTION:
If user message contains ANY of these patterns → IMMEDIATELY call searchUsers tool:
  ✓ A capitalized word that could be a name: "John", "Sarah", "Minh", "Alex"
  ✓ Phrases: "find [name]", "search for [name]", "who is [name]"
  
EXAMPLES REQUIRING searchUsers TOOL:
  - User: "John" → YOU: Call searchUsers(query="John", searchBy="name")
  - User: "find Minh" → YOU: Call searchUsers(query="Minh", searchBy="name")
```

#### What's MISSING (matchCandidates):
```
❌ NO explicit rules for when to call matchCandidates
❌ NO examples of partner matching queries
❌ NO instruction to use matchCandidates for "find partner" requests
```

The only mention is vague:
```typescript
- Match students with compatible study partners using REAL database data
10. For partner matching: check strengths/weaknesses, online status, and availability
```

This is NOT explicit enough for the AI to know:
- WHEN to call matchCandidates
- WHAT user queries should trigger it
- HOW to use it properly

---

## Why This Matters

### User Says: "Find me a study partner"

**What SHOULD happen:**
1. AI sees "find partner" keyword
2. AI calls `matchCandidates` tool
3. Tool returns 3 matches
4. AI presents matches to user

**What ACTUALLY happens:**
1. AI sees "find partner"
2. AI has no explicit rule to call matchCandidates
3. AI decides not to call any tool (or calls searchUsers instead)
4. AI says "I cannot find a partner in database"

---

## 🎯 The Fix

### Add Explicit matchCandidates Rules to System Prompt

Add this section to `buildSystemPrompt()` after the searchUsers rules:

```typescript
⚠️ RULE 5 - PARTNER MATCHING DETECTION:
If user message contains ANY of these patterns → IMMEDIATELY call matchCandidates tool:
  ✓ "find partner", "find study partner", "match me", "find someone to study with"
  ✓ "who can I study with", "study partners for [subject]"
  ✓ "find compatible partners", "match me with someone"
  ✓ "who should I study with", "recommend study partners"

EXAMPLES REQUIRING matchCandidates TOOL:
  - User: "find me a study partner" → YOU: Call matchCandidates({ limit: 10 })
  - User: "who can I study with" → YOU: Call matchCandidates({ limit: 10 })
  - User: "find partners for Math" → YOU: Call matchCandidates({ limit: 10 }) then filter by subject
  - User: "match me with someone" → YOU: Call matchCandidates({ limit: 10 })

⚠️ RULE 6 - AFTER FINDING MATCHES:
After matchCandidates returns results:
  → Use searchUsers to get full details about each match
  → Use matchInsight to explain WHY they're compatible
  → Use getOnlineUsers to check who's available NOW
  → Present ALL matches, not just the top one
```

---

## Verification Steps

### Before Fix:
```bash
# User asks: "find me a study partner"
# Expected: AI should call matchCandidates
# Actual: AI says "cannot find partners"
```

### After Fix:
```bash
# User asks: "find me a study partner"
# Expected: AI calls matchCandidates → returns 3 matches
# Actual: Should work! ✅
```

---

## Additional Findings

### 1. Tool Description Could Be Better

Current tool description:
```typescript
description: 'Find and rank potential study partners based on compatibility 
(subjects, learning style, availability). Returns top matches even with low 
compatibility scores.'
```

**Issue**: Generic description doesn't help AI know when to use it

**Better description**:
```typescript
description: `🔴 PARTNER MATCHING TOOL - Use when user wants study partners 🔴

⚠️ CALL THIS TOOL when user says:
- "find me a partner" / "find study partner"
- "who can I study with" / "match me with someone"
- "find partners for [subject]"
- ANY request about finding compatible study partners

This tool:
✅ Searches ALL users in database
✅ Calculates compatibility scores
✅ Returns top matches (even if scores are low)
✅ Includes facets: commonSubjects, studyStyleMatch, skillLevelMatch

Input: { limit?: number (default 10), minScore?: number (default 0.1) }
Output: { matches: [{userId, score, facets}], total: number }`
```

### 2. searchUsers vs matchCandidates Confusion

**Problem**: Two similar tools with overlapping use cases

- `searchUsers` - Find specific users by name/subject
- `matchCandidates` - Find compatible partners based on profile

**The AI might be confused about which to use!**

**Solution**: Make it crystal clear in the prompt:
```
Use searchUsers when: User wants a SPECIFIC person ("find John", "who is Sarah")
Use matchCandidates when: User wants COMPATIBLE partners ("find study partner", "who can I study with")
```

---

## Files to Modify

### 1. System Prompt (CRITICAL)
**File**: `packages/ai-agent/src/lib/orchestrator.ts`  
**Line**: Around 500-560 (buildSystemPrompt method)  
**Change**: Add explicit matchCandidates rules (see "The Fix" section above)

### 2. Tool Description (RECOMMENDED)
**File**: `packages/ai-agent/src/tools/matchCandidates.ts`  
**Line**: 18 (description field)  
**Change**: Make description more explicit with examples

---

## Summary

| Component | Status | Issue |
|-----------|--------|-------|
| Database | ✅ Working | Users exist, profiles complete |
| matchCandidates Tool | ✅ Working | Returns 3 matches correctly |
| Tool Registration | ✅ Working | Tool is available to AI |
| **System Prompt** | ❌ **MISSING** | **No explicit rules for matchCandidates** |
| Tool Description | ⚠️ Could be better | Too generic, no examples |

---

## Next Steps

1. ✅ **DONE**: Identified root cause
2. ⏸️ **TODO**: Add explicit matchCandidates rules to system prompt
3. ⏸️ **TODO**: Improve tool description
4. ⏸️ **TODO**: Test with real user queries
5. ⏸️ **TODO**: Deploy and verify in production

---

## Test Commands

```bash
# Test the tool directly (already working)
node test-ai-agent-live.js

# Test the full matching flow
node test-matching-diagnosis.js

# After fix, test with actual AI agent:
# 1. Start dev server: npm run dev
# 2. Open chat interface
# 3. Type: "find me a study partner"
# 4. Check server logs for [matchCandidates] calls
# 5. Verify AI returns the 3 matches
```

---

## Conclusion

**The issue is NOT with the database or tool functionality.**  
**The issue is with the AI agent's instructions.**

The AI doesn't know WHEN to use matchCandidates because:
1. No explicit rules in system prompt (like searchUsers has)
2. Tool description is too generic
3. No clear distinction between searchUsers and matchCandidates

**Fix Priority**: HIGH  
**Fix Complexity**: EASY (just add text to prompt)  
**Expected Time**: 10 minutes

Once the system prompt is updated with explicit rules, the AI will call matchCandidates correctly and users will see their 3 potential partners! ✅
