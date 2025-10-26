/**
 * AI Agent Wrapper - Connects to Auth Context
 */

'use client'

import { useAuth } from '@/lib/auth/context'
import { AIAgentProvider } from './AIAgentProvider'

export function AIAgentWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  return <AIAgentProvider user={user}>{children}</AIAgentProvider>
}
