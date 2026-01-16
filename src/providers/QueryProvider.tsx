'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

/**
 * React Query Provider
 * Provides client-side caching for API requests
 *
 * Benefits:
 * - Automatic background refetching
 * - Stale-while-revalidate caching
 * - Request deduplication
 * - Optimistic updates
 * - No loading states when returning to pages with cached data
 */
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache data for 5 minutes (staleTime)
            // Data won't refetch until stale
            staleTime: 5 * 60 * 1000,

            // Keep cached data for 30 minutes (gcTime, formerly cacheTime)
            // Even if stale, show cached data while refetching in background
            gcTime: 30 * 60 * 1000,

            // Retry failed requests 1 time
            retry: 1,

            // Don't refetch on window focus for smooth experience
            // (like Instagram/TikTok - data stays until you pull to refresh)
            refetchOnWindowFocus: false,

            // Don't refetch on reconnect (prevents loading on network switch)
            refetchOnReconnect: false,

            // Show stale data while refetching
            refetchOnMount: 'always',
          },
          mutations: {
            // Retry failed mutations 0 times (user should see error immediately)
            retry: 0,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
