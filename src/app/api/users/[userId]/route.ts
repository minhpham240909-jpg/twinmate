// API Route: Get User Profile
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user with profile and posts
    let dbUser: any = null
    try {
      dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          profile: true,
          createdAt: true,
          presence: {
            select: {
              // @ts-ignore - Prisma type inference issue
              onlineStatus: true,
            },
          },
        },
      })
    } catch (error) {
      console.error('Error fetching user:', error)
      // Try without presence relation if it fails
      try {
        dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            role: true,
            profile: true,
            createdAt: true,
          },
        })
        // Add null presence if not included
        if (dbUser) {
          dbUser.presence = null
        }
      } catch (retryError) {
        console.error('Error fetching user (retry):', retryError)
        throw retryError
      }
    }

    // Ensure dbUser is not null before proceeding
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Ensure profile exists - create if missing (safety check for data integrity)
    if (!dbUser.profile) {
      try {
        await prisma.profile.create({
          data: { userId: dbUser.id },
        })
        // Refetch user with profile
        const updatedUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            role: true,
            profile: true,
            createdAt: true,
            presence: {
              select: {
                // @ts-ignore - Prisma type inference issue
                onlineStatus: true,
              },
            },
          },
        }) as any
        if (updatedUser) {
          dbUser = updatedUser
        }
      } catch (error) {
        // Profile might already exist (race condition), continue with null profile
        console.warn('Could not create profile (may already exist):', error)
      }
    }

    // Get user's non-deleted posts
    let userPosts: any[] = []
    try {
      userPosts = await prisma.post.findMany({
        where: {
          userId: userId,
          isDeleted: false,
        },
        include: {
          _count: {
            select: {
              likes: true,
              comments: true,
              reposts: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10, // Show latest 10 posts
      })
    } catch (error) {
      console.warn('Error fetching user posts:', error)
      // Continue with empty array
      userPosts = []
    }

    // Check connection status between current user and viewed user
    let connectionStatus = 'none' // 'none' | 'pending' | 'connected'
    let connectionId = null

    if (user.id !== userId) {
      try {
        const connection = await prisma.match.findFirst({
          where: {
            OR: [
              { senderId: user.id, receiverId: userId },
              { senderId: userId, receiverId: user.id },
            ],
          },
          select: {
            id: true,
            status: true,
            senderId: true,
          },
        })

        if (connection) {
          connectionId = connection.id
          if (connection.status === 'ACCEPTED') {
            connectionStatus = 'connected'
          } else if (connection.status === 'PENDING') {
            connectionStatus = 'pending'
          }
        }
      } catch (error) {
        console.warn('Error checking connection status:', error)
        // Continue with default values
      }
    }

    // Calculate match score (subjects + interests + study style)
    let matchScore = 0
    const matchDetails = {
      subjects: 0,
      interests: 0,
      studyStyle: false,
    }

    if (user.id !== userId && dbUser.profile) {
      try {
        // Get current user's profile
        const currentUserProfile = await prisma.profile.findUnique({
          where: { userId: user.id },
        })

        if (currentUserProfile && dbUser.profile) {
          // Match subjects - ensure arrays exist
          const profileSubjects = Array.isArray(dbUser.profile.subjects) ? dbUser.profile.subjects : []
          const currentSubjects = Array.isArray(currentUserProfile.subjects) ? currentUserProfile.subjects : []
          const commonSubjects = profileSubjects.filter((subject: string) =>
            currentSubjects.includes(subject)
          )
          matchDetails.subjects = commonSubjects.length

          // Match interests - ensure arrays exist
          const profileInterests = Array.isArray(dbUser.profile.interests) ? dbUser.profile.interests : []
          const currentInterests = Array.isArray(currentUserProfile.interests) ? currentUserProfile.interests : []
          const commonInterests = profileInterests.filter((interest: string) =>
            currentInterests.includes(interest)
          )
          matchDetails.interests = commonInterests.length

          // Match study style
          matchDetails.studyStyle = dbUser.profile.studyStyle === currentUserProfile.studyStyle

          // Calculate total match score (out of 100)
          const subjectScore = Math.min((matchDetails.subjects / 5) * 40, 40) // Max 40 points
          const interestScore = Math.min((matchDetails.interests / 5) * 40, 40) // Max 40 points
          const styleScore = matchDetails.studyStyle ? 20 : 0 // 20 points

          matchScore = Math.round(subjectScore + interestScore + styleScore)
        }
      } catch (error) {
        console.warn('Error calculating match score:', error)
        // Continue with default values (matchScore = 0)
      }
    }

    // Safely get online status
    let onlineStatus = null
    try {
      if (connectionStatus === 'connected' && dbUser.presence?.onlineStatus) {
        onlineStatus = dbUser.presence.onlineStatus
      }
    } catch (error) {
      console.warn('Error getting online status:', error)
    }

    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        avatarUrl: dbUser.avatarUrl,
        role: dbUser.role,
        onlineStatus,
      },
      profile: dbUser.profile || null,
      posts: userPosts || [],
      connectionStatus,
      connectionId,
      matchScore,
      matchDetails,
    })
  } catch (error) {
    console.error('Get user error:', error)
    // Log the full error for debugging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
    }
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}