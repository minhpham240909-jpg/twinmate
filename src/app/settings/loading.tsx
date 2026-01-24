/**
 * Settings Page Loading State
 * Displays a skeleton UI while settings are loading
 */

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
            <div className="h-6 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Profile Section Skeleton */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-neutral-200 dark:border-neutral-800 last:border-b-0">
              <div className="h-12 w-12 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-1" />
                <div className="h-3 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
              <div className="h-5 w-5 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Preferences Section Skeleton */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="h-4 w-28 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-neutral-200 dark:border-neutral-800 last:border-b-0">
              <div className="h-12 w-12 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-28 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-1" />
                <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
              <div className="h-5 w-5 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Account Section Skeleton */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-neutral-200 dark:border-neutral-800 last:border-b-0">
              <div className="h-12 w-12 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
              <div className="h-5 w-5 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
