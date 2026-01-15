# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clerva is a study companion platform built with Next.js 15 (App Router), featuring AI-powered study tools, flashcards, focus sessions, and collaborative learning features. The app uses Supabase for PostgreSQL database and real-time features.

## Development Commands

```bash
# Development
npm run dev              # Start dev server on port 3000
npm run build            # Build for production (runs prisma generate first)
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run typecheck        # TypeScript type checking
npm run typecheck:watch  # Watch mode type checking

# Testing
npm test                 # Run Jest tests with coverage
npm run test:watch       # Jest in watch mode
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ui      # Playwright with UI mode
npm run qa:full          # Run typecheck + tests + e2e + security scan

# Database
npx prisma generate      # Generate Prisma client
npx prisma db push       # Push schema to database
npx prisma studio        # Open Prisma Studio GUI
```

## Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL via Supabase with Prisma ORM
- **Auth**: Custom JWT auth with Supabase integration
- **Styling**: Tailwind CSS v4
- **State**: Zustand for global state, React Query for server state
- **Real-time**: Supabase Realtime for presence and live updates

### Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── flashcards/    # Flashcard CRUD and study APIs
│   │   ├── focus/         # Quick Focus session APIs
│   │   ├── solo-study/    # Solo Study session APIs
│   │   ├── user/          # User profile and stats APIs
│   │   └── admin/         # Admin panel APIs
│   ├── dashboard/         # Main dashboard
│   ├── focus/             # Quick Focus feature
│   ├── solo-study/        # Solo Study room
│   ├── chat/              # Messaging features
│   ├── admin/             # Admin panel (CEO access)
│   └── auth/              # Authentication pages
├── components/
│   ├── solo-study/        # Solo Study components (timer, whiteboard, etc.)
│   ├── focus/             # Quick Focus components
│   ├── dashboard/         # Dashboard widgets
│   ├── chat/              # Chat/messaging components
│   ├── admin/             # Admin panel components
│   └── ui/                # Reusable UI components
├── lib/
│   ├── prisma.ts          # Prisma client singleton
│   ├── supabase.ts        # Supabase client
│   ├── auth/              # Authentication utilities
│   ├── ai/                # AI/OpenAI integrations
│   ├── algorithms/        # Matching and recommendation algorithms
│   └── utils/             # Utility functions
├── hooks/                 # Custom React hooks
├── contexts/              # React Context providers
└── types/                 # TypeScript type definitions
```

### Key Database Models (Prisma)

- **User**: Core user with OAuth, 2FA, admin roles, Stripe subscription
- **Profile**: User profile with gamification (totalPoints, studyStreak)
- **FocusSession**: Quick Focus sessions (5-10 min bursts)
- **FlashcardDeck/FlashcardCard**: Quizlet-like flashcard system
- **FlashcardCardProgress**: SM-2 spaced repetition algorithm data
- **StudyGroup/GroupMember**: Collaborative study groups

### Authentication Flow

Authentication uses Supabase Auth with JWT tokens:
1. User signs in via Google OAuth or email/password
2. JWT stored in cookies, contains userId and admin status
3. API routes verify JWT via `createClient()` from `@/lib/supabase/server`
4. Admin access controlled by `isAdmin`/`isSuperAdmin` fields on User model

### API Route Pattern

```typescript
// Standard API route structure
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Business logic with prisma
  const result = await prisma.someModel.create({ ... });

  return NextResponse.json({ success: true, data: result });
}
```

### Gamification System

Users earn XP (stored in `Profile.totalPoints`) from:
- **Focus Sessions**: 10 XP per minute of focus
- **Pomodoro Sessions**: 25 XP per completed pomodoro
- **Flashcard Reviews**: 1-5 XP per card based on performance

### Real-time Features

Supabase Realtime is used for:
- User presence (online/offline status)
- Live chat messages
- Session updates

RLS (Row Level Security) policies protect data. When creating tables manually in Supabase:
1. Enable RLS on the table
2. Use `(SELECT public.get_current_user_id())` pattern for optimal performance
3. Grant permissions to `authenticated` and `service_role`

## Environment Variables

Required:
```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
```

## Important Patterns

### Server vs Client Components
- Pages and layouts are Server Components by default
- Add `'use client'` only when using hooks, state, or browser APIs
- Keep data fetching in Server Components when possible

### Form Handling
- Use React Hook Form with Zod validation
- API routes validate with Zod schemas

### Error Handling
- API routes return `{ success: boolean, error?: string, data?: T }`
- Use try/catch blocks and return appropriate HTTP status codes

### Database Queries
- Always use the singleton `prisma` from `@/lib/prisma`
- Include proper `where` clauses for user-scoped data
- Use transactions for multi-step operations

## SQL Migrations

For Supabase, create SQL migrations manually in `prisma/migrations/`:
- Use TEXT type for IDs (not UUID) to match Prisma schema
- Include RLS policies with `(SELECT public.get_current_user_id())` for performance
- Add indexes on foreign keys and frequently queried columns
- Grant permissions to both `authenticated` and `service_role`

## Implementation Standards

**CRITICAL: Every implementation, no matter how small, must follow these standards:**

### Before Implementation
1. Read and understand all related code before making changes
2. Identify potential side effects on other parts of the codebase
3. Plan the implementation to avoid breaking existing functionality

### During Implementation
1. **Zero tolerance for errors** - Every change must be production-ready
2. **No N+1 query issues** - Always use `include` or batch queries instead of loops
3. **No side effects** - Changes must not impact unrelated features
4. **Type safety** - All code must pass TypeScript checks without errors
5. If you encounter any error, warning, or N+1 issue during implementation, fix it immediately

### N+1 Query Prevention
```typescript
// BAD - N+1 query (DO NOT DO THIS)
const users = await prisma.user.findMany();
for (const user of users) {
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
}

// GOOD - Single query with include
const users = await prisma.user.findMany({
  include: { profile: true }
});
```

### After Each Implementation Session
1. Run `npm run build` to verify no build errors
2. Run `npm run typecheck` to verify type safety
3. Review all changed files for potential N+1 queries
4. Check that no existing tests are broken
5. Verify the implementation doesn't introduce console errors or warnings
6. If any issues are found, fix them before considering the task complete

### Cascading Fix Rule
When fixing an issue:
1. Fix the immediate problem
2. Check all related code that might be affected by the fix
3. Update any dependent code to match the fix
4. Re-verify the entire affected area is working correctly
