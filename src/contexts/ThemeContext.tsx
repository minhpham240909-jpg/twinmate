'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'LIGHT' | 'DARK' | 'SYSTEM'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  effectiveTheme: 'light' | 'dark' // The actual theme being applied
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('SYSTEM')
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light')

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme
    if (savedTheme && ['LIGHT', 'DARK', 'SYSTEM'].includes(savedTheme)) {
      setThemeState(savedTheme)
    }
  }, [])

  // Calculate effective theme based on user preference and system preference
  useEffect(() => {
    const calculateEffectiveTheme = () => {
      if (theme === 'LIGHT') return 'light'
      if (theme === 'DARK') return 'dark'
      
      // SYSTEM - check system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
      return 'light'
    }

    const newEffectiveTheme = calculateEffectiveTheme()
    setEffectiveTheme(newEffectiveTheme)

    // Apply theme to document
    if (newEffectiveTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // Listen for system theme changes if theme is SYSTEM
    if (theme === 'SYSTEM') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? 'dark' : 'light'
        setEffectiveTheme(newTheme)
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme }}>
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
