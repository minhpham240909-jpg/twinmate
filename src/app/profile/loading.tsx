/**
 * Profile Loading State
 * Displays a skeleton UI while the profile page is loading
 */

export default function ProfileLoading() {
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

      {/* Profile Content Skeleton */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Avatar Section */}
        <div className="flex flex-col items-center">
          <div className="h-24 w-24 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse mb-4" />
          <div className="h-6 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 text-center"
            >
              <div className="h-8 w-12 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mx-auto mb-2" />
              <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>

        {/* Activity Section */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="h-5 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-1" />
                  <div className="h-3 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                </div>
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
