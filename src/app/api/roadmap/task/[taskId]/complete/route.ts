/**
 * COMPLETE TASK API
 *
 * POST /api/roadmap/task/[taskId]/complete - Complete a micro-task
 *
 * Changes task status to COMPLETED, optionally stores proof.
 * Also checks if all tasks in the step are complete and updates step status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { MicroTaskStatus, RoadmapStepStatus } from '@prisma/client'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

interface CompleteTaskRequest {
  proof?: string
}

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
    const body = await request.json().catch(() => ({})) as CompleteTaskRequest

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

    // Validate task can be completed
    if (task.status !== MicroTaskStatus.IN_PROGRESS && task.status !== MicroTaskStatus.PENDING) {
      return NextResponse.json(
        { error: `Cannot complete task with status: ${task.status}` },
        { status: 400 }
      )
    }

    // Validate proof if required
    if (task.proofRequired && !body.proof?.trim()) {
      return NextResponse.json(
        { error: 'Proof is required for this task' },
        { status: 400 }
      )
    }

    // Use transaction to update task and potentially step
    const result = await prisma.$transaction(async (tx) => {
      // Update task status
      const updatedTask = await tx.microTask.update({
        where: { id: taskId },
        data: {
          status: MicroTaskStatus.COMPLETED,
          completedAt: new Date(),
        },
      })

      // Check if all tasks in step are complete
      const allTasks = task.step.microTasks
      const otherTasks = allTasks.filter(t => t.id !== taskId)
      const allComplete = otherTasks.every(
        t => t.status === MicroTaskStatus.COMPLETED || t.status === MicroTaskStatus.SKIPPED
      )

      let stepCompleted = false

      if (allComplete && allTasks.length > 0) {
        // All tasks complete - mark step as completed
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

    log.info('Task completed', {
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
        completedAt: result.updatedTask.completedAt?.toISOString(),
      },
      stepCompleted: result.stepCompleted,
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to complete task', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to complete task' },
      { status: 500 }
    )
  }
}
