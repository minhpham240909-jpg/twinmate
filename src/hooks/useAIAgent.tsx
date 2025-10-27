'use client'

import { useState } from 'react'
import AIPanel from '@/components/ai-agent/AIPanel'

/**
 * Hook to control AI Agent panel globally
 */
export function useAIAgent() {
  const [isOpen, setIsOpen] = useState(false)
  const [initialMessage, setInitialMessage] = useState<string | undefined>()

  const openPanel = (message?: string) => {
    setInitialMessage(message)
    setIsOpen(true)
  }

  const closePanel = () => {
    setIsOpen(false)
    setInitialMessage(undefined)
  }

  const Panel = isOpen ? (
    <AIPanel onClose={closePanel} initialMinimized={false} />
  ) : null

  return {
    isOpen,
    openPanel,
    closePanel,
    Panel,
  }
}
