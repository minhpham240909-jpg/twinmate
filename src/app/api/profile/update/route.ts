import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { StudyStyle } from '@prisma/client'
import { z } from 'zod'

const profileSchema = z.object({
  userId: z.string(),
  name: z.string().min(1),
  bio: z.string().optional().or(z.literal('')),
  avatarUrl: z.string().optional().or(z.literal('')),
  subjects: z.array(z.string()),
  interests: z.array(z.string()),
  goals: z.array(z.string()),
  skillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional().or(z.literal('')),
  studyStyle: z.enum(['COLLABORATIVE', 'INDEPENDENT', 'MIXED', 'VISUAL', 'AUDITORY', 'KINESTHETIC', 'READING_WRITING', 'SOLO']).optional().or(z.literal('')),
  availableDays: z.array(z.string()),
  availableHours: z.string().optional().or(z.literal('')),
  subjectCustomDescription: z.string().optional().or(z.literal('')),
  skillLevelCustomDescription: z.string().optional().or(z.literal('')),
  studyStyleCustomDescription: z.string().optional().or(z.literal('')),
  interestsCustomDescription: z.string().optional().or(z.literal('')),
  availabilityCustomDescription: z.string().optional().or(z.literal('')),
  // NEW: Add more about yourself fields
  aboutYourselfItems: z.array(z.string()).optional().default([]),
  aboutYourself: z.string().optional().or(z.literal('')),
  // NEW: School and Languages
  school: z.string().optional().or(z.literal('')),
  languages: z.string().optional().or(z.literal('')),
})

export async function POST(request: NextRequest) {
  try {
    console.log('[Profile Update] Starting profile update request...')

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

    console.log('[Profile Update] User authenticated:', user.email)

    // Parse and validate request body
    const body = await request.json()
    console.log('[Profile Update] Request body keys:', Object.keys(body))
    console.log('[Profile Update] Full request body:', JSON.stringify(body, null, 2))

    const validation = profileSchema.safeParse(body)

    if (!validation.success) {
      console.error('[Profile Update] Validation failed:', validation.error.issues)
      console.error('[Profile Update] Failed body:', JSON.stringify(body, null, 2))
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data
    console.log('[Profile Update] Data validated successfully')

    // Verify user is updating their own profile
    if (data.userId !== user.id) {
      console.error('[Profile Update] User ID mismatch:', { requested: data.userId, actual: user.id })
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Prepare data for database - convert empty strings to null and string to array
    const profileDataFields = {
      bio: data.bio || null,
      subjects: data.subjects,
      interests: data.interests,
      goals: data.goals,
      skillLevel: data.skillLevel || null, // Optional now
      studyStyle: data.studyStyle ? (data.studyStyle as StudyStyle) : null, // Optional now
      availableDays: data.availableDays,
      availableHours: data.availableHours && data.availableHours.trim() !== '' ? [data.availableHours] : [],
      subjectCustomDescription: data.subjectCustomDescription || null,
      skillLevelCustomDescription: data.skillLevelCustomDescription || null,
      studyStyleCustomDescription: data.studyStyleCustomDescription || null,
      interestsCustomDescription: data.interestsCustomDescription || null,
      availabilityCustomDescription: data.availabilityCustomDescription || null,
      aboutYourselfItems: data.aboutYourselfItems || [],
      aboutYourself: data.aboutYourself || null,
      school: data.school || null,
      languages: data.languages || null,
    }

    console.log('[Profile Update] Starting database transaction...')

    // Wrap user and profile updates in a transaction to ensure atomicity
    const profile = await prisma.$transaction(async (tx) => {
      // Update user name and avatar
      console.log('[Profile Update] Updating user:', user.id)
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

      console.log('[Profile Update] Profile exists:', !!existingProfile)

      if (existingProfile) {
        // Update existing profile
        console.log('[Profile Update] Updating existing profile...')
        return await tx.profile.update({
          where: { userId: user.id },
          data: profileDataFields,
        })
      } else {
        // Create new profile
        console.log('[Profile Update] Creating new profile...')
        return await tx.profile.create({
          data: {
            userId: user.id,
            ...profileDataFields,
          },
        })
      }
    })

    console.log('[Profile Update] Transaction completed successfully')

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
