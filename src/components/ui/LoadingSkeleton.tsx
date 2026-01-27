/**
 * Reusable Loading Skeleton Components
 * Provides consistent loading states across the app
 */

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse ${className}`}
    />
  )
}

export function SkeletonText({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-4 ${className}`} />
}

export function SkeletonTitle({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-6 ${className}`} />
}

export function SkeletonAvatar({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-10 w-10 rounded-full ${className}`} />
}

export function SkeletonButton({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-10 w-24 rounded-lg ${className}`} />
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 ${className}`}>
      <Skeleton className="h-5 w-32 mb-4" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}

export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
      <SkeletonAvatar />
      <div className="flex-1">
        <Skeleton className="h-4 w-3/4 mb-1" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

interface PageSkeletonProps {
  /** Show header skeleton */
  showHeader?: boolean
  /** Show bottom navigation skeleton */
  showBottomNav?: boolean
  /** Custom content */
  children?: React.ReactNode
}

export function PageSkeleton({
  showHeader = true,
  showBottomNav = true,
  children
}: PageSkeletonProps) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {showHeader && (
        <header className="sticky top-0 z-40 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-6 w-32" />
              </div>
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        </header>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
        {children}
      </main>

      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 px-4 py-2 z-50">
          <div className="max-w-2xl mx-auto flex justify-around">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1 p-2">
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-2 w-8" />
              </div>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

export default {
  Skeleton,
  SkeletonText,
  SkeletonTitle,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SkeletonListItem,
  PageSkeleton,
}
