// Hook to ensure user is synced to database
import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth/context'

export function useUserSync() {
  const { user } = useAuth()
  const syncedRef = useRef(false)

  useEffect(() => {
    if (user && !syncedRef.current) {
      syncedRef.current = true

      // Attempt to sync user to database
      fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
        .then(response => {
          if (response.ok) {
            console.log('User sync verified')
          }
        })
        .catch(err => {
          console.error('User sync error:', err)
        })
    }
  }, [user])
}
