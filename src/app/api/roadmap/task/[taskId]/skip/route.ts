/**
 * SKIP TASK API
 *
 * POST /api/roadmap/task/[taskId]/skip - Skip a micro-task
 *
 * Changes task status to SKIPPED. User can skip tasks they find
 * irrelevant or already know, but this is tracked for later analysis.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { MicroTaskStatus, RoadmapStepStatus } from '@prisma/client'
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
        step: {
          include: {
            roadmap: true,
            microTasks: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found or access denied' },
        { status: 404 }
      )
    }

    // Validate task can be skipped
    if (task.status === MicroTaskStatus.COMPLETED || task.status === MicroTaskStatus.SKIPPED) {
      return NextResponse.json(
        { error: `Cannot skip task with status: ${task.status}` },
        { status: 400 }
      )
    }

    // Use transaction to update task and potentially step
    const result = await prisma.$transaction(async (tx) => {
      // Update task status
      const updatedTask = await tx.microTask.update({
        where: { id: taskId },
        data: {
          status: MicroTaskStatus.SKIPPED,
        },
      })

      // Check if all tasks in step are complete (completed or skipped)
      const allTasks = task.step.microTasks
      const otherTasks = allTasks.filter(t => t.id !== taskId)
      const allComplete = otherTasks.every(
        t => t.status === MicroTaskStatus.COMPLETED || t.status === MicroTaskStatus.SKIPPED
      )

      let stepCompleted = false

      if (allComplete && allTasks.length > 0) {
        // All tasks complete/skipped - mark step as completed
        await tx.roadmapStep.update({
          where: { id: task.stepId },
          data: {
            status: RoadmapStepStatus.COMPLETED,
            completedAt: new Date(),
          },
        })

        // Find and unlock next step
        const nextStep = await tx.roadmapStep.findFirst({
          where: {
            roadmapId: task.step.roadmapId,
            order: task.step.order + 1,
            status: RoadmapStepStatus.LOCKED,
          },
        })

        if (nextStep) {
          await tx.roadmapStep.update({
            where: { id: nextStep.id },
            data: {
              status: RoadmapStepStatus.CURRENT,
              startedAt: new Date(),
            },
          })
        }

        // Update roadmap progress
        await tx.learningRoadmap.update({
          where: { id: task.step.roadmapId },
          data: {
            completedSteps: { increment: 1 },
            currentStepIndex: nextStep ? task.step.order + 1 : task.step.order,
            lastActivityAt: new Date(),
          },
        })

        stepCompleted = true
      }

      return { updatedTask, stepCompleted }
    })

    log.info('Task skipped', {
      taskId,
      stepId: task.stepId,
      userId: user.id,
      stepCompleted: result.stepCompleted,
    })

    return NextResponse.json({
      success: true,
      task: {
        id: result.updatedTask.id,
        status: result.updatedTask.status,
      },
      stepCompleted: result.stepCompleted,
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to skip task', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to skip task' },
      { status: 500 }
    )
  }
}
