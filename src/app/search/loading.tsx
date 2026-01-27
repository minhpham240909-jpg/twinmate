/**
 * Search Loading State
 * Displays a skeleton UI while the search page is loading
 */

export default function SearchLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            <div className="flex-1 h-10 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
          </div>
        </div>
      </header>

      {/* Search Content Skeleton */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Recent Searches */}
        <div>
          <div className="h-4 w-28 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-3" />
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-8 w-20 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse"
              />
            ))}
          </div>
        </div>

        {/* Trending Topics */}
        <div>
          <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800"
              >
                <div className="h-5 w-5 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div>
          <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800"
              >
                <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
                <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
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
