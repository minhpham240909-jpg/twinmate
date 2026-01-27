'use client'

/**
 * ROADMAP LIST PANEL
 *
 * Displays all user's saved roadmaps with:
 * - Status tabs (All, Active, Paused, Completed)
 * - Search functionality
 * - Actions: activate, archive, delete
 * - Progress indicators
 */

import { useEffect, useState } from 'react'
import {
  Play,
  Pause,
  Trash2,
  Search,
  Clock,
  Target,
  CheckCircle2,
  Archive,
  MoreHorizontal,
  Loader2,
  FolderOpen,
  AlertCircle,
} from 'lucide-react'
import { useRoadmapList, RoadmapSummary } from '@/hooks/useRoadmapList'

// ============================================
// TYPES
// ============================================

interface RoadmapListPanelProps {
  onRoadmapSelect?: (roadmap: RoadmapSummary) => void
  onRoadmapActivate?: (roadmap: RoadmapSummary) => void
  showHeader?: boolean
  maxHeight?: string
}

type StatusTab = 'all' | 'active' | 'paused' | 'completed'

// ============================================
// STATUS BADGE COMPONENT
// ============================================

function StatusBadge({ status, isActive }: { status: string; isActive: boolean }) {
  if (isActive && status !== 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Active
      </span>
    )
  }

  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>
      )
    case 'paused':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          <Pause className="w-3 h-3" />
          Saved
        </span>
      )
    default:
      return null
  }
}

