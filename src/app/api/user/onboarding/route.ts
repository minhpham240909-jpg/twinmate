/**
 * USER ONBOARDING API
 *
 * Tracks user onboarding progress and completion.
 *
 * GET - Get current onboarding status
 * POST - Update onboarding step or mark complete
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-auth'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

// ============================================================================
// Types
// ============================================================================

type OnboardingStep = 'not_started' | 'identity' | 'commitment' | 'goal' | 'completed'

interface OnboardingStatus {
  step: OnboardingStep
  completedAt: string | null
  skippedAt: string | null
  isComplete: boolean
}

// Valid step transitions
const STEP_ORDER: OnboardingStep[] = ['not_started', 'identity', 'commitment', 'goal', 'completed']

// ============================================================================
// GET - Get onboarding status
// ============================================================================

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return apiUnauthorized()
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        onboardingStep: true,
        onboardingCompletedAt: true,
        onboardingSkippedAt: true,
      },
    })

    if (!userData) {
      return apiError('User not found', 404)
    }

    const status: OnboardingStatus = {
      step: (userData.onboardingStep as OnboardingStep) || 'not_started',
      completedAt: userData.onboardingCompletedAt?.toISOString() || null,
      skippedAt: userData.onboardingSkippedAt?.toISOString() || null,
      isComplete: userData.onboardingCompletedAt !== null || userData.onboardingSkippedAt !== null,
    }

    return apiSuccess(status)
  } catch (error) {
    console.error('[Onboarding] Failed to get status:', error)
    return apiError('Failed to get onboarding status', 500)
  }
}

// ============================================================================
// POST - Update onboarding progress
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return apiUnauthorized()
    }

    const body = await request.json()
    const { action, step } = body as { action?: 'complete' | 'skip' | 'advance'; step?: OnboardingStep }

    // Get current state
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        onboardingStep: true,
        onboardingCompletedAt: true,
      },
    })

    if (!currentUser) {
      return apiError('User not found', 404)
    }

    // Already completed - no changes allowed
    if (currentUser.onboardingCompletedAt) {
      return apiSuccess({ 
        step: 'completed',
        isComplete: true,
        message: 'Onboarding already completed',
      })
    }

    const now = new Date()
    let updateData: {
      onboardingStep?: string
      onboardingCompletedAt?: Date
      onboardingSkippedAt?: Date
    } = {}

    switch (action) {
      case 'complete':
        // Mark onboarding as fully completed
        updateData = {
          onboardingStep: 'completed',
          onboardingCompletedAt: now,
        }
        break

      case 'skip':
        // User chose to skip onboarding
        updateData = {
          onboardingSkippedAt: now,
        }
        break

      case 'advance':
        // Move to next step
        if (!step || !STEP_ORDER.includes(step)) {
          return apiError('Invalid step', 400)
        }

        const currentIndex = STEP_ORDER.indexOf(currentUser.onboardingStep as OnboardingStep)
        const newIndex = STEP_ORDER.indexOf(step)

        // Can only advance forward or stay at same step
        if (newIndex < currentIndex) {
          return apiError('Cannot go back in onboarding', 400)
        }

        updateData = {
          onboardingStep: step,
        }

        // If advancing to 'completed', also set completedAt
        if (step === 'completed') {
          updateData.onboardingCompletedAt = now
        }
        break

      default:
        return apiError('Invalid action. Use: complete, skip, or advance', 400)
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        onboardingStep: true,
        onboardingCompletedAt: true,
        onboardingSkippedAt: true,
      },
    })

    const status: OnboardingStatus = {
      step: updated.onboardingStep as OnboardingStep,
      completedAt: updated.onboardingCompletedAt?.toISOString() || null,
      skippedAt: updated.onboardingSkippedAt?.toISOString() || null,
      isComplete: updated.onboardingCompletedAt !== null || updated.onboardingSkippedAt !== null,
    }

    return apiSuccess(status, action === 'complete' ? 'Onboarding completed!' : undefined)
  } catch (error) {
    console.error('[Onboarding] Failed to update:', error)
    return apiError('Failed to update onboarding', 500)
  }
}
