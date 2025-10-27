/**
 * Agent Memory System
 * Persist conversation history and user preferences
 */

import { SupabaseClient } from '@supabase/supabase-js'

export type MemoryScope = 'short' | 'long' | 'preference'

export interface AgentMemory {
  id: string
  userId: string
  scope: MemoryScope
  key: string
  value: any
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  cards?: any[]
}

export class MemoryManager {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Store conversation history as short-term memory (expires in 7 days)
   */
  async saveConversation(userId: string, messages: ConversationMessage[]): Promise<void> {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days retention

    const { error } = await this.supabase
      .from('agent_memory')
      .upsert({
        user_id: userId,
        scope: 'short',
        key: 'conversation_history',
        value: { messages, lastUpdate: new Date().toISOString() },
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,scope,key',
      })

    if (error) {
      // If table doesn't exist, fail silently (graceful degradation)
      if (error.code === '42P01') {
        console.warn('agent_memory table not found - skipping conversation save')
        return
      }
      console.error('Failed to save conversation:', error)
    }
  }

  /**
   * Load conversation history from memory
   */
  async loadConversation(userId: string): Promise<ConversationMessage[]> {
    try {
      const { data, error } = await this.supabase
        .from('agent_memory')
        .select('value')
        .eq('user_id', userId)
        .eq('scope', 'short')
        .eq('key', 'conversation_history')
        .single()

      if (error) {
        // Table doesn't exist or no data - return empty
        if (error.code === '42P01' || error.code === 'PGRST116') {
          return []
        }
        console.error('Failed to load conversation:', error)
        return []
      }

      return data?.value?.messages || []
    } catch (error) {
      console.error('Error loading conversation:', error)
      return []
    }
  }

  /**
   * Save user preference (no expiration)
   */
  async savePreference(userId: string, key: string, value: any): Promise<void> {
    const { error } = await this.supabase
      .from('agent_memory')
      .upsert({
        user_id: userId,
        scope: 'preference',
        key,
        value,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,scope,key',
      })

    if (error && error.code !== '42P01') {
      console.error(`Failed to save preference ${key}:`, error)
    }
  }

  /**
   * Load user preference
   */
  async loadPreference<T = any>(userId: string, key: string): Promise<T | null> {
    try {
      const { data, error } = await this.supabase
        .from('agent_memory')
        .select('value')
        .eq('user_id', userId)
        .eq('scope', 'preference')
        .eq('key', key)
        .single()

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116') {
          return null
        }
        console.error(`Failed to load preference ${key}:`, error)
        return null
      }

      return data?.value || null
    } catch (error) {
      console.error(`Error loading preference ${key}:`, error)
      return null
    }
  }

  /**
   * Store long-term fact about user (e.g., "majoring in Computer Science")
   */
  async storeFact(userId: string, key: string, value: any): Promise<void> {
    const { error } = await this.supabase
      .from('agent_memory')
      .upsert({
        user_id: userId,
        scope: 'long',
        key,
        value,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,scope,key',
      })

    if (error && error.code !== '42P01') {
      console.error(`Failed to store fact ${key}:`, error)
    }
  }

  /**
   * Load all long-term facts for context building
   */
  async loadFacts(userId: string): Promise<Record<string, any>> {
    try {
      const { data, error } = await this.supabase
        .from('agent_memory')
        .select('key, value')
        .eq('user_id', userId)
        .eq('scope', 'long')

      if (error) {
        if (error.code === '42P01') {
          return {}
        }
        console.error('Failed to load facts:', error)
        return {}
      }

      const facts: Record<string, any> = {}
      data?.forEach(row => {
        facts[row.key] = row.value
      })
      return facts
    } catch (error) {
      console.error('Error loading facts:', error)
      return {}
    }
  }

  /**
   * Clean up old short-term memories
   */
  async cleanupExpired(): Promise<void> {
    const { error } = await this.supabase
      .from('agent_memory')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .not('expires_at', 'is', null)

    if (error && error.code !== '42P01') {
      console.error('Failed to cleanup expired memories:', error)
    }
  }
}
