'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'LIGHT' | 'DARK'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  effectiveTheme: 'light' | 'dark' // The actual theme being applied
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('LIGHT')
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light')

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme
    if (savedTheme && ['LIGHT', 'DARK'].includes(savedTheme)) {
      setThemeState(savedTheme)
    }
  }, [])

  // Calculate effective theme based on user preference
  useEffect(() => {
    const calculateEffectiveTheme = () => {
      if (theme === 'LIGHT') return 'light'
      if (theme === 'DARK') return 'dark'

      // Default to light theme
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
