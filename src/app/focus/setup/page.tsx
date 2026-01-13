'use client'

/**
 * Focus Setup Page - AI-Guided Task Configuration
 *
 * Allows users to configure their AI-guided focus session:
 * - Choose subject (from profile or custom input)
 * - Select task type (question, problem, writing, reading, coding)
 * - Pick difficulty level
 * - Preview generated task before starting
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Brain,
  ArrowLeft,
  Sparkles,
  BookOpen,
  Calculator,
  PenTool,
  Code2,
  FileText,
  Shuffle,
  Clock,
  ChevronRight,
  Loader2,
  RefreshCw
} from 'lucide-react'

type TaskType = 'question' | 'problem' | 'writing' | 'reading' | 'coding' | 'random'
type Difficulty = 'easy' | 'medium' | 'hard'

interface GeneratedTask {
  task: string
  taskType: string
  estimatedMinutes: number
}

const TASK_TYPES: { id: TaskType; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'question', label: 'Question', icon: <BookOpen className="w-5 h-5" />, description: 'Answer a thought-provoking question' },
  { id: 'problem', label: 'Problem', icon: <Calculator className="w-5 h-5" />, description: 'Solve a challenging problem' },
  { id: 'writing', label: 'Writing', icon: <PenTool className="w-5 h-5" />, description: 'Write a short response or essay' },
  { id: 'reading', label: 'Reading', icon: <FileText className="w-5 h-5" />, description: 'Analyze a passage or concept' },
  { id: 'coding', label: 'Coding', icon: <Code2 className="w-5 h-5" />, description: 'Write or debug code' },
  { id: 'random', label: 'Surprise Me', icon: <Shuffle className="w-5 h-5" />, description: 'Get a random task type' },
]

const DIFFICULTIES: { id: Difficulty; label: string; description: string; color: string }[] = [
  { id: 'easy', label: 'Easy', description: 'Foundational concepts', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  { id: 'medium', label: 'Medium', description: 'Applied knowledge', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
  { id: 'hard', label: 'Hard', description: 'Complex challenges', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
]

export default function FocusSetupPage() {
  const router = useRouter()

  // Form state
  const [subject, setSubject] = useState('')
  const [customSubject, setCustomSubject] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('random')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [duration, setDuration] = useState(5)

  // UI state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedTask, setGeneratedTask] = useState<GeneratedTask | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Suggested subjects from user's profile (could be fetched from API)
  const [suggestedSubjects] = useState([
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'Computer Science',
    'History',
    'Literature',
    'Economics',
  ])

  // Selected subject (either from suggestions or custom)
  const selectedSubject = customSubject || subject

  // Generate AI task
  const handleGenerateTask = async () => {
    if (!selectedSubject.trim()) {
      setError('Please enter a subject')
      return
    }

    setError(null)
    setIsGenerating(true)
    setGeneratedTask(null)

    try {
      const response = await fetch('/api/focus/generate-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedSubject.trim(),
          taskType,
          difficulty,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate task')
      }

      const data = await response.json()
      setGeneratedTask(data)
      setDuration(data.estimatedMinutes || 5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate task')
    } finally {
      setIsGenerating(false)
    }
  }

  // Start focus session with generated task
  const handleStartSession = async () => {
    if (!generatedTask) return

    setIsStarting(true)
    setError(null)

    try {
      // Create the session with AI task data
      const response = await fetch('/api/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMinutes: duration,
          mode: 'ai_guided',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to start session')
      }

      const data = await response.json()
      const sessionId = data.session.id

      // Update session with task details
      await fetch(`/api/focus/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: generatedTask.taskType,
          taskSubject: selectedSubject,
          taskPrompt: generatedTask.task,
          taskDifficulty: difficulty,
        }),
      })

      // Navigate to timer page
      router.push(`/focus/${sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session')
      setIsStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-neutral-800">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <span className="font-medium">AI-Guided Focus</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Step 1: Subject Selection */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center text-sm font-bold">1</span>
            What do you want to study?
          </h2>

          {/* Suggested subjects */}
          <div className="flex flex-wrap gap-2 mb-4">
            {suggestedSubjects.map((s) => (
              <button
                key={s}
                onClick={() => { setSubject(s); setCustomSubject(''); }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  subject === s && !customSubject
                    ? 'bg-purple-500 text-white'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Custom subject input */}
          <div className="relative">
            <input
              type="text"
              value={customSubject}
              onChange={(e) => { setCustomSubject(e.target.value); setSubject(''); }}
              placeholder="Or type your own subject..."
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {customSubject && (
              <button
                onClick={() => setCustomSubject('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                &times;
              </button>
            )}
          </div>
        </section>

        {/* Step 2: Task Type */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center text-sm font-bold">2</span>
            What type of task?
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TASK_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setTaskType(type.id)}
                className={`p-4 rounded-xl border transition-all ${
                  taskType === type.id
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                    : 'bg-neutral-800/50 border-neutral-700 hover:border-neutral-600 text-neutral-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${
                  taskType === type.id ? 'bg-purple-500/30' : 'bg-neutral-700'
                }`}>
                  {type.icon}
                </div>
                <div className="font-medium text-sm">{type.label}</div>
                <div className="text-xs text-neutral-500 mt-1">{type.description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Step 3: Difficulty */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            Difficulty level
          </h2>

          <div className="flex gap-3">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                className={`flex-1 p-4 rounded-xl border transition-all ${
                  difficulty === d.id
                    ? d.color + ' border-2'
                    : 'bg-neutral-800/50 border-neutral-700 hover:border-neutral-600'
                }`}
              >
                <div className="font-medium">{d.label}</div>
                <div className="text-xs text-neutral-500 mt-1">{d.description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Generate Button */}
        {!generatedTask && (
          <button
            onClick={handleGenerateTask}
            disabled={!selectedSubject.trim() || isGenerating}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg shadow-purple-500/25"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating your task...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Task
              </>
            )}
          </button>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Generated Task Preview */}
        {generatedTask && (
          <section className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  Your Task
                </h3>
                <button
                  onClick={handleGenerateTask}
                  disabled={isGenerating}
                  className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
              </div>

              <p className="text-white text-base leading-relaxed mb-6">
                {generatedTask.task}
              </p>

              <div className="flex items-center justify-between text-sm text-neutral-400 mb-6">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {duration} minutes
                </span>
                <span className="capitalize">{generatedTask.taskType} task</span>
              </div>

              {/* Duration Adjustment */}
              <div className="mb-6">
                <label className="text-sm text-neutral-400 mb-2 block">Adjust duration</label>
                <div className="flex items-center gap-2">
                  {[3, 5, 7, 10, 15].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setDuration(mins)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        duration === mins
                          ? 'bg-purple-500 text-white'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartSession}
                disabled={isStarting}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-neutral-700 disabled:to-neutral-700 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg shadow-orange-500/25 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    Start Focus Session
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
