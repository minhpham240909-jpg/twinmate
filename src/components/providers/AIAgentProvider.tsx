/**
 * AI Agent Provider
 * Manages AI panel state and presence system
 */

'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { usePresence } from '@/hooks/usePresence'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import AIPanel from '@/components/ai-agent/AIPanel'
import CommandPalette from '@/components/ai-agent/CommandPalette'

interface AIAgentContextType {
  isPanelOpen: boolean
  openPanel: (initialMessage?: string) => void
  closePanel: () => void
  togglePanel: () => void
}

const AIAgentContext = createContext<AIAgentContextType | undefined>(undefined)

export function useAIAgent() {
  const context = useContext(AIAgentContext)
  if (!context) {
    throw new Error('useAIAgent must be used within AIAgentProvider')
  }
  return context
}

interface AIAgentProviderProps {
  children: ReactNode
  user: User | null
}

export function AIAgentProvider({ children, user }: AIAgentProviderProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [initialMessage, setInitialMessage] = useState<string | undefined>()
  const router = useRouter()

  // Initialize presence heartbeat
  usePresence(user, {
    enabled: !!user,
    currentActivity: 'available',
  })

  const openPanel = (message?: string) => {
    setInitialMessage(message)
    setIsPanelOpen(true)
  }

  const closePanel = () => {
    setIsPanelOpen(false)
    setInitialMessage(undefined)
  }

  const togglePanel = () => setIsPanelOpen(!isPanelOpen)

  // Handle command palette actions
  const handleCommandAction = (action: string, data?: any) => {
    if (action === 'ask' && data?.prompt) {
      openPanel(data.prompt)
    } else if (action === 'navigate' && data?.path) {
      router.push(data.path)
    }
  }

  return (
    <AIAgentContext.Provider value={{ isPanelOpen, openPanel, closePanel, togglePanel }}>
      {children}
      {isPanelOpen && <AIPanel onClose={closePanel} initialMessage={initialMessage} />}
      <CommandPalette onSelectAction={handleCommandAction} />
    </AIAgentContext.Provider>
  )
}
