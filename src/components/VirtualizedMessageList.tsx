'use client'

/**
 * Virtualized Message List Component
 *
 * Efficiently renders large lists of messages using virtualization.
 * Only renders messages that are visible in the viewport, significantly
 * improving performance for conversations with 100+ messages.
 *
 * Features:
 * - Virtual scrolling for performance
 * - Auto-scroll to bottom on new messages
 * - Dynamic height estimation for variable content
 * - Smooth scrolling experience
 */

import { useRef, useEffect, useCallback, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  messageType?: string
  wasFlagged?: boolean
  createdAt: Date | string
  imageUrl?: string | null
  imageBase64?: string | null
  imageMimeType?: string | null
  imageType?: string | null
}

interface VirtualizedMessageListProps {
  messages: Message[]
  renderMessage: (message: Message, index: number) => React.ReactNode
  className?: string
  /** Whether to auto-scroll to bottom when new messages arrive */
  autoScrollToBottom?: boolean
  /** Estimated height of each message row in pixels (for initial calculation) */
  estimatedItemSize?: number
  /** Threshold to detect if user is near bottom (in pixels) */
  nearBottomThreshold?: number
  /** Callback when user scrolls */
  onScroll?: (scrollOffset: number) => void
}

function VirtualizedMessageListInner({
  messages,
  renderMessage,
  className = '',
  autoScrollToBottom = true,
  estimatedItemSize = 100,
  nearBottomThreshold = 150,
  onScroll,
}: VirtualizedMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const isUserNearBottomRef = useRef(true)
  const previousMessageCountRef = useRef(messages.length)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemSize,
    overscan: 5, // Render 5 items above/below viewport for smooth scrolling
  })

  // Check if user is near bottom
  const checkIfNearBottom = useCallback(() => {
    const container = parentRef.current
    if (!container) return true
    return container.scrollHeight - container.scrollTop - container.clientHeight < nearBottomThreshold
  }, [nearBottomThreshold])

  // Handle scroll events
  const handleScroll = useCallback(() => {
    isUserNearBottomRef.current = checkIfNearBottom()
    if (onScroll && parentRef.current) {
      onScroll(parentRef.current.scrollTop)
    }
  }, [checkIfNearBottom, onScroll])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > previousMessageCountRef.current && autoScrollToBottom) {
      // Only auto-scroll if user was near bottom
      if (isUserNearBottomRef.current) {
        // Use requestAnimationFrame for smooth scrolling
        requestAnimationFrame(() => {
          virtualizer.scrollToIndex(messages.length - 1, {
            align: 'end',
            behavior: 'smooth',
          })
        })
      }
    }
    previousMessageCountRef.current = messages.length
  }, [messages.length, autoScrollToBottom, virtualizer])

  // Scroll to bottom method (can be called from parent)
  const scrollToBottom = useCallback(() => {
    virtualizer.scrollToIndex(messages.length - 1, {
      align: 'end',
      behavior: 'smooth',
    })
  }, [virtualizer, messages.length])

  // Expose scrollToBottom via ref if needed
  useEffect(() => {
    if (parentRef.current) {
      (parentRef.current as any).scrollToBottom = scrollToBottom
    }
  }, [scrollToBottom])

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      onScroll={handleScroll}
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const message = messages[virtualItem.index]
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderMessage(message, virtualItem.index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Memoize to prevent unnecessary re-renders
export const VirtualizedMessageList = memo(VirtualizedMessageListInner)

/**
 * Simple hook to determine if virtualization should be used
 * Based on message count threshold
 */
export function useVirtualization(messageCount: number, threshold = 50) {
  return messageCount > threshold
}

export default VirtualizedMessageList
