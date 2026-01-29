'use client'

/**
 * Bottom Navigation Component
 *
 * Mobile-first bottom navigation with 3 tabs:
 * - Home (main dashboard with 3 tools)
 * - Progress (weekly summary, streaks, weak areas)
 * - Settings (minimal settings)
 *
 * NOTE: Using native <a> tags instead of Next.js Link to ensure
 * navigation works reliably in all scenarios (including when
 * roadmaps are active). This bypasses any potential React/Next.js
 * event handling issues.
 */

import { usePathname } from 'next/navigation'
import { Home, BarChart3, Settings } from 'lucide-react'
import { memo, useCallback, MouseEvent } from 'react'

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  matchPaths: string[] // Paths that should highlight this tab
}

const navItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    href: '/dashboard',
    matchPaths: ['/dashboard'],
  },
  {
    id: 'progress',
    label: 'Progress',
    icon: BarChart3,
    href: '/progress',
    matchPaths: ['/progress'],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/settings',
    matchPaths: ['/settings'],
  },
]

function BottomNavComponent() {
  const pathname = usePathname()

  const isActive = useCallback((item: NavItem): boolean => {
    return item.matchPaths.some(path => pathname === path || pathname?.startsWith(path + '/'))
  }, [pathname])

  // Use native navigation to bypass any React/Next.js issues
  const handleNavigation = useCallback((e: MouseEvent<HTMLAnchorElement>, href: string) => {
    // Debug logging to diagnose click issues
    console.log('[BottomNav] Click detected on:', href)
    console.log('[BottomNav] Event target:', e.target)
    console.log('[BottomNav] Current target:', e.currentTarget)

    e.preventDefault()
    e.stopPropagation()

    // Force navigation using window.location for reliability
    console.log('[BottomNav] Navigating to:', href)
    window.location.href = href
  }, [])

  // Debug: Log when any interaction reaches the nav
  const handleNavInteraction = useCallback((eventType: string) => {
    console.log(`[BottomNav] ${eventType} event on nav element`)
  }, [])

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pb-safe"
      style={{
        zIndex: 2147483647, // Maximum z-index value
        isolation: 'isolate', // Create new stacking context
        pointerEvents: 'auto', // Explicitly enable pointer events
      }}
      onMouseDown={() => handleNavInteraction('mousedown')}
      onTouchStart={() => handleNavInteraction('touchstart')}
      onClick={() => handleNavInteraction('click')}
    >
      <div className="max-w-lg mx-auto px-4" style={{ pointerEvents: 'auto' }}>
        <div className="flex items-center justify-around h-16" style={{ pointerEvents: 'auto' }}>
          {navItems.map((item) => {
            const active = isActive(item)
            const Icon = item.icon

            return (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => handleNavigation(e, item.href)}
                className={`flex flex-col items-center justify-center w-20 h-full transition-colors cursor-pointer ${
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
                style={{ pointerEvents: 'auto' }}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={`w-6 h-6 ${active ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
                <span className={`text-xs mt-1 ${active ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </a>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

// Memoize to prevent unnecessary re-renders
export const BottomNav = memo(BottomNavComponent)
export default BottomNav
