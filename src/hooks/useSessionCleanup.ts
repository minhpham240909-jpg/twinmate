import { useEffect } from 'react'

/**
 * Hook to periodically cleanup inactive study sessions
 * Runs cleanup every 5 minutes to delete sessions that haven't started within 30 minutes
 */
export function useSessionCleanup() {
  useEffect(() => {
    const cleanupSessions = async () => {
      try {
        await fetch('/api/study-sessions/cleanup', {
          method: 'POST',
        })
      } catch (error) {
        console.error('Error running session cleanup:', error)
      }
    }

    // Run cleanup immediately on mount
    cleanupSessions()

    // Run cleanup every 5 minutes
    const interval = setInterval(cleanupSessions, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])
}
