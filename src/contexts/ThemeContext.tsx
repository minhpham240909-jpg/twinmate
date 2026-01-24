'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useLayoutEffect } from 'react'

type Theme = 'LIGHT' | 'DARK'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  effectiveTheme: 'light' | 'dark' // The actual theme being applied
  toggleTheme: () => void // Convenience method to toggle between light/dark
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Helper to get initial theme (runs on both server and client)
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'LIGHT'

  const savedTheme = localStorage.getItem('theme') as Theme
  if (savedTheme && ['LIGHT', 'DARK'].includes(savedTheme)) {
    return savedTheme
  }

  // Check system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'DARK'
  }

  return 'LIGHT'
}

// Apply theme to document immediately (prevents flash)
function applyThemeToDocument(theme: Theme) {
  if (typeof document === 'undefined') return

  const isDark = theme === 'DARK'

  if (isDark) {
    document.documentElement.classList.add('dark')
    document.documentElement.style.colorScheme = 'dark'
  } else {
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = 'light'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme())
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() =>
    getInitialTheme() === 'DARK' ? 'dark' : 'light'
  )

  // Apply theme immediately on mount (useLayoutEffect runs before paint)
  useLayoutEffect(() => {
    const initialTheme = getInitialTheme()
    setThemeState(initialTheme)
    applyThemeToDocument(initialTheme)
    setEffectiveTheme(initialTheme === 'DARK' ? 'dark' : 'light')
  }, [])

  // Apply theme changes
  useEffect(() => {
    applyThemeToDocument(theme)
    setEffectiveTheme(theme === 'DARK' ? 'dark' : 'light')
  }, [theme])

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't set a preference
      const savedTheme = localStorage.getItem('theme')
      if (!savedTheme) {
        const newTheme = e.matches ? 'DARK' : 'LIGHT'
        setThemeState(newTheme)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
    applyThemeToDocument(newTheme)
  }

  const toggleTheme = () => {
    setTheme(theme === 'LIGHT' ? 'DARK' : 'LIGHT')
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
