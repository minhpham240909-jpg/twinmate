/**
 * Dashboard Loading State
 * Displays a skeleton UI while the dashboard is loading
 */

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="h-8 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            <div className="h-8 w-8 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Welcome Card Skeleton */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        </div>

        {/* Quick Actions Skeleton */}
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 h-24 animate-pulse"
            >
              <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-800 rounded-xl mb-2" />
              <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
            </div>
          ))}
        </div>

        {/* Stats Skeleton */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="h-5 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-4" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center">
                <div className="h-8 w-12 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mx-auto mb-1" />
                <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mx-auto" />
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