// ============================================
// PROGRESS BAR COMPONENT
// ============================================

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${
          percentage === 100
            ? 'bg-green-500'
            : percentage > 50
            ? 'bg-blue-500'
            : 'bg-orange-500'
        }`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

// ============================================
// ROADMAP CARD COMPONENT
// ============================================

function RoadmapCard({
  roadmap,
  onActivate,
  onArchive,
  onDelete,
  onSelect,
}: {
  roadmap: RoadmapSummary
  onActivate: () => void
  onArchive: () => void
  onDelete: () => void
  onSelect?: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete()
      setConfirmDelete(false)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000) // Reset after 3s
    }
  }

  return (
    <div
      className={`
        group relative p-4 rounded-lg border transition-all
        ${roadmap.isActive
          ? 'border-green-500/50 bg-green-50/50 dark:bg-green-900/10'
          : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0" onClick={onSelect} role={onSelect ? 'button' : undefined}>
          <h3 className="font-medium text-neutral-900 dark:text-neutral-100 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            {roadmap.title}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-1">
            {roadmap.goal}
          </p>
        </div>
        <StatusBadge status={roadmap.status} isActive={roadmap.isActive} />
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
          <span>{roadmap.progress.completed} of {roadmap.progress.total} steps</span>
          <span>{roadmap.progress.percentage}%</span>
        </div>
        <ProgressBar percentage={roadmap.progress.percentage} />
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 mb-3">
        {roadmap.subject && (
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3" />
            {roadmap.subject}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {Math.round(roadmap.time.spent / 60)}h / {Math.round(roadmap.time.estimated / 60)}h
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {!roadmap.isActive && roadmap.status !== 'completed' && (
          <button
            onClick={onActivate}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors"
          >
            <Play className="w-3 h-3" />
            Resume
          </button>
        )}

        {roadmap.isActive && roadmap.status !== 'completed' && (
          <button
            onClick={onArchive}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50 transition-colors"
          >
            <Archive className="w-3 h-3" />
            Save for Later
          </button>
        )}

        {/* More actions menu */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-700 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-1 w-36 py-1 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 z-20">
                <button
                  onClick={() => {
                    handleDelete()
                    if (!confirmDelete) setShowMenu(false)
                  }}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                    ${confirmDelete
                      ? 'text-red-600 bg-red-50 dark:bg-red-900/20 font-medium'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }
                  `}
                >
                  <Trash2 className="w-4 h-4" />
                  {confirmDelete ? 'Click to confirm' : 'Delete'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// EMPTY STATE COMPONENT
// ============================================

function EmptyState({ status, search }: { status: StatusTab; search: string }) {
  if (search) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mb-3" />
        <h3 className="text-lg font-medium text-neutral-600 dark:text-neutral-400 mb-1">
          No roadmaps found
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-500">
          No roadmaps match &ldquo;{search}&rdquo;
        </p>
      </div>
    )
  }

  const messages: Record<StatusTab, { title: string; description: string }> = {
    all: {
      title: 'No roadmaps yet',
      description: 'Start your learning journey by creating your first roadmap!',
    },
    active: {
      title: 'No active roadmaps',
      description: 'Resume a saved roadmap or create a new one to get started.',
    },
    paused: {
      title: 'No saved roadmaps',
      description: 'Roadmaps you save for later will appear here.',
    },
    completed: {
      title: 'No completed roadmaps',
      description: 'Complete a roadmap to see it here!',
    },
  }

  const { title, description } = messages[status]

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FolderOpen className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mb-3" />
      <h3 className="text-lg font-medium text-neutral-600 dark:text-neutral-400 mb-1">
        {title}
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-500">
        {description}
      </p>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RoadmapListPanel({
  onRoadmapSelect,
  onRoadmapActivate,
  showHeader = true,
  maxHeight = '500px',
}: RoadmapListPanelProps) {
  const [activeTab, setActiveTab] = useState<StatusTab>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const {
    roadmaps,
    loading,
    error,
    fetchRoadmaps,
    activateRoadmap,
    archiveRoadmap,
    deleteRoadmap,
    clearError,
  } = useRoadmapList()

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchRoadmaps({
      status: activeTab,
      search: searchQuery || undefined,
      sortBy: 'recent',
    })
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoadmaps({
        status: activeTab,
        search: searchQuery || undefined,
        sortBy: 'recent',
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleActivate = async (roadmap: RoadmapSummary) => {
    try {
      await activateRoadmap(roadmap.id)
      onRoadmapActivate?.(roadmap)
    } catch {
      // Error is handled by the hook
    }
  }

  const handleArchive = async (roadmap: RoadmapSummary) => {
    try {
      await archiveRoadmap(roadmap.id)
    } catch {
      // Error is handled by the hook
    }
  }

  const handleDelete = async (roadmap: RoadmapSummary) => {
    try {
      await deleteRoadmap(roadmap.id)
    } catch {
      // Error is handled by the hook
    }
  }

  // Count roadmaps by status
  const counts = {
    all: roadmaps.length,
    active: roadmaps.filter(r => r.isActive || r.status === 'active').length,
    paused: roadmaps.filter(r => r.status === 'paused').length,
    completed: roadmaps.filter(r => r.status === 'completed').length,
  }

  const tabs: { id: StatusTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'paused', label: 'Saved' },
    { id: 'completed', label: 'Completed' },
  ]

  return (
    <div className="flex flex-col">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            My Roadmaps
          </h2>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {counts.all} total
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Search roadmaps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all
              ${activeTab === tab.id
                ? 'bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }
            `}
          >
            {tab.label}
            {counts[tab.id] > 0 && (
              <span className="ml-1 text-neutral-400">({counts[tab.id]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button
            onClick={clearError}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* List */}
      <div
        className="space-y-3 overflow-y-auto"
        style={{ maxHeight }}
      >
        {loading && roadmaps.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
          </div>
        ) : roadmaps.length === 0 ? (
          <EmptyState status={activeTab} search={searchQuery} />
        ) : (
          roadmaps.map((roadmap) => (
            <RoadmapCard
              key={roadmap.id}
              roadmap={roadmap}
              onActivate={() => handleActivate(roadmap)}
              onArchive={() => handleArchive(roadmap)}
              onDelete={() => handleDelete(roadmap)}
              onSelect={onRoadmapSelect ? () => onRoadmapSelect(roadmap) : undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default RoadmapListPanel
