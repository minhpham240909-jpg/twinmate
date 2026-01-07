import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { StudyStyle } from '@prisma/client'
import { z } from 'zod'
import { invalidateUserCache } from '@/lib/cache'
import { updateProfileEmbedding } from '@/lib/embeddings'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import logger from '@/lib/logger'
import {
  MAX_BIO_LENGTH,
  MAX_ARRAY_ITEMS,
  MAX_ARRAY_ITEM_LENGTH,
  MAX_CUSTOM_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_SHORT_TEXT_LENGTH,
  bioSchema,
  limitedArraySchema,
  customDescriptionSchema,
  httpUrlSchema,
} from '@/lib/security/input-validation'

// Create a safe array schema with limits
const safeArraySchema = limitedArraySchema(MAX_ARRAY_ITEMS, MAX_ARRAY_ITEM_LENGTH)

const profileSchema = z.object({
  userId: z.string(),
  name: z.string().min(1).max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or less`),
  bio: bioSchema, // Limited to MAX_BIO_LENGTH characters
  avatarUrl: httpUrlSchema, // Validate HTTP(S) URLs only
  age: z.number().int().min(1).max(150).optional().nullable(),
  role: z.string().max(MAX_SHORT_TEXT_LENGTH).optional().nullable(),
  subjects: safeArraySchema, // Limited array
  interests: safeArraySchema, // Limited array
  goals: safeArraySchema, // Limited array
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
  availableDays: safeArraySchema, // Limited array
  availableHours: z.string().max(MAX_SHORT_TEXT_LENGTH).optional().nullable(),
  subjectCustomDescription: customDescriptionSchema,
  skillLevelCustomDescription: customDescriptionSchema,
  studyStyleCustomDescription: customDescriptionSchema,
  interestsCustomDescription: customDescriptionSchema,
  availabilityCustomDescription: customDescriptionSchema,
  // About yourself fields with limits
  aboutYourselfItems: safeArraySchema.optional().default([]),
  aboutYourself: z.string().max(MAX_BIO_LENGTH).optional().nullable(),
  // School and Languages with limits
  school: z.string().max(MAX_SHORT_TEXT_LENGTH).optional().nullable(),
  languages: z.string().max(MAX_SHORT_TEXT_LENGTH).optional().nullable(),
  // Post Privacy
  postPrivacy: z.enum(['PUBLIC', 'PARTNERS_ONLY']).optional(),
  // Strengths and Weaknesses for partner matching (stored in LearningProfile)
  strengths: safeArraySchema.optional().default([]),
  weaknesses: safeArraySchema.optional().default([]),
  // H2 FIX: Optimistic locking - client sends the updatedAt timestamp they're basing their changes on
  expectedUpdatedAt: z.string().datetime().optional(),
})

export async function POST(request: NextRequest) {
  // Rate limiting: 30 profile updates per minute (moderate)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many profile updates. Please slow down.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Use server client which automatically reads Supabase cookies
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      logger.warn('Profile update auth error', { error: authError })
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token. Please sign in again.' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = profileSchema.safeParse(body)

    if (!validation.success) {
      logger.warn('Profile update validation failed', { issues: validation.error.issues })
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Verify user is updating their own profile
    if (data.userId !== user.id) {
      logger.warn('Profile update forbidden - user ID mismatch', { requested: data.userId, actual: user.id })
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

    // H2 FIX: Wrap user and profile updates in a transaction with optimistic locking
    const profile = await prisma.$transaction(async (tx) => {
      // H2 FIX: Check for concurrent updates using optimistic locking
      if (data.expectedUpdatedAt) {
        const currentProfile = await tx.profile.findUnique({
          where: { userId: user.id },
          select: { updatedAt: true },
        })
        
        if (currentProfile) {
          const expectedTime = new Date(data.expectedUpdatedAt).getTime()
          const currentTime = currentProfile.updatedAt.getTime()
          
          // Allow 1 second tolerance for timestamp comparison
          if (Math.abs(currentTime - expectedTime) > 1000) {
            throw new Error('CONCURRENT_UPDATE: Profile was modified by another request. Please refresh and try again.')
          }
        }
      }

      // Update user name (and avatar only if explicitly provided)
      // If avatarUrl is undefined, don't update it - preserve existing avatar
      const userUpdateData: { name: string; avatarUrl?: string | null } = {
        name: data.name,
      }

      // Only update avatarUrl if it was explicitly provided in the request
      // undefined = not provided (don't change), null or string = explicitly set
      if (data.avatarUrl !== undefined) {
        userUpdateData.avatarUrl = data.avatarUrl || null
      }

      await tx.user.update({
        where: { id: user.id },
        data: userUpdateData,
      })

      // Check if profile exists
      const existingProfile = await tx.profile.findUnique({
        where: { userId: user.id },
      })

      let updatedProfile
      if (existingProfile) {
        // Update existing profile
        updatedProfile = await tx.profile.update({
          where: { userId: user.id },
          data: profileDataFields,
        })
      } else {
        // Create new profile
        updatedProfile = await tx.profile.create({
          data: {
            userId: user.id,
            ...profileDataFields,
          },
        })
      }

      // Update or create LearningProfile for strengths and weaknesses
      const learningProfileData = {
        strengths: data.strengths || [],
        weaknesses: data.weaknesses || [],
      }

      const existingLearningProfile = await tx.learningProfile.findUnique({
        where: { userId: user.id },
      })

      if (existingLearningProfile) {
        await tx.learningProfile.update({
          where: { userId: user.id },
          data: learningProfileData,
        })
      } else {
        await tx.learningProfile.create({
          data: {
            userId: user.id,
            ...learningProfileData,
          },
        })
      }

      return updatedProfile
    })

    // Invalidate user cache after profile update
    await invalidateUserCache(user.id)

    // Update profile embedding for semantic search (async, non-blocking)
    // This generates OpenAI embeddings for vector search
    updateProfileEmbedding(profile.id).catch(err => {
      logger.error('Failed to update profile embedding', err instanceof Error ? err : { error: err })
    })

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Profile update error', error instanceof Error ? error : { error: errorMessage })
    
    // H2 FIX: Handle concurrent update error with proper status code
    if (errorMessage.includes('CONCURRENT_UPDATE')) {
      return NextResponse.json(
        { error: 'Profile was modified by another session. Please refresh and try again.', code: 'CONCURRENT_UPDATE' },
        { status: 409 } // 409 Conflict
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
}
