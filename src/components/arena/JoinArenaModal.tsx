'use client'

/**
 * Join Arena Modal
 *
 * Modal for entering an invite code to join an arena.
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, Users, AlertCircle } from 'lucide-react'

interface JoinArenaModalProps {
  isOpen: boolean
  onClose: () => void
}

export function JoinArenaModal({ isOpen, onClose }: JoinArenaModalProps) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCode('')
      setError(null)
    }
  }, [isOpen])

  const handleJoin = async () => {
    const trimmedCode = code.trim().toUpperCase()
    if (trimmedCode.length !== 6) {
      setError('Invite code must be 6 characters')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/arena/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: trimmedCode }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to join arena')
        return
      }

      // Navigate to lobby
      router.push(`/arena/${data.arena.id}/lobby`)
      onClose()
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.trim().length === 6) {
      handleJoin()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Join Arena
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Enter Invite Code
          </label>
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().slice(0, 6))
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder="XXXXXX"
            maxLength={6}
            className="w-full px-4 py-4 text-center text-2xl font-mono font-bold tracking-[0.5em] uppercase bg-neutral-100 dark:bg-neutral-800 border-2 border-transparent focus:border-purple-500 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 outline-none transition-colors"
          />

          {/* Error */}
          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Join Button */}
          <button
            onClick={handleJoin}
            disabled={loading || code.trim().length !== 6}
            className="w-full mt-6 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-xl font-semibold text-white transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Joining...
              </>
            ) : (
              'Join Arena'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
