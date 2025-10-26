# Quick Start Guide

Get the Clerva AI Agent running in **5 minutes**.

---

## Prerequisites

- Node.js 18+
- Supabase project
- OpenAI API key

---

## Step 1: Environment Setup (1 min)

Create `.env.local` in the root of `clerva-app`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...
```

---

## Step 2: Database Migration (2 min)

1. **Enable pgvector** in Supabase SQL Editor:
   ```sql
   create extension if not exists vector;
   ```

2. **Run migration**:
   ```bash
   cd supabase
   npx supabase db push
   ```

3. **Create vector search function** (copy from `packages/ai-agent/README.md` section "Database Setup" step 3)

---

## Step 3: Start Development Server (1 min)

```bash
npm run dev
```

Navigate to `http://localhost:3000`

---

## Step 4: Add AI Panel to Your App (1 min)

In any page (e.g., `src/app/dashboard/page.tsx`):

```tsx
import AIPanel from '@/components/ai-agent/AIPanel'

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* AI Assistant Panel */}
      <AIPanel />
    </div>
  )
}
```

---

## Step 5: Test the Agent

Click the AI panel and try these commands:

1. **RAG Search** (requires documents):
   ```
   Search my notes for "algebra equations"
   ```

2. **Quiz Generation**:
   ```
   Generate a 5-question medium difficulty quiz on calculus
   ```

3. **Study Plan**:
   ```
   Create a 4-week study plan for AP Physics, 60 minutes/day, 5 days/week
   ```

4. **Partner Matching**:
   ```
   Find study partners who are online now
   ```

---

## What Works Out of the Box

✅ AI chat interface with minimizable panel
✅ All 11 tools registered and ready
✅ LLM function calling with OpenAI
✅ Database with RLS policies
✅ Type-safe tool execution

## What Needs Setup

⏳ **Document ingestion** - Upload files and chunk them
⏳ **Presence system** - Client-side heartbeat
⏳ **Flashcard review** - UI component

See `packages/ai-agent/README.md` for full setup instructions.

---

## Troubleshooting

**Error: "Unauthorized"**
- Ensure user is logged in with Supabase Auth
- Check `SUPABASE_SERVICE_ROLE_KEY` is set

**Error: "search_chunks function not found"**
- Create the vector search function (see Step 2.3)

**Error: "OpenAI API error"**
- Verify `OPENAI_API_KEY` is valid
- Check you have credits in your OpenAI account

**No tool execution**
- Check browser console for errors
- Verify all environment variables are set
- Ensure tools are registered in `src/tools/index.ts`

---

## Next Steps

1. **Upload test documents** to populate RAG index
2. **Set up presence** for real-time matching
3. **Customize tools** for your use case
4. **Add more UI components** (flashcard review, etc.)
5. **Deploy to production** (see README.md)

---

**Need help?** Check the full README at `packages/ai-agent/README.md`
