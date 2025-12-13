'use client'

/**
 * ExpandableList - Reusable component for admin dashboard lists
 *
 * Features:
 * - Shows limited preview items (default 10)
 * - "View All (count)" button when more items exist
 * - Full-screen modal with search functionality
 * - Displays accurate total count
 */

import { useState, useMemo, ReactNode } from 'react'
import { Search, X, ChevronRight, List } from 'lucide-react'

interface ExpandableListProps<T> {
  // Data
  items: T[]

  // Display settings
  title: string
  icon?: ReactNode
  previewLimit?: number // Default 10

  // Render functions
  renderPreviewItem: (item: T, index: number) => ReactNode
  renderFullItem: (item: T, index: number) => ReactNode

  // Search configuration
  searchKeys: (keyof T)[] // Which fields to search in
  searchPlaceholder?: string

  // Optional: Empty state
  emptyMessage?: string
  emptyIcon?: ReactNode

  // Optional: Custom header for modal
  modalTitle?: string

  // Optional: Grid layout for modal (default is list)
  modalGridCols?: number // e.g., 2, 3, 4 for grid layout
}

export default function ExpandableList<T extends Record<string, any>>({
  items,
  title,
  icon,
  previewLimit = 10,
  renderPreviewItem,
  renderFullItem,
  searchKeys,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items found',
  emptyIcon,
  modalTitle,
  modalGridCols,
}: ExpandableListProps<T>) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Get preview items (limited)
  const previewItems = useMemo(() => {
    return items.slice(0, previewLimit)
  }, [items, previewLimit])

  // Check if there are more items than preview limit
  const hasMore = items.length > previewLimit
  const totalCount = items.length

  // Filter items based on search query (for modal)
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items

    const query = searchQuery.toLowerCase().trim()
    return items.filter(item => {
      return searchKeys.some(key => {
        const value = item[key]
        if (value === null || value === undefined) return false
        return String(value).toLowerCase().includes(query)
      })
    })
  }, [items, searchQuery, searchKeys])

  // Open modal
  const openModal = () => {
    setSearchQuery('')
    setIsModalOpen(true)
  }

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false)
    setSearchQuery('')
  }

  // Handle escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal()
    }
  }

  return (
    <>
      {/* Preview Section */}
      <div className="space-y-3">
        {/* Preview Items */}
        {previewItems.length > 0 ? (
          <>
            {previewItems.map((item, index) => (
              <div key={index}>
                {renderPreviewItem(item, index)}
              </div>
            ))}

            {/* View All Button */}
            {hasMore && (
              <button
                onClick={openModal}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg text-gray-300 hover:text-white transition-all group"
              >
                <List className="w-4 h-4" />
                <span>View All ({totalCount.toLocaleString()})</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {emptyIcon && <div className="mb-2">{emptyIcon}</div>}
            <p>{emptyMessage}</p>
          </div>
        )}
      </div>

      {/* Full List Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
          onKeyDown={handleKeyDown}
        >
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-4xl my-8 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700 shrink-0">
              <div className="flex items-center gap-3">
                {icon && <div className="text-blue-400">{icon}</div>}
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {modalTitle || title}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {totalCount.toLocaleString()} total items
                    {searchQuery && ` • ${filteredItems.length.toLocaleString()} matching "${searchQuery}"`}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-gray-700 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredItems.length > 0 ? (
                <div className={
                  modalGridCols
                    ? `grid gap-4 ${
                        modalGridCols === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                        modalGridCols === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                        modalGridCols === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' :
                        'grid-cols-1'
                      }`
                    : 'space-y-3'
                }>
                  {filteredItems.map((item, index) => (
                    <div key={index}>
                      {renderFullItem(item, index)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No items match &quot;{searchQuery}&quot;</p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Clear search
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-800/50 shrink-0">
              <p className="text-sm text-gray-400">
                Showing {filteredItems.length.toLocaleString()} of {totalCount.toLocaleString()} items
              </p>
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
