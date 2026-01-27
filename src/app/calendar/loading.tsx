/**
 * Calendar Loading State
 * Displays a skeleton UI while the calendar page is loading
 */

export default function CalendarLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="h-6 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            </div>
            <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
          </div>
        </div>
      </header>

      {/* Calendar Content Skeleton */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Month Navigation */}
        <div className="flex items-center justify-between px-2">
          <div className="h-6 w-6 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          <div className="h-6 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          <div className="h-6 w-6 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        </div>

        {/* Calendar Grid */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="h-8 flex items-center justify-center">
                <div className="h-4 w-4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          {[1, 2, 3, 4, 5].map((week) => (
            <div key={week} className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <div
                  key={day}
                  className="h-12 flex flex-col items-center justify-center p-1"
                >
                  <div className="h-6 w-6 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Today's Schedule */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="h-5 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                <div className="h-2 w-2 bg-neutral-300 dark:bg-neutral-700 rounded-full animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-1" />
                  <div className="h-3 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
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
