'use client'

/**
 * KNOWLEDGE BASE
 *
 * View and manage all learning captures.
 * Features:
 * - Grid/list view of captures
 * - Filter by type, subject, tags
 * - Search functionality
 * - Favorite management
 * - Due for review indicator
 */

import { useState, useMemo, memo, useCallback } from 'react'
import {
  Search,
  Filter,
  Grid,
  List,
  FileText,
  Camera,
  Link2,
  Highlighter,
  Mic,
  Star,
  Clock,
  ChevronDown,
  X,
  MoreHorizontal,
  Trash2,
  Edit2,
  Archive,
  Loader2,
} from 'lucide-react'
import type { Capture, CaptureType } from '@/hooks/useCaptures'

interface KnowledgeBaseProps {
  captures: Capture[]
  total: number
  isLoading: boolean
  onLoadMore: () => void
  hasMore: boolean
  onToggleFavorite: (id: string, isFavorite: boolean) => Promise<boolean>
  onDelete?: (id: string) => Promise<boolean>
  onEdit?: (capture: Capture) => void
  onReview?: (capture: Capture) => void
}

const TYPE_ICONS: Record<CaptureType, typeof FileText> = {
  NOTE: FileText,
  PHOTO: Camera,
  LINK: Link2,
  HIGHLIGHT: Highlighter,
  VOICE: Mic,
}

const TYPE_COLORS: Record<CaptureType, string> = {
  NOTE: 'blue',
  PHOTO: 'purple',
  LINK: 'green',
  HIGHLIGHT: 'yellow',
  VOICE: 'red',
}

// Single capture card
const CaptureCard = memo(function CaptureCard({
  capture,
  onToggleFavorite,
  onDelete,
  onEdit,
  onReview,
  view,
}: {
  capture: Capture
  onToggleFavorite: (id: string, isFavorite: boolean) => Promise<boolean>
  onDelete?: (id: string) => Promise<boolean>
  onEdit?: (capture: Capture) => void
  onReview?: (capture: Capture) => void
  view: 'grid' | 'list'
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const Icon = TYPE_ICONS[capture.type]
  const color = TYPE_COLORS[capture.type]
  const isDueForReview = capture.nextReviewAt && new Date(capture.nextReviewAt) <= new Date()

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return
    setIsDeleting(true)
    await onDelete(capture.id)
    setIsDeleting(false)
    setShowMenu(false)
  }

  const handleFavorite = async () => {
    await onToggleFavorite(capture.id, !capture.isFavorite)
  }

  if (view === 'list') {
    return (
      <div className="flex items-center gap-4 p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
        {/* Type icon */}
        <div className={`p-2 rounded-lg bg-${color}-50 dark:bg-${color}-950/30`}>
          <Icon className={`w-5 h-5 text-${color}-600 dark:text-${color}-400`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {capture.title && (
              <h3 className="font-medium text-neutral-900 dark:text-white truncate">
                {capture.title}
              </h3>
            )}
            {isDueForReview && (
              <span className="shrink-0 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                Review
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-1">
            {capture.content}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
            {capture.subject && <span>{capture.subject}</span>}
            <span>{new Date(capture.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isDueForReview && onReview && (
            <button
              onClick={() => onReview(capture)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Review
            </button>
          )}
          <button
            onClick={handleFavorite}
            className={`p-2 rounded-lg transition-colors ${
              capture.isFavorite
                ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/30'
                : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Star className="w-5 h-5" fill={capture.isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    )
  }

  // Grid view
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg bg-${color}-50 dark:bg-${color}-950/30`}>
            <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
          </div>
          <span className="text-xs text-neutral-500">{capture.type}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleFavorite}
            className={`p-1.5 rounded-lg transition-colors ${
              capture.isFavorite
                ? 'text-yellow-500'
                : 'text-neutral-400 hover:text-yellow-500'
            }`}
          >
            <Star className="w-4 h-4" fill={capture.isFavorite ? 'currentColor' : 'none'} />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-lg"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 z-20">
                  {onEdit && (
                    <button
                      onClick={() => { onEdit(capture); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {capture.title && (
          <h3 className="font-medium text-neutral-900 dark:text-white mb-1 line-clamp-1">
            {capture.title}
          </h3>
        )}
        <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3">
          {capture.content}
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        {/* Tags */}
        {capture.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {capture.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs rounded-md"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            {new Date(capture.createdAt).toLocaleDateString()}
          </span>
          {isDueForReview && onReview && (
            <button
              onClick={() => onReview(capture)}
              className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
            >
              <Clock className="w-3 h-3" />
              Review
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

export const KnowledgeBase = memo(function KnowledgeBase({
  captures,
  total,
  isLoading,
  onLoadMore,
  hasMore,
  onToggleFavorite,
  onDelete,
  onEdit,
  onReview,
}: KnowledgeBaseProps) {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<CaptureType | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Filter captures
  const filteredCaptures = useMemo(() => {
    let result = captures

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter((c) => c.type === typeFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (c) =>
          c.content.toLowerCase().includes(query) ||
          c.title?.toLowerCase().includes(query) ||
          c.tags.some((t) => t.toLowerCase().includes(query))
      )
    }

    return result
  }, [captures, typeFilter, searchQuery])

  if (isLoading && captures.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search captures..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md"
            >
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl transition-colors ${
            typeFilter !== 'all'
              ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
              : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm">Filter</span>
          {typeFilter !== 'all' && (
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </button>

        {/* View toggle */}
        <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
          <button
            onClick={() => setView('grid')}
            className={`p-2 rounded-lg transition-colors ${
              view === 'grid'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`p-2 rounded-lg transition-colors ${
              view === 'list'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter options */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              typeFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600'
            }`}
          >
            All
          </button>
          {(['NOTE', 'HIGHLIGHT', 'LINK', 'PHOTO', 'VOICE'] as CaptureType[]).map((type) => {
            const Icon = TYPE_ICONS[type]
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  typeFilter === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </button>
            )
          })}
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          {filteredCaptures.length} capture{filteredCaptures.length !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
        </span>
        <span>{total} total</span>
      </div>

      {/* Captures grid/list */}
      {filteredCaptures.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-700 mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-1">
            No captures found
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400">
            {searchQuery
              ? 'Try a different search term'
              : 'Start capturing your learning to build your knowledge base'}
          </p>
        </div>
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
          {filteredCaptures.map((capture) => (
            <CaptureCard
              key={capture.id}
              capture={capture}
              onToggleFavorite={onToggleFavorite}
              onDelete={onDelete}
              onEdit={onEdit}
              onReview={onReview}
              view={view}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="text-center pt-4">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="px-6 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              'Load more'
            )}
          </button>
        </div>
      )}
    </div>
  )
})
