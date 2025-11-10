import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// GET: Fetch privacy settings
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const presence = await prisma.userPresence.findUnique({
      where: { userId: user.id },
      select: {
        isPrivate: true,
      },
    })

    return NextResponse.json({
      success: true,
      settings: {
        isPrivate: presence?.isPrivate || false,
      },
    })
  } catch (error) {
    console.error('[GET PRIVACY SETTINGS ERROR]', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: Update privacy settings
const UpdatePrivacySchema = z.object({
  isPrivate: z.boolean(),
})

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = UpdatePrivacySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { isPrivate } = validation.data

    const updatedPresence = await prisma.userPresence.upsert({
      where: { userId: user.id },
      update: {
        isPrivate,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        isPrivate,
        status: 'offline',
      },
    })

    return NextResponse.json({
      success: true,
      settings: {
        isPrivate: updatedPresence.isPrivate,
      },
    })
  } catch (error) {
    console.error('[UPDATE PRIVACY SETTINGS ERROR]', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
