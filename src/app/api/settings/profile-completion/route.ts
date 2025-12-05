import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: {
        bio: true,
        age: true,
        role: true,
        subjects: true,
        interests: true,
        goals: true,
        school: true,
        languages: true,
        skillLevel: true,
        studyStyle: true,
        availableDays: true,
        aboutYourself: true,
        aboutYourselfItems: true,
      },
    })

    if (!profile) {
      return NextResponse.json({
        completionPercentage: 0,
        missingFields: [
          'bio',
          'age',
          'role',
          'subjects',
          'interests',
        ],
      })
    }

    // Calculate completion percentage
    const fields = [
      { key: 'bio', value: profile.bio, required: true },
      { key: 'age', value: profile.age, required: true },
      { key: 'role', value: profile.role, required: true },
      { key: 'subjects', value: profile.subjects, required: true },
      { key: 'interests', value: profile.interests, required: true },
      { key: 'goals', value: profile.goals, required: false },
      { key: 'school', value: profile.school, required: false },
      { key: 'languages', value: profile.languages, required: false },
      { key: 'skillLevel', value: profile.skillLevel, required: false },
      { key: 'studyStyle', value: profile.studyStyle, required: false },
      { key: 'availableDays', value: profile.availableDays, required: false },
      { key: 'aboutYourself', value: profile.aboutYourself, required: false },
      { key: 'aboutYourselfItems', value: profile.aboutYourselfItems, required: false },
    ]

    const requiredFields = fields.filter(f => f.required)
    const optionalFields = fields.filter(f => !f.required)

    const completedRequired = requiredFields.filter(f => {
      if (Array.isArray(f.value)) return f.value.length > 0
      return f.value !== null && f.value !== undefined && f.value !== ''
    }).length

    const completedOptional = optionalFields.filter(f => {
      if (Array.isArray(f.value)) return f.value.length > 0
      return f.value !== null && f.value !== undefined && f.value !== ''
    }).length

    // Required fields are worth 70%, optional fields are worth 30%
    const requiredWeight = 0.7
    const optionalWeight = 0.3
    const requiredPercentage = (completedRequired / requiredFields.length) * 100
    const optionalPercentage = (completedOptional / optionalFields.length) * 100
    const completionPercentage = Math.round(
      (requiredPercentage * requiredWeight) + (optionalPercentage * optionalWeight)
    )

    const missingFields = fields
      .filter(f => {
        if (Array.isArray(f.value)) return f.value.length === 0
        return f.value === null || f.value === undefined || f.value === ''
      })
      .map(f => f.key)

    // Gamification: Calculate badges and rewards
    const badges = []
    const rewards = []

    // Badge: Profile Starter (completed all required fields)
    if (completedRequired === requiredFields.length) {
      badges.push({
        id: 'profile-starter',
        name: 'Profile Starter',
        icon: '🌟',
        description: 'Completed all required profile fields',
        earnedAt: null, // Would need to track in DB
      })
    }

    // Badge: Profile Pro (80%+ completion)
    if (completionPercentage >= 80) {
      badges.push({
        id: 'profile-pro',
        name: 'Profile Pro',
        icon: '🏆',
        description: 'Achieved 80%+ profile completion',
        earnedAt: null,
      })
    }

    // Badge: Profile Master (100% completion)
    if (completionPercentage === 100) {
      badges.push({
        id: 'profile-master',
        name: 'Profile Master',
        icon: '👑',
        description: 'Completed your entire profile',
        earnedAt: null,
      })
      rewards.push({
        id: 'better-matching',
        name: 'Enhanced Matching',
        description: 'Your complete profile helps find better study partners',
        icon: '🎯',
      })
    }

    // Reward tiers based on completion
    if (completionPercentage >= 50) {
      rewards.push({
        id: 'visibility-boost',
        name: 'Profile Visibility Boost',
        description: 'Your profile appears higher in partner searches',
        icon: '📈',
      })
    }

    // Next milestone calculation
    let nextMilestone = null
    if (completionPercentage < 50) {
      nextMilestone = { target: 50, name: 'Half Way There', reward: 'Profile Visibility Boost' }
    } else if (completionPercentage < 80) {
      nextMilestone = { target: 80, name: 'Profile Pro Badge', reward: 'Enhanced search ranking' }
    } else if (completionPercentage < 100) {
      nextMilestone = { target: 100, name: 'Profile Master Badge', reward: 'Best matching results' }
    }

    return NextResponse.json({
      completionPercentage,
      completedRequired,
      totalRequired: requiredFields.length,
      completedOptional,
      totalOptional: optionalFields.length,
      missingFields,
      // Gamification data
      badges,
      rewards,
      nextMilestone,
      isProfileComplete: completionPercentage === 100,
    })
  } catch (error) {
    console.error('Profile completion error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate profile completion' },
      { status: 500 }
    )
  }
}

