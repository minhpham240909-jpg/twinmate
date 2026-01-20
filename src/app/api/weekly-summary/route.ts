/**
 * Weekly Summary API
 * 
 * GET: Fetch user's weekly summaries with reflections
 * POST: Create/update weekly summary for current week
 * 
 * Includes end-of-week reflection for retention
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Get ISO week number from date
function getWeekNumber(date: Date): { year: number; weekNumber: number; weekStart: Date; weekEnd: Date } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  
  // Calculate week start (Monday) and end (Sunday)
  const weekStart = new Date(date)
  weekStart.setDate(date.getDate() - (date.getDay() === 0 ? 6 : date.getDay() - 1))
  weekStart.setHours(0, 0, 0, 0)
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  
  return { year: d.getUTCFullYear(), weekNumber, weekStart, weekEnd }
}

// Generate personalized reflection prompt based on week stats
function generateReflectionPrompt(stats: {
  totalStudyMinutes: number
  streakMaintained: boolean
  goalAchieved: boolean
  topSubjects: string[]
}): string {
  const prompts = []
  
  if (stats.totalStudyMinutes > 300) {
    prompts.push(`You put in ${Math.round(stats.totalStudyMinutes / 60)} hours of study this week. What topic felt most engaging?`)
  } else if (stats.totalStudyMinutes > 60) {
    prompts.push(`You studied for ${stats.totalStudyMinutes} minutes this week. What made some sessions easier than others?`)
  } else {
    prompts.push(`This was a lighter week. What got in the way of studying, and what could help next week?`)
  }
  
  if (stats.streakMaintained) {
    prompts.push(`You kept your streak alive! What habit made that possible?`)
  }
  
  if (stats.goalAchieved) {
    prompts.push(`You hit your weekly goal! What's one thing you'd do differently next week?`)
  } else if (stats.totalStudyMinutes > 0) {
    prompts.push(`You didn't quite hit your goal, but you showed up. What would help you get closer next time?`)
  }
  
  if (stats.topSubjects.length > 0) {
    prompts.push(`You focused on ${stats.topSubjects.slice(0, 2).join(' and ')}. How confident do you feel in these areas now?`)
  }
  
  // Return a random prompt from the generated ones
  return prompts[Math.floor(Math.random() * prompts.length)] || 
    'Take a moment to reflect on your week. What went well, and what would you like to improve?'
}

/**
 * GET /api/weekly-summary
 * Fetch weekly summaries (current and past)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekParam = searchParams.get('week') // 'current' or ISO date string
    const limit = parseInt(searchParams.get('limit') || '10')

    if (weekParam === 'current' || !weekParam) {
      // Get current week summary
      const { year, weekNumber, weekStart, weekEnd } = getWeekNumber(new Date())
      
      let summary = await prisma.weeklySummary.findUnique({
        where: {
          userId_weekStart: {
            userId: user.id,
            weekStart,
          },
        },
      })

      // If no summary exists for current week, calculate stats and create one
      if (!summary) {
        // Calculate study stats for the week
        const focusSessions = await prisma.focusSession.aggregate({
          where: {
            userId: user.id,
            startedAt: { gte: weekStart, lte: weekEnd },
            status: 'COMPLETED',
          },
          _sum: { actualMinutes: true },
          _count: { id: true },
        })

        // Get profile for streak info
        const profile = await prisma.profile.findUnique({
          where: { userId: user.id },
          select: { 
            soloStudyStreak: true, 
            quickFocusStreak: true,
            subjects: true,
          },
        })

        const totalStudyMinutes = focusSessions._sum.actualMinutes || 0
        const totalSessions = focusSessions._count.id || 0
        const currentStreak = Math.max(
          profile?.soloStudyStreak || 0,
          profile?.quickFocusStreak || 0
        )

        // Create summary with reflection prompt
        const reflectionPrompt = generateReflectionPrompt({
          totalStudyMinutes,
          streakMaintained: currentStreak > 0,
          goalAchieved: totalStudyMinutes >= 120, // 2 hour default goal
          topSubjects: profile?.subjects || [],
        })

        summary = await prisma.weeklySummary.create({
          data: {
            userId: user.id,
            weekStart,
            weekEnd,
            year,
            weekNumber,
            totalStudyMinutes,
            totalSessions,
            streakAtWeekEnd: currentStreak,
            streakMaintained: currentStreak > 0,
            goalMinutes: 120, // Default 2 hour weekly goal
            goalAchieved: totalStudyMinutes >= 120,
            goalAchievementPercent: Math.min((totalStudyMinutes / 120) * 100, 100),
            topSubjects: profile?.subjects?.slice(0, 5) || [],
            reflectionPrompt,
          },
        })
      }

      return NextResponse.json({
        success: true,
        summary,
        isCurrentWeek: true,
      })
    } else {
      // Get past summaries
      const summaries = await prisma.weeklySummary.findMany({
        where: { userId: user.id },
        orderBy: { weekStart: 'desc' },
        take: limit,
      })

      return NextResponse.json({
        success: true,
        summaries,
      })
    }
  } catch (error) {
    console.error('[Weekly Summary GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weekly summary' },
      { status: 500 }
    )
  }
}

// Validation schema for reflection
const reflectionSchema = z.object({
  reflectionResponse: z.string().min(10).max(5000),
  weekSatisfactionRating: z.number().int().min(1).max(5).optional(),
  nextWeekIntentions: z.string().max(1000).optional(),
})

/**
 * POST /api/weekly-summary
 * Submit weekly reflection
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = reflectionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { reflectionResponse, weekSatisfactionRating, nextWeekIntentions } = validation.data

    // Get current week
    const { weekStart } = getWeekNumber(new Date())

    // Update or create summary with reflection
    const summary = await prisma.weeklySummary.upsert({
      where: {
        userId_weekStart: {
          userId: user.id,
          weekStart,
        },
      },
      update: {
        reflectionResponse,
        reflectionCompletedAt: new Date(),
        weekSatisfactionRating,
        nextWeekIntentions,
        isComplete: true,
      },
      create: {
        userId: user.id,
        weekStart,
        weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
        year: weekStart.getFullYear(),
        weekNumber: getWeekNumber(weekStart).weekNumber,
        reflectionResponse,
        reflectionCompletedAt: new Date(),
        weekSatisfactionRating,
        nextWeekIntentions,
        isComplete: true,
        reflectionPrompt: 'Take a moment to reflect on your week.',
      },
    })

    // Award XP for completing reflection (gamification)
    try {
      await prisma.profile.update({
        where: { userId: user.id },
        data: {
          totalPoints: { increment: 25 }, // 25 XP for reflection
        },
      })
    } catch {
      // Ignore if profile doesn't exist
    }

    return NextResponse.json({
      success: true,
      summary,
      message: '✨ Reflection saved! +25 XP for taking time to reflect.',
    })
  } catch (error) {
    console.error('[Weekly Summary POST] Error:', error)
    return NextResponse.json(
      { error: 'Failed to save reflection' },
      { status: 500 }
    )
  }
}
