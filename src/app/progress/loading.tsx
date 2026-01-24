/**
 * Progress Page Loading State
 * Displays a skeleton UI while progress data is loading
 */

export default function ProgressLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
            <div className="h-6 w-28 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Weekly Activity Chart Skeleton */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-5 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            <div className="h-4 w-28 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
          <div className="flex items-end justify-between gap-2 h-32 mb-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-t-md animate-pulse"
                  style={{ height: `${Math.random() * 60 + 20}%` }}
                />
                <div className="h-3 w-6 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 w-5 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
              <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Streak Card Skeleton */}
        <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-2" />
              <div className="h-10 w-20 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            </div>
            <div className="h-12 w-12 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Topics Section Skeleton */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="h-5 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-6 w-6 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
