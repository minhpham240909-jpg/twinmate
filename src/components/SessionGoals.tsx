'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Sparkles } from 'lucide-react'
import { useAIAgent } from '@/hooks/useAIAgent'

interface Goal {
  id: string
  title: string
  description: string | null
  isCompleted: boolean
  order: number
}

interface SessionGoalsProps {
  sessionId: string
  goals: Goal[]
  onGoalsUpdate: () => void
}

export default function SessionGoals({ sessionId, goals, onGoalsUpdate }: SessionGoalsProps) {
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newGoalDescription, setNewGoalDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const { openPanel, Panel } = useAIAgent()

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newGoalTitle.trim() || creating) return

    setCreating(true)

    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newGoalTitle,
          description: newGoalDescription || null,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Goal added!')
        setNewGoalTitle('')
        setNewGoalDescription('')
        setShowAddGoal(false)
        onGoalsUpdate()
      } else {
        toast.error(data.error || 'Failed to create goal')
      }
    } catch (error) {
      console.error('Error creating goal:', error)
      toast.error('Failed to create goal')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleGoal = async (goalId: string) => {
    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/goals/${goalId}`, {
        method: 'PATCH',
      })

      const data = await res.json()

      if (data.success) {
        toast.success(data.goal.isCompleted ? 'Goal completed! 🎉' : 'Goal reopened')
        onGoalsUpdate()
      } else {
        toast.error(data.error || 'Failed to update goal')
      }
    } catch (error) {
      console.error('Error updating goal:', error)
      toast.error('Failed to update goal')
    }
  }

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return

    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/goals/${goalId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Goal deleted')
        onGoalsUpdate()
      } else {
        toast.error(data.error || 'Failed to delete goal')
      }
    } catch (error) {
      console.error('Error deleting goal:', error)
      toast.error('Failed to delete goal')
    }
  }

  return (
    <div>
      {Panel}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Study Goals</h3>
        <div className="flex gap-2">
          <button
            onClick={() => openPanel('Help me create study goals for this session')}
            className="px-3 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm rounded-lg hover:from-purple-700 hover:to-blue-700 transition flex items-center gap-1"
            title="AI: Suggest goals"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Suggest
          </button>
          <button
            onClick={() => setShowAddGoal(!showAddGoal)}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
          >
            {showAddGoal ? 'Cancel' : '+ Add Goal'}
          </button>
        </div>
      </div>

      {/* Add Goal Form */}
      {showAddGoal && (
        <form onSubmit={handleCreateGoal} className="mb-4 p-4 bg-gray-50 rounded-lg">
          <input
            type="text"
            value={newGoalTitle}
            onChange={(e) => setNewGoalTitle(e.target.value)}
            placeholder="Goal title..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            required
          />
          <textarea
            value={newGoalDescription}
            onChange={(e) => setNewGoalDescription(e.target.value)}
            placeholder="Description (optional)..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={!newGoalTitle.trim() || creating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {creating ? 'Adding...' : 'Add Goal'}
          </button>
        </form>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <p>📝 No goals set yet</p>
          <p className="text-sm mt-2">Add goals to track your progress</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className={`p-4 border rounded-lg ${
                goal.isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={goal.isCompleted}
                  onChange={() => handleToggleGoal(goal.id)}
                  className="mt-1 w-5 h-5 cursor-pointer"
                />
                <div className="flex-1">
                  <h4
                    className={`font-medium ${
                      goal.isCompleted ? 'line-through text-gray-500' : 'text-gray-900'
                    }`}
                  >
                    {goal.title}
                  </h4>
                  {goal.description && (
                    <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteGoal(goal.id)}
                  className="text-red-600 hover:text-red-700 text-sm"
                  title="Delete goal"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
