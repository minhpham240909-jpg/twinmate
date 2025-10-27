/**
 * Agent Memory Helpers
 * For storing and retrieving short-term context, long-term facts, and user preferences
 */

import { SupabaseClient } from '@supabase/supabase-js'

export type MemoryScope = 'short' | 'long' | 'preference'

export interface MemoryEntry {
  id: string
  userId: string
  scope: MemoryScope
  key: string
  value: any
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * Store a memory entry
 */
export async function setMemory(
  supabase: SupabaseClient,
  userId: string,
  scope: MemoryScope,
  key: string,
  value: any,
  ttlSeconds?: number
): Promise<void> {
  const expiresAt = ttlSeconds
    ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
    : null

  const { error } = await supabase
    .from('agent_memory')
    .upsert(
      {
        user_id: userId,
        scope,
        key,
        value,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,scope,key',
      }
    )

  if (error) {
    throw new Error(`Failed to set memory: ${error.message}`)
  }
}

/**
 * Get a single memory entry by key
 */
export async function getMemory(
  supabase: SupabaseClient,
  userId: string,
  scope: MemoryScope,
  key: string
): Promise<any | null> {
  const { data, error } = await supabase
    .from('agent_memory')
    .select('value, expires_at')
    .eq('user_id', userId)
    .eq('scope', scope)
    .eq('key', key)
    .single()

  if (error || !data) return null

  // Check if expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    // Delete expired entry
    await supabase
      .from('agent_memory')
      .delete()
      .eq('user_id', userId)
      .eq('scope', scope)
      .eq('key', key)
    return null
  }

  return data.value
}

/**
 * Get all memory entries for a scope
 */
export async function getMemoryByScope(
  supabase: SupabaseClient,
  userId: string,
  scope: MemoryScope,
  limit = 50
): Promise<Record<string, any>> {
  const { data, error } = await supabase
    .from('agent_memory')
    .select('key, value, expires_at')
    .eq('user_id', userId)
    .eq('scope', scope)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error || !data) return {}

  const now = new Date()
  const result: Record<string, any> = {}

  for (const entry of data) {
    // Skip expired entries
    if (entry.expires_at && new Date(entry.expires_at) < now) {
      continue
    }
    result[entry.key] = entry.value
  }

  return result
}

/**
 * Delete a memory entry
 */
export async function deleteMemory(
  supabase: SupabaseClient,
  userId: string,
  scope: MemoryScope,
  key: string
): Promise<void> {
  const { error } = await supabase
    .from('agent_memory')
    .delete()
    .eq('user_id', userId)
    .eq('scope', scope)
    .eq('key', key)

  if (error) {
    throw new Error(`Failed to delete memory: ${error.message}`)
  }
}

/**
 * Clear all memory for a scope
 */
export async function clearMemoryScope(
  supabase: SupabaseClient,
  userId: string,
  scope: MemoryScope
): Promise<void> {
  const { error } = await supabase
    .from('agent_memory')
    .delete()
    .eq('user_id', userId)
    .eq('scope', scope)

  if (error) {
    throw new Error(`Failed to clear memory: ${error.message}`)
  }
}

/**
 * Clean up expired memory entries
 */
export async function cleanupExpiredMemory(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('agent_memory')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (error) {
    throw new Error(`Failed to cleanup expired memory: ${error.message}`)
  }

  return data?.length || 0
}

/**
 * Helper: Store short-term context (expires in 1 hour)
 */
export async function setShortTermContext(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  value: any
): Promise<void> {
  return setMemory(supabase, userId, 'short', key, value, 3600) // 1 hour TTL
}

/**
 * Helper: Store long-term fact (no expiration)
 */
export async function setLongTermFact(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  value: any
): Promise<void> {
  return setMemory(supabase, userId, 'long', key, value)
}

/**
 * Helper: Store user preference (no expiration)
 */
export async function setPreference(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  value: any
): Promise<void> {
  return setMemory(supabase, userId, 'preference', key, value)
}

/**
 * Build context summary from recent memory
 * Returns a compact string for prompt injection
 */
export async function buildContextSummary(
  supabase: SupabaseClient,
  userId: string,
  options: {
    includeShort?: boolean
    includeLong?: boolean
    includePreferences?: boolean
    maxItems?: number
  } = {}
): Promise<string> {
  const { includeShort = true, includeLong = true, includePreferences = true, maxItems = 10 } = options

  const parts: string[] = []

  if (includePreferences) {
    const prefs = await getMemoryByScope(supabase, userId, 'preference', maxItems)
    if (Object.keys(prefs).length > 0) {
      parts.push(`Preferences: ${JSON.stringify(prefs)}`)
    }
  }

  if (includeLong) {
    const longTerm = await getMemoryByScope(supabase, userId, 'long', maxItems)
    if (Object.keys(longTerm).length > 0) {
      parts.push(`Known facts: ${JSON.stringify(longTerm)}`)
    }
  }

  if (includeShort) {
    const shortTerm = await getMemoryByScope(supabase, userId, 'short', maxItems)
    if (Object.keys(shortTerm).length > 0) {
      parts.push(`Recent context: ${JSON.stringify(shortTerm)}`)
    }
  }

  return parts.join('\n')
}
