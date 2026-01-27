/**
 * Chat Loading State
 * Displays a skeleton UI while the chat page is loading
 */

export default function ChatLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            <div className="h-6 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
        </div>
      </header>

      {/* Chat Content Skeleton */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-24">
        {/* Conversation List */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800"
          >
            <div className="h-12 w-12 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-3 w-12 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
              <div className="h-3 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </main>

      {/* Bottom Nav Skeleton */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 px-4 py-2 z-50">
        <div className="max-w-2xl mx-auto flex justify-around">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1 p-2">
              <div className="h-6 w-6 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="h-2 w-8 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </nav>
    </div>
  )
}
