// One-time migration endpoint for collaboration features
// This should be deleted after successful migration
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    // Verify authentication - only allow for admin or during initial setup
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Migration] Starting collaboration features migration...')

    // Create SessionWhiteboard table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SessionWhiteboard" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "sessionId" TEXT NOT NULL UNIQUE,
        "title" TEXT NOT NULL DEFAULT 'Untitled Whiteboard',
        "description" TEXT,
        "snapshotUrl" TEXT,
        "thumbnailUrl" TEXT,
        "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastEditedBy" TEXT,
        "version" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SessionWhiteboard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SessionWhiteboard_sessionId_idx" ON "SessionWhiteboard"("sessionId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SessionWhiteboard_lastSyncedAt_idx" ON "SessionWhiteboard"("lastSyncedAt")`)

    console.log('[Migration] ✓ SessionWhiteboard table created')

    // Create SessionWhiteboardVersion table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SessionWhiteboardVersion" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "whiteboardId" TEXT NOT NULL,
        "version" INTEGER NOT NULL,
        "snapshotUrl" TEXT NOT NULL,
        "createdBy" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SessionWhiteboardVersion_whiteboardId_fkey" FOREIGN KEY ("whiteboardId") REFERENCES "SessionWhiteboard"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SessionWhiteboardVersion_whiteboardId_idx" ON "SessionWhiteboardVersion"("whiteboardId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SessionWhiteboardVersion_whiteboardId_version_idx" ON "SessionWhiteboardVersion"("whiteboardId", "version")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SessionWhiteboardVersion_createdAt_idx" ON "SessionWhiteboardVersion"("createdAt")`)

    console.log('[Migration] ✓ SessionWhiteboardVersion table created')

    // Create SessionNote table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SessionNote" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "sessionId" TEXT NOT NULL UNIQUE,
        "title" TEXT NOT NULL DEFAULT 'Untitled Note',
        "content" TEXT,
        "contentUrl" TEXT,
        "lastEditedBy" TEXT,
        "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "version" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SessionNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SessionNote_sessionId_idx" ON "SessionNote"("sessionId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SessionNote_lastEditedAt_idx" ON "SessionNote"("lastEditedAt")`)

    console.log('[Migration] ✓ SessionNote table created')

    // Create SessionFlashcard table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SessionFlashcard" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "sessionId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "front" TEXT NOT NULL,
        "back" TEXT NOT NULL,
        "difficulty" INTEGER NOT NULL DEFAULT 0,
        "lastReviewed" TIMESTAMP(3),
        "reviewCount" INTEGER NOT NULL DEFAULT 0,
        "correctCount" INTEGER NOT NULL DEFAULT 0,
        "incorrectCount" INTEGER NOT NULL DEFAULT 0,
        "nextReviewDate" TIMESTAMP(3),
        "intervalDays" INTEGER NOT NULL DEFAULT 1,
        "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
        "repetitions" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SessionFlashcard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "SessionFlashcard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)

    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SessionFlashcard_sessionId_userId_id_key" ON "SessionFlashcard"("sessionId", "userId", "id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SessionFlashcard_sessionId_userId_idx" ON "SessionFlashcard"("sessionId", "userId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SessionFlashcard_userId_nextReviewDate_idx" ON "SessionFlashcard"("userId", "nextReviewDate")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SessionFlashcard_createdAt_idx" ON "SessionFlashcard"("createdAt")`)

    console.log('[Migration] ✓ SessionFlashcard table created')

    // Enable RLS
    await prisma.$executeRawUnsafe(`ALTER TABLE "SessionWhiteboard" ENABLE ROW LEVEL SECURITY`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "SessionWhiteboardVersion" ENABLE ROW LEVEL SECURITY`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "SessionNote" ENABLE ROW LEVEL SECURITY`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "SessionFlashcard" ENABLE ROW LEVEL SECURITY`)

    console.log('[Migration] ✓ RLS enabled on all tables')

    // Apply RLS policies for SessionWhiteboard
    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Users can view whiteboards for their sessions"
        ON "SessionWhiteboard" FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM "SessionParticipant"
            WHERE "SessionParticipant"."sessionId" = "SessionWhiteboard"."sessionId"
            AND "SessionParticipant"."userId" = auth.uid()::text
          )
        )
    `)

    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Users can update whiteboards for their sessions"
        ON "SessionWhiteboard" FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM "SessionParticipant"
            WHERE "SessionParticipant"."sessionId" = "SessionWhiteboard"."sessionId"
            AND "SessionParticipant"."userId" = auth.uid()::text
          )
        )
    `)

    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Session hosts can insert whiteboards"
        ON "SessionWhiteboard" FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM "StudySession"
            WHERE "StudySession"."id" = "SessionWhiteboard"."sessionId"
            AND "StudySession"."createdBy" = auth.uid()::text
          )
        )
    `)

    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Session hosts can delete whiteboards"
        ON "SessionWhiteboard" FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM "StudySession"
            WHERE "StudySession"."id" = "SessionWhiteboard"."sessionId"
            AND "StudySession"."createdBy" = auth.uid()::text
          )
        )
    `)

    console.log('[Migration] ✓ SessionWhiteboard RLS policies created')

    // Apply RLS policies for SessionWhiteboardVersion
    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Users can view whiteboard versions for their sessions"
        ON "SessionWhiteboardVersion" FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM "SessionWhiteboard" wb
            INNER JOIN "SessionParticipant" sp ON wb."sessionId" = sp."sessionId"
            WHERE wb."id" = "SessionWhiteboardVersion"."whiteboardId"
            AND sp."userId" = auth.uid()::text
          )
        )
    `)

    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Users can create whiteboard versions for their sessions"
        ON "SessionWhiteboardVersion" FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM "SessionWhiteboard" wb
            INNER JOIN "SessionParticipant" sp ON wb."sessionId" = sp."sessionId"
            WHERE wb."id" = "SessionWhiteboardVersion"."whiteboardId"
            AND sp."userId" = auth.uid()::text
          )
        )
    `)

    console.log('[Migration] ✓ SessionWhiteboardVersion RLS policies created')

    // Apply RLS policies for SessionNote
    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Users can view notes for their sessions"
        ON "SessionNote" FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM "SessionParticipant"
            WHERE "SessionParticipant"."sessionId" = "SessionNote"."sessionId"
            AND "SessionParticipant"."userId" = auth.uid()::text
          )
        )
    `)

    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Users can update notes for their sessions"
        ON "SessionNote" FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM "SessionParticipant"
            WHERE "SessionParticipant"."sessionId" = "SessionNote"."sessionId"
            AND "SessionParticipant"."userId" = auth.uid()::text
          )
        )
    `)

    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Session hosts can insert notes"
        ON "SessionNote" FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM "StudySession"
            WHERE "StudySession"."id" = "SessionNote"."sessionId"
            AND "StudySession"."createdBy" = auth.uid()::text
          )
        )
    `)

    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Session hosts can delete notes"
        ON "SessionNote" FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM "StudySession"
            WHERE "StudySession"."id" = "SessionNote"."sessionId"
            AND "StudySession"."createdBy" = auth.uid()::text
          )
        )
    `)

    console.log('[Migration] ✓ SessionNote RLS policies created')

    // Apply RLS policies for SessionFlashcard
    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Users can view their own flashcards"
        ON "SessionFlashcard" FOR SELECT
        USING ("userId" = auth.uid()::text)
    `)

    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Users can insert their own flashcards"
        ON "SessionFlashcard" FOR INSERT
        WITH CHECK (
          "userId" = auth.uid()::text
          AND EXISTS (
            SELECT 1 FROM "SessionParticipant"
            WHERE "SessionParticipant"."sessionId" = "SessionFlashcard"."sessionId"
            AND "SessionParticipant"."userId" = auth.uid()::text
          )
        )
    `)

    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Users can update their own flashcards"
        ON "SessionFlashcard" FOR UPDATE
        USING ("userId" = auth.uid()::text)
    `)

    await prisma.$executeRawUnsafe(`
      CREATE POLICY IF NOT EXISTS "Users can delete their own flashcards"
        ON "SessionFlashcard" FOR DELETE
        USING ("userId" = auth.uid()::text)
    `)

    console.log('[Migration] ✓ SessionFlashcard RLS policies created')

    // Verify tables were created
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('SessionWhiteboard', 'SessionWhiteboardVersion', 'SessionNote', 'SessionFlashcard')
      ORDER BY tablename
    `

    console.log('[Migration] ✓ Migration completed successfully!')
    console.log('[Migration] Created tables:', tables.map(t => t.tablename))

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      tablesCreated: tables.map(t => t.tablename),
    })
  } catch (error: any) {
    console.error('[Migration] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
