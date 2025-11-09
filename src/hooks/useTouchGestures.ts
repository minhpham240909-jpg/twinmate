/**
 * Touch Gestures Hook
 * Handles swipe, pinch, and other mobile gestures
 */

import { useEffect, useRef, useState } from 'react'

interface TouchPoint {
  x: number
  y: number
  timestamp: number
}

interface SwipeConfig {
  minDistance?: number
  maxDuration?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

export function useSwipeGesture(config: SwipeConfig) {
  const startTouch = useRef<TouchPoint | null>(null)
  const { minDistance = 50, maxDuration = 500 } = config

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    startTouch.current = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    }
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (!startTouch.current) return

    const touch = e.changedTouches[0]
    const endPoint: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    }

    const deltaX = endPoint.x - startTouch.current.x
    const deltaY = endPoint.y - startTouch.current.y
    const duration = endPoint.timestamp - startTouch.current.timestamp

    if (duration > maxDuration) {
      startTouch.current = null
      return
    }

    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    // Horizontal swipe
    if (absX > absY && absX > minDistance) {
      if (deltaX > 0) {
        config.onSwipeRight?.()
      } else {
        config.onSwipeLeft?.()
      }
    }
    // Vertical swipe
    else if (absY > absX && absY > minDistance) {
      if (deltaY > 0) {
        config.onSwipeDown?.()
      } else {
        config.onSwipeUp?.()
      }
    }

    startTouch.current = null
  }

  return {
    handleTouchStart,
    handleTouchEnd,
  }
}

/**
 * Hook for long press gesture
 */
export function useLongPress(
  callback: () => void,
  options: { duration?: number; preventContext?: boolean } = {}
) {
  const { duration = 500, preventContext = true } = options
  const timeout = useRef<NodeJS.Timeout | undefined>(undefined)
  const target = useRef<EventTarget | undefined>(undefined)

  const start = (e: TouchEvent | MouseEvent) => {
    target.current = e.target as EventTarget
    timeout.current = setTimeout(() => {
      callback()
    }, duration)
  }

  const clear = () => {
    timeout.current && clearTimeout(timeout.current)
  }

  useEffect(() => {
    return () => {
      timeout.current && clearTimeout(timeout.current)
    }
  }, [])

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onContextMenu: preventContext ? (e: Event) => e.preventDefault() : undefined,
  }
}

/**
 * Hook to detect mobile device
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
      const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const smallScreen = window.innerWidth < 768

      setIsMobile(mobile || (touchSupport && smallScreen))
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

/**
 * Hook for pull-to-refresh gesture
 */
export function usePullToRefresh(onRefresh: () => Promise<void>, threshold = 80) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const scrollTop = useRef(0)

  const handleTouchStart = (e: TouchEvent) => {
    scrollTop.current = window.pageYOffset || document.documentElement.scrollTop
    if (scrollTop.current === 0) {
      startY.current = e.touches[0].clientY
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (scrollTop.current === 0 && startY.current > 0) {
      const currentY = e.touches[0].clientY
      const distance = currentY - startY.current

      if (distance > 0) {
        setPullDistance(Math.min(distance, threshold * 1.5))
        // Prevent default scroll when pulling
        if (distance > 10) {
          e.preventDefault()
        }
      }
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
    startY.current = 0
  }

  return {
    isRefreshing,
    pullDistance,
    pullProgress: Math.min(pullDistance / threshold, 1),
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  }
}
