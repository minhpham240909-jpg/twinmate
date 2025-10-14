import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { StudyStyle } from '@prisma/client'
import { z } from 'zod'

const profileSchema = z.object({
  userId: z.string(),
  name: z.string().min(1),
  bio: z.string().optional(),
  avatarUrl: z.string().optional(),
  subjects: z.array(z.string()),
  interests: z.array(z.string()),
  goals: z.array(z.string()),
  skillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  studyStyle: z.enum(['COLLABORATIVE', 'INDEPENDENT', 'MIXED', 'VISUAL', 'AUDITORY', 'KINESTHETIC', 'READING_WRITING', 'SOLO']).optional(),
  availableDays: z.array(z.string()),
  availableHours: z.string().optional(),
  subjectCustomDescription: z.string().optional(),
  skillLevelCustomDescription: z.string().optional(),
  studyStyleCustomDescription: z.string().optional(),
  interestsCustomDescription: z.string().optional(),
  availabilityCustomDescription: z.string().optional(),
  // NEW: Add more about yourself fields
  aboutYourselfItems: z.array(z.string()).optional(),
  aboutYourself: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = profileSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Verify user is updating their own profile
    if (data.userId !== user.id) {
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

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    console.error('Profile update error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
}
