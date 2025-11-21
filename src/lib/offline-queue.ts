'use client'

/**
 * Offline Queue System
 * Queues critical actions when offline and replays them when connection is restored
 */

export interface QueuedAction {
  id: string
  type: string
  payload: unknown
  timestamp: number
  retries: number
  maxRetries: number
}

const STORAGE_KEY = 'offline_action_queue'
const MAX_QUEUE_SIZE = 100
const MAX_RETRIES = 3

class OfflineQueue {
  private queue: QueuedAction[] = []
  private isProcessing = false
  private listeners: Array<(queue: QueuedAction[]) => void> = []

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadFromStorage()
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.queue = JSON.parse(stored)
        console.log(`[Offline Queue] Loaded ${this.queue.length} queued actions from storage`)
      }
    } catch (error) {
      console.error('[Offline Queue] Error loading from storage:', error)
      this.queue = []
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue))
    } catch (error) {
      console.error('[Offline Queue] Error saving to storage:', error)
    }
  }

  /**
   * Generate unique ID for action
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Add action to queue
   */
  add(type: string, payload: unknown, maxRetries = MAX_RETRIES): string {
    // Check queue size limit
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      console.warn('[Offline Queue] Queue full, removing oldest action')
      this.queue.shift()
    }

    const action: QueuedAction = {
      id: this.generateId(),
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries,
    }

    this.queue.push(action)
    this.saveToStorage()
    this.notifyListeners()

    console.log(`[Offline Queue] Added action: ${type}`, action)
    return action.id
  }

  /**
   * Remove action from queue
   */
  remove(id: string): boolean {
    const initialLength = this.queue.length
    this.queue = this.queue.filter(action => action.id !== id)
    
    if (this.queue.length !== initialLength) {
      this.saveToStorage()
      this.notifyListeners()
      console.log(`[Offline Queue] Removed action: ${id}`)
      return true
    }
    
    return false
  }

  /**
   * Get all queued actions
   */
  getAll(): QueuedAction[] {
    return [...this.queue]
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length
  }

  /**
   * Clear entire queue
   */
  clear() {
    this.queue = []
    this.saveToStorage()
    this.notifyListeners()
    console.log('[Offline Queue] Cleared all actions')
  }

  /**
   * Process queue with provided handler
   */
  async process(
    handler: (action: QueuedAction) => Promise<boolean>
  ): Promise<void> {
    if (this.isProcessing) {
      console.log('[Offline Queue] Already processing')
      return
    }

    if (this.queue.length === 0) {
      console.log('[Offline Queue] Queue is empty')
      return
    }

    this.isProcessing = true
    console.log(`[Offline Queue] Processing ${this.queue.length} actions`)

    const actionsToProcess = [...this.queue]
    
    for (const action of actionsToProcess) {
      try {
        console.log(`[Offline Queue] Processing action: ${action.type}`)
        const success = await handler(action)
        
        if (success) {
          // Remove successfully processed action
          this.remove(action.id)
        } else {
          // Increment retry count
          action.retries += 1
          
          if (action.retries >= action.maxRetries) {
            console.error(`[Offline Queue] Max retries reached for action: ${action.type}`)
            this.remove(action.id)
          } else {
            console.log(`[Offline Queue] Action failed, will retry (${action.retries}/${action.maxRetries})`)
            this.saveToStorage()
          }
        }
      } catch (error) {
        console.error(`[Offline Queue] Error processing action:`, error)
        action.retries += 1
        
        if (action.retries >= action.maxRetries) {
          console.error(`[Offline Queue] Max retries reached for action: ${action.type}`)
          this.remove(action.id)
        } else {
          this.saveToStorage()
        }
      }
    }

    this.isProcessing = false
    console.log(`[Offline Queue] Processing complete. ${this.queue.length} actions remaining`)
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: (queue: QueuedAction[]) => void): () => void {
    this.listeners.push(listener)
    // Immediately notify with current queue
    listener(this.getAll())
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners() {
    const queue = this.getAll()
    this.listeners.forEach(listener => listener(queue))
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueue()

/**
 * React hook to use offline queue
 */
import { useState, useEffect } from 'react'

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedAction[]>(offlineQueue.getAll())

  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe(setQueue)
    return unsubscribe
  }, [])

  return {
    queue,
    addToQueue: offlineQueue.add.bind(offlineQueue),
    removeFromQueue: offlineQueue.remove.bind(offlineQueue),
    processQueue: offlineQueue.process.bind(offlineQueue),
    clearQueue: offlineQueue.clear.bind(offlineQueue),
    queueSize: queue.length,
  }
}
