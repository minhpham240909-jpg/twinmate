import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { StudyStyle } from '@prisma/client'
import { z } from 'zod'
import { invalidateUserCache } from '@/lib/cache'

const profileSchema = z.object({
  userId: z.string(),
  name: z.string().min(1),
  bio: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  age: z.number().int().min(1).max(150).optional().nullable(), // NEW: Age field
  role: z.string().optional().nullable(), // NEW: Role/position field
  subjects: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  goals: z.array(z.string()).default([]),
  skillLevel: z.union([
    z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
    z.literal(''),
    z.undefined(),
    z.null()
  ]).optional(),
  studyStyle: z.union([
    z.enum(['COLLABORATIVE', 'INDEPENDENT', 'MIXED', 'VISUAL', 'AUDITORY', 'KINESTHETIC', 'READING_WRITING', 'SOLO']),
    z.literal(''),
    z.undefined(),
    z.null()
  ]).optional(),
  availableDays: z.array(z.string()).default([]),
  availableHours: z.string().optional().nullable(),
  subjectCustomDescription: z.string().optional().nullable(),
  skillLevelCustomDescription: z.string().optional().nullable(),
  studyStyleCustomDescription: z.string().optional().nullable(),
  interestsCustomDescription: z.string().optional().nullable(),
  availabilityCustomDescription: z.string().optional().nullable(),
  // NEW: Add more about yourself fields
  aboutYourselfItems: z.array(z.string()).optional().default([]),
  aboutYourself: z.string().optional().nullable(),
  // NEW: School and Languages
  school: z.string().optional().nullable(),
  languages: z.string().optional().nullable(),
  // NEW: Post Privacy
  postPrivacy: z.enum(['PUBLIC', 'PARTNERS_ONLY']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Use server client which automatically reads Supabase cookies
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[Profile Update] Auth error:', authError)
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token. Please sign in again.' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = profileSchema.safeParse(body)

    if (!validation.success) {
      console.error('[Profile Update] Validation failed:', validation.error.issues)
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Verify user is updating their own profile
    if (data.userId !== user.id) {
      console.error('[Profile Update] User ID mismatch:', { requested: data.userId, actual: user.id })
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Prepare data for database - convert empty strings to null and string to array
    // Helper function to safely trim and check if string is not empty
    const cleanString = (value: string | null | undefined): string | null => {
      if (!value || typeof value !== 'string') return null
      const trimmed = value.trim()
      return trimmed !== '' ? trimmed : null
    }

    const profileDataFields = {
      bio: cleanString(data.bio),
      age: data.age || null, // NEW: Age field
      role: cleanString(data.role), // NEW: Role field
      subjects: data.subjects || [],
      interests: data.interests || [],
      goals: data.goals || [],
      skillLevel: cleanString(data.skillLevel) as any,
      studyStyle: cleanString(data.studyStyle) as StudyStyle | null,
      availableDays: data.availableDays || [],
      availableHours: cleanString(data.availableHours) ? [cleanString(data.availableHours)!] : [],
      subjectCustomDescription: cleanString(data.subjectCustomDescription),
      skillLevelCustomDescription: cleanString(data.skillLevelCustomDescription),
      studyStyleCustomDescription: cleanString(data.studyStyleCustomDescription),
      interestsCustomDescription: cleanString(data.interestsCustomDescription),
      availabilityCustomDescription: cleanString(data.availabilityCustomDescription),
      aboutYourselfItems: data.aboutYourselfItems || [],
      aboutYourself: cleanString(data.aboutYourself),
      school: cleanString(data.school),
      languages: cleanString(data.languages),
      postPrivacy: data.postPrivacy || 'PUBLIC',
    }

    // Wrap user and profile updates in a transaction to ensure atomicity
    const profile = await prisma.$transaction(async (tx) => {
      // Update user name and avatar
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: data.name,
          avatarUrl: data.avatarUrl || null,
        },
      })

      // Check if profile exists
      const existingProfile = await tx.profile.findUnique({
        where: { userId: user.id },
      })

      if (existingProfile) {
        // Update existing profile
        return await tx.profile.update({
          where: { userId: user.id },
          data: profileDataFields,
        })
      } else {
        // Create new profile
        return await tx.profile.create({
          data: {
            userId: user.id,
            ...profileDataFields,
          },
        })
      }
    })

    // Invalidate user cache after profile update
    await invalidateUserCache(user.id)

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    console.error('[Profile Update] ERROR occurred:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('[Profile Update] Error message:', errorMessage)
    console.error('[Profile Update] Error stack:', errorStack)
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
}
