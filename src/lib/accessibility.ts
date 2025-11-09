/**
 * Accessibility Utilities
 * ARIA helpers, keyboard navigation, and screen reader support
 */

/**
 * Generate unique ID for ARIA attributes
 */
export function generateAriaId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Keyboard navigation helpers
 */
export const KeyCodes = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const

/**
 * Check if element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (element.tabIndex < 0) return false
  if (element.hasAttribute('disabled')) return false
  if (element.getAttribute('aria-disabled') === 'true') return false

  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') return false

  return true
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

  return Array.from(container.querySelectorAll(selector)).filter((el) =>
    isFocusable(el as HTMLElement)
  ) as HTMLElement[]
}

/**
 * Trap focus within a modal/dialog
 */
export function trapFocus(
  container: HTMLElement,
  event: KeyboardEvent,
  options: { loop?: boolean } = {}
) {
  const { loop = true } = options

  if (event.key !== KeyCodes.TAB) return

  const focusable = getFocusableElements(container)
  if (focusable.length === 0) return

  const firstElement = focusable[0]
  const lastElement = focusable[focusable.length - 1]
  const activeElement = document.activeElement as HTMLElement

  // Shift + Tab (backward)
  if (event.shiftKey) {
    if (activeElement === firstElement || !container.contains(activeElement)) {
      event.preventDefault()
      if (loop) {
        lastElement.focus()
      }
    }
  }
  // Tab (forward)
  else {
    if (activeElement === lastElement || !container.contains(activeElement)) {
      event.preventDefault()
      if (loop) {
        firstElement.focus()
      }
    }
  }
}

/**
 * Announce to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.style.position = 'absolute'
  announcement.style.left = '-10000px'
  announcement.style.width = '1px'
  announcement.style.height = '1px'
  announcement.style.overflow = 'hidden'

  announcement.textContent = message
  document.body.appendChild(announcement)

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

/**
 * Create live region for dynamic content announcements
 */
export function createLiveRegion(id: string, priority: 'polite' | 'assertive' = 'polite'): HTMLElement {
  let region = document.getElementById(id)

  if (!region) {
    region = document.createElement('div')
    region.id = id
    region.setAttribute('role', 'status')
    region.setAttribute('aria-live', priority)
    region.setAttribute('aria-atomic', 'true')
    region.style.position = 'absolute'
    region.style.left = '-10000px'
    region.style.width = '1px'
    region.style.height = '1px'
    region.style.overflow = 'hidden'
    document.body.appendChild(region)
  }

  return region
}

/**
 * Update live region content
 */
export function updateLiveRegion(id: string, message: string) {
  const region = document.getElementById(id)
  if (region) {
    region.textContent = message
  }
}

/**
 * Skip to main content helper
 */
export function skipToMainContent() {
  const main = document.querySelector('main') || document.querySelector('[role="main"]')
  if (main instanceof HTMLElement) {
    main.tabIndex = -1
    main.focus()
    main.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

/**
 * Check color contrast ratio (WCAG AA: 4.5:1, AAA: 7:1)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const getLuminance = (color: string): number => {
    // Convert hex to RGB
    const hex = color.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16) / 255
    const g = parseInt(hex.substr(2, 2), 16) / 255
    const b = parseInt(hex.substr(4, 2), 16) / 255

    // Apply gamma correction
    const rs = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)
    const gs = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)
    const bs = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4)

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  const l1 = getLuminance(color1)
  const l2 = getLuminance(color2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if contrast meets WCAG standards
 */
export function meetsContrastRequirements(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  largeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background)
  const threshold = level === 'AA' ? (largeText ? 3 : 4.5) : largeText ? 4.5 : 7

  return ratio >= threshold
}

/**
 * ARIA role helpers
 */
export const AriaRoles = {
  button: 'button',
  link: 'link',
  menuitem: 'menuitem',
  checkbox: 'checkbox',
  radio: 'radio',
  tab: 'tab',
  tabpanel: 'tabpanel',
  dialog: 'dialog',
  alertdialog: 'alertdialog',
  alert: 'alert',
  status: 'status',
  progressbar: 'progressbar',
  tooltip: 'tooltip',
  navigation: 'navigation',
  main: 'main',
  search: 'search',
  region: 'region',
  banner: 'banner',
  contentinfo: 'contentinfo',
  complementary: 'complementary',
} as const

/**
 * Create accessible button props
 */
export function accessibleButton(label: string, options: {
  pressed?: boolean
  expanded?: boolean
  disabled?: boolean
  describedBy?: string
  controls?: string
} = {}) {
  return {
    role: 'button',
    'aria-label': label,
    'aria-pressed': options.pressed,
    'aria-expanded': options.expanded,
    'aria-disabled': options.disabled,
    'aria-describedby': options.describedBy,
    'aria-controls': options.controls,
    tabIndex: options.disabled ? -1 : 0,
  }
}

/**
 * Create accessible link props
 */
export function accessibleLink(label: string, options: {
  current?: boolean
  external?: boolean
} = {}) {
  return {
    'aria-label': label,
    'aria-current': options.current ? 'page' : undefined,
    rel: options.external ? 'noopener noreferrer' : undefined,
    target: options.external ? '_blank' : undefined,
  }
}

/**
 * Reduce motion check
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * High contrast mode check
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-contrast: high)').matches
}
