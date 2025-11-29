import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

/**
 * Migration API: Remove deprecated onlineStatus field from Profile table
 *
 * This endpoint removes the legacy onlineStatus column and its index.
 * UserPresence.status is now the single source of truth for online status.
 *
 * SECURITY: Admin-only endpoint - requires isAdmin = true
 */
export async function POST() {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // CRITICAL: Verify user is admin before allowing any database operations
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, deactivatedAt: true },
    })

    if (!dbUser?.isAdmin || dbUser.deactivatedAt) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    console.log('🔄 Starting migration: Remove onlineStatus from Profile table...')

    // Step 1: Drop the index on onlineStatus (if it exists)
    console.log('Step 1: Dropping index on onlineStatus...')
    try {
      await prisma.$executeRawUnsafe(`
        DROP INDEX IF EXISTS "Profile_onlineStatus_idx";
      `)
      console.log('✅ Index dropped successfully')
    } catch (error: any) {
      console.log('⚠️  Index drop:', error.message)
    }

    // Step 2: Drop the onlineStatus column from Profile table
    console.log('Step 2: Dropping onlineStatus column from Profile table...')
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Profile" DROP COLUMN IF EXISTS "onlineStatus";
      `)
      console.log('✅ Column dropped successfully')
    } catch (error: any) {
      console.log('⚠️  Column drop:', error.message)
    }

    // Step 3: Verify the changes
    console.log('Step 3: Verifying migration...')
    const result = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Profile'
      AND column_name = 'onlineStatus';
      `
    )

    if (result.length === 0) {
      console.log('✅ VERIFICATION PASSED: onlineStatus column has been removed')
      return NextResponse.json({
        success: true,
        message: 'Migration completed successfully',
        details: {
          indexDropped: 'Profile_onlineStatus_idx',
          columnDropped: 'Profile.onlineStatus',
          verification: 'Column does not exist in database',
          newSourceOfTruth: 'UserPresence.status'
        }
      })
    } else {
      throw new Error('VERIFICATION FAILED: onlineStatus column still exists')
    }

  } catch (error: any) {
    console.error('❌ Migration failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Migration failed',
        message: error.message,
        details: error
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check if migration is needed (Admin only)
export async function GET() {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // CRITICAL: Verify user is admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, deactivatedAt: true },
    })

    if (!dbUser?.isAdmin || dbUser.deactivatedAt) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const result = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Profile'
      AND column_name = 'onlineStatus';
      `
    )

    return NextResponse.json({
      migrationNeeded: result.length > 0,
      columnExists: result.length > 0,
      message: result.length > 0
        ? 'Migration is needed - onlineStatus column still exists'
        : 'Migration not needed - onlineStatus column has been removed'
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to check migration status',
        message: error.message
      },
      { status: 500 }
    )
  }
}
