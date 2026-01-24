/**
 * Auth Pages Loading State
 * Displays a skeleton UI while auth pages are loading
 */

export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Skeleton */}
        <div className="text-center mb-8">
          <div className="h-12 w-12 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse mx-auto mb-4" />
          <div className="h-6 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mx-auto" />
        </div>

        {/* Form Card Skeleton */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8">
          {/* Title */}
          <div className="h-7 w-40 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-56 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-6" />

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-2" />
              <div className="h-12 w-full bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
            </div>
            <div>
              <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-2" />
              <div className="h-12 w-full bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Button */}
          <div className="h-12 w-full bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse mt-6" />

          {/* Links */}
          <div className="flex justify-between mt-4">
            <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
