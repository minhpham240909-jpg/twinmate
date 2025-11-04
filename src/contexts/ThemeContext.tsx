'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'LIGHT' | 'DARK' | 'SYSTEM'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('SYSTEM')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  // Listen to system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      if (theme === 'SYSTEM') {
        const isDark = mediaQuery.matches
        setResolvedTheme(isDark ? 'dark' : 'light')
        applyTheme(isDark ? 'dark' : 'light')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    handleChange() // Initial check

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  // Apply theme when it changes
  useEffect(() => {
    if (theme === 'SYSTEM') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setResolvedTheme(isDark ? 'dark' : 'light')
      applyTheme(isDark ? 'dark' : 'light')
    } else {
      const resolved = theme === 'DARK' ? 'dark' : 'light'
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
  }, [theme])

  const applyTheme = (resolvedTheme: 'light' | 'dark') => {
    const root = document.documentElement

    if (resolvedTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  // Load theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved && ['LIGHT', 'DARK', 'SYSTEM'].includes(saved)) {
      setThemeState(saved)
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
