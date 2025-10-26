'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Clock, CheckCircle2, Circle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'

interface Task {
  title: string
  etaMin: number
  link?: string
  completed: boolean
}

interface WeekBlock {
  week: number
  focus?: string
  tasks: Task[]
}

interface StudyPlanViewProps {
  planId: string
  title: string
  weekBlocks: WeekBlock[]
  onTaskToggle?: (weekIndex: number, taskIndex: number) => void
}

export default function StudyPlanView({
  planId,
  title,
  weekBlocks,
  onTaskToggle,
}: StudyPlanViewProps) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([0])) // Expand first week by default

  const toggleWeek = (weekIndex: number) => {
    const newExpanded = new Set(expandedWeeks)
    if (newExpanded.has(weekIndex)) {
      newExpanded.delete(weekIndex)
    } else {
      newExpanded.add(weekIndex)
    }
    setExpandedWeeks(newExpanded)
  }

  const getWeekProgress = (week: WeekBlock) => {
    const completedCount = week.tasks.filter(t => t.completed).length
    return (completedCount / week.tasks.length) * 100
  }

  const getTotalTimeForWeek = (week: WeekBlock) => {
    return week.tasks.reduce((sum, task) => sum + task.etaMin, 0)
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  const overallProgress = () => {
    const totalTasks = weekBlocks.reduce((sum, week) => sum + week.tasks.length, 0)
    const completedTasks = weekBlocks.reduce(
      (sum, week) => sum + week.tasks.filter(t => t.completed).length,
      0
    )
    return (completedTasks / totalTasks) * 100
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">{weekBlocks.length} weeks • {planId.slice(0, 8)}</p>
          </div>
        </div>

        {/* Overall Progress */}
        <div>
          <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
            <span>Overall Progress</span>
            <span className="font-semibold">{Math.round(overallProgress())}%</span>
          </div>
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress()}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-purple-600 to-indigo-600"
            />
          </div>
        </div>
      </div>

      {/* Week Blocks */}
      <div className="space-y-4">
        {weekBlocks.map((week, weekIdx) => {
          const isExpanded = expandedWeeks.has(weekIdx)
          const progress = getWeekProgress(week)
          const totalTime = getTotalTimeForWeek(week)

          return (
            <motion.div
              key={weekIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: weekIdx * 0.05 }}
              className="border border-slate-200 rounded-xl overflow-hidden"
            >
              {/* Week Header */}
              <button
                onClick={() => toggleWeek(weekIdx)}
                className="w-full p-5 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  )}

                  <div className="text-left">
                    <h3 className="font-semibold text-slate-900">Week {week.week}</h3>
                    {week.focus && (
                      <p className="text-sm text-slate-600 mt-1">{week.focus}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <p className="text-slate-600">{formatDuration(totalTime)}</p>
                    <p className="text-slate-500">{week.tasks.length} tasks</p>
                  </div>

                  <div className="w-16 h-16">
                    <svg className="transform -rotate-90 w-16 h-16">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        className="text-slate-200"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                        className="text-purple-600 transition-all duration-500"
                      />
                    </svg>
                    <div className="relative -mt-12 text-center">
                      <span className="text-xs font-semibold text-slate-700">
                        {Math.round(progress)}%
                      </span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Tasks */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="p-5 bg-white space-y-2 border-t border-slate-200">
                      {week.tasks.map((task, taskIdx) => (
                        <motion.div
                          key={taskIdx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: taskIdx * 0.05 }}
                          className="group"
                        >
                          <button
                            onClick={() => onTaskToggle?.(weekIdx, taskIdx)}
                            className={`w-full p-4 rounded-lg border-2 transition-all ${
                              task.completed
                                ? 'border-green-200 bg-green-50'
                                : 'border-slate-200 bg-white hover:border-purple-200 hover:bg-purple-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {task.completed ? (
                                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                              ) : (
                                <Circle className="w-6 h-6 text-slate-400 group-hover:text-purple-600 flex-shrink-0 transition-colors" />
                              )}

                              <div className="flex-1 text-left">
                                <p className={`font-medium ${
                                  task.completed ? 'text-green-900 line-through' : 'text-slate-900'
                                }`}>
                                  {task.title}
                                </p>
                                <div className="flex items-center gap-3 mt-1">
                                  <div className="flex items-center gap-1 text-sm text-slate-500">
                                    <Clock className="w-3.5 h-3.5" />
                                    {formatDuration(task.etaMin)}
                                  </div>
                                  {task.link && (
                                    <a
                                      href={task.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Resource
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
