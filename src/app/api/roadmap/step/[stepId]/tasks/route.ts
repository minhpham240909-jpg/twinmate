/**
 * STEP TASKS API
 *
 * GET /api/roadmap/step/[stepId]/tasks - Get all micro-tasks for a step
 *
 * Returns tasks sorted by order with their current status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { stepId } = await params

    // Verify user owns this step's roadmap
    const step = await prisma.roadmapStep.findFirst({
      where: {
        id: stepId,
        roadmap: {
          userId: user.id,
        },
      },
      include: {
        microTasks: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!step) {
      return NextResponse.json(
        { error: 'Step not found or access denied' },
        { status: 404 }
      )
    }

    // Transform tasks for response
    const tasks = step.microTasks.map(task => ({
      id: task.id,
      order: task.order,
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      duration: task.duration,
      verificationMethod: task.verificationMethod,
      proofRequired: task.proofRequired,
      status: task.status,
      completedAt: task.completedAt?.toISOString(),
      attempts: task.attempts,
    }))

    return NextResponse.json({
      success: true,
      stepId,
      tasks,
      meta: {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'COMPLETED' || t.status === 'SKIPPED').length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to get step tasks', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get tasks' },
      { status: 500 }
    )
  }
}
