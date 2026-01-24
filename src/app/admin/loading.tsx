/**
 * Admin Dashboard Loading State
 * Displays a skeleton UI while admin data is loading
 */

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="h-8 w-8 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            </div>
            <div className="h-8 w-20 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-2" />
            <div className="h-3 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Content Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart Skeleton */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="h-5 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-4" />
          <div className="h-64 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        </div>

        {/* Table Skeleton */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="h-5 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-1" />
                  <div className="h-3 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
