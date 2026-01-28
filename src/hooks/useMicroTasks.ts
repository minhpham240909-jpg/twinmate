'use client'

/**
 * USE MICRO TASKS HOOK
 *
 * Manages micro-task state and operations for a roadmap step.
 * Handles starting, completing, and skipping tasks with optimistic updates.
 */

import { useState, useCallback, useMemo } from 'react'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'

// ============================================
// TYPES
// ============================================

export type MicroTaskType = 'ACTION' | 'LEARN' | 'PRACTICE' | 'TEST' | 'REFLECT'
export type MicroTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'

export interface MicroTask {
  id: string
  order: number
  title: string
  description: string
  taskType: MicroTaskType
  duration: number
  verificationMethod?: string
  proofRequired: boolean
  status: MicroTaskStatus
  completedAt?: string
  attempts: number
}

interface UseMicroTasksReturn {
  tasks: MicroTask[]
  isLoading: boolean
  loadingTaskId: string | null
  error: Error | null
  startTask: (taskId: string) => Promise<void>
  completeTask: (taskId: string, proof?: string) => Promise<void>
  skipTask: (taskId: string) => Promise<void>
  refetch: () => Promise<void>
  // Computed values
  currentTask: MicroTask | null
  completedCount: number
  totalCount: number
  progressPercentage: number
  isStepComplete: boolean
}

// ============================================
// HOOK
// ============================================

export function useMicroTasks(stepId: string): UseMicroTasksReturn {
  const queryClient = useQueryClient()
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null)

  // Fetch tasks for step
  const {
    data: tasks = [],
    isLoading,
    error,
    refetch,
  } = useQuery<MicroTask[], Error>({
    queryKey: ['microTasks', stepId],
    queryFn: async () => {
      const response = await fetch(`/api/roadmap/step/${stepId}/tasks`)
      if (!response.ok) {
        throw new Error('Failed to fetch tasks')
      }
      const data = await response.json()
      return data.tasks || []
    },
    enabled: !!stepId,
    staleTime: 30 * 1000, // 30 seconds
  })

  // Start task mutation
  const startMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/roadmap/task/${taskId}/start`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to start task')
      }
      return response.json()
    },
    onMutate: async (taskId) => {
      setLoadingTaskId(taskId)
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['microTasks', stepId] })
      const previousTasks = queryClient.getQueryData<MicroTask[]>(['microTasks', stepId])

      queryClient.setQueryData<MicroTask[]>(['microTasks', stepId], (old) =>
        old?.map((task) =>
          task.id === taskId ? { ...task, status: 'IN_PROGRESS' as MicroTaskStatus } : task
        )
      )

      return { previousTasks }
    },
    onError: (err, taskId, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['microTasks', stepId], context.previousTasks)
      }
    },
    onSettled: () => {
      setLoadingTaskId(null)
      queryClient.invalidateQueries({ queryKey: ['microTasks', stepId] })
    },
  })

  // Complete task mutation
  const completeMutation = useMutation({
    mutationFn: async ({ taskId, proof }: { taskId: string; proof?: string }) => {
      const response = await fetch(`/api/roadmap/task/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof }),
      })
      if (!response.ok) {
        throw new Error('Failed to complete task')
      }
      return response.json()
    },
    onMutate: async ({ taskId }) => {
      setLoadingTaskId(taskId)
      await queryClient.cancelQueries({ queryKey: ['microTasks', stepId] })
      const previousTasks = queryClient.getQueryData<MicroTask[]>(['microTasks', stepId])

      queryClient.setQueryData<MicroTask[]>(['microTasks', stepId], (old) =>
        old?.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: 'COMPLETED' as MicroTaskStatus,
                completedAt: new Date().toISOString(),
              }
            : task
        )
      )

      return { previousTasks }
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['microTasks', stepId], context.previousTasks)
      }
    },
    onSettled: () => {
      setLoadingTaskId(null)
      queryClient.invalidateQueries({ queryKey: ['microTasks', stepId] })
      // Also invalidate active roadmap to update step progress
      queryClient.invalidateQueries({ queryKey: ['activeRoadmap'] })
    },
  })

  // Skip task mutation
  const skipMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/roadmap/task/${taskId}/skip`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to skip task')
      }
      return response.json()
    },
    onMutate: async (taskId) => {
      setLoadingTaskId(taskId)
      await queryClient.cancelQueries({ queryKey: ['microTasks', stepId] })
      const previousTasks = queryClient.getQueryData<MicroTask[]>(['microTasks', stepId])

      queryClient.setQueryData<MicroTask[]>(['microTasks', stepId], (old) =>
        old?.map((task) =>
          task.id === taskId ? { ...task, status: 'SKIPPED' as MicroTaskStatus } : task
        )
      )

      return { previousTasks }
    },
    onError: (err, taskId, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['microTasks', stepId], context.previousTasks)
      }
    },
    onSettled: () => {
      setLoadingTaskId(null)
      queryClient.invalidateQueries({ queryKey: ['microTasks', stepId] })
    },
  })

  // Handlers
  const startTask = useCallback(
    async (taskId: string) => {
      await startMutation.mutateAsync(taskId)
    },
    [startMutation]
  )

  const completeTask = useCallback(
    async (taskId: string, proof?: string) => {
      await completeMutation.mutateAsync({ taskId, proof })
    },
    [completeMutation]
  )

  const skipTask = useCallback(
    async (taskId: string) => {
      await skipMutation.mutateAsync(taskId)
    },
    [skipMutation]
  )

  const handleRefetch = useCallback(async () => {
    await refetch()
  }, [refetch])

  // Computed values
  const currentTask = useMemo(() => {
    return tasks.find((t) => t.status === 'IN_PROGRESS') ||
           tasks.find((t) => t.status === 'PENDING') ||
           null
  }, [tasks])

  const completedCount = useMemo(() => {
    return tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'SKIPPED').length
  }, [tasks])

  const totalCount = tasks.length

  const progressPercentage = useMemo(() => {
    return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  }, [completedCount, totalCount])

  const isStepComplete = completedCount === totalCount && totalCount > 0

  return {
    tasks,
    isLoading,
    loadingTaskId,
    error: error || null,
    startTask,
    completeTask,
    skipTask,
    refetch: handleRefetch,
    currentTask,
    completedCount,
    totalCount,
    progressPercentage,
    isStepComplete,
  }
}

export default useMicroTasks
