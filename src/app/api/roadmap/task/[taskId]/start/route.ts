/**
 * START TASK API
 *
 * POST /api/roadmap/task/[taskId]/start - Start a micro-task
 *
 * Changes task status from PENDING to IN_PROGRESS.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { MicroTaskStatus } from '@prisma/client'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
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

    const { taskId } = await params

    // Verify user owns this task's roadmap
    const task = await prisma.microTask.findFirst({
      where: {
        id: taskId,
        step: {
          roadmap: {
            userId: user.id,
          },
        },
      },
      include: {
        step: true,
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found or access denied' },
        { status: 404 }
      )
    }

    // Validate task can be started
    if (task.status !== MicroTaskStatus.PENDING) {
      return NextResponse.json(
        { error: `Cannot start task with status: ${task.status}` },
        { status: 400 }
      )
    }

    // Update task status
    const updatedTask = await prisma.microTask.update({
      where: { id: taskId },
      data: {
        status: MicroTaskStatus.IN_PROGRESS,
        attempts: { increment: 1 },
      },
    })

    log.info('Task started', {
      taskId,
      stepId: task.stepId,
      userId: user.id,
    })

    return NextResponse.json({
      success: true,
      task: {
        id: updatedTask.id,
        status: updatedTask.status,
        attempts: updatedTask.attempts,
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to start task', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to start task' },
      { status: 500 }
    )
  }
}
