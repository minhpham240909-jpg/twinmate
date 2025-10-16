/**
 * OpenAI Embeddings Integration
 * Generates vector embeddings for semantic search and AI-powered matching
 */

import { getEnv, features } from '@/lib/env'

/**
 * Generate embedding vector from text using OpenAI
 * Returns 1536-dimensional vector for text-embedding-3-small model
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!features.openai()) {
    throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in environment variables.')
  }

  const env = getEnv()

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small', // Cheaper and faster than ada-002
        input: text.slice(0, 8000), // Max 8k characters
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    return data.data[0].embedding as number[]
  } catch (error) {
    console.error('Failed to generate embedding:', error)
    throw error
  }
}

/**
 * Generate embedding from user profile data
 * Combines bio, subjects, interests, goals into searchable text
 */
export function profileToText(profile: {
  bio?: string | null
  subjects?: string[]
  interests?: string[]
  goals?: string[]
  aboutYourself?: string | null
  name?: string
}): string {
  const parts: string[] = []

  if (profile.name) parts.push(`Name: ${profile.name}`)
  if (profile.bio) parts.push(`Bio: ${profile.bio}`)
  if (profile.aboutYourself) parts.push(`About: ${profile.aboutYourself}`)
  if (profile.subjects?.length) parts.push(`Subjects: ${profile.subjects.join(', ')}`)
  if (profile.interests?.length) parts.push(`Interests: ${profile.interests.join(', ')}`)
  if (profile.goals?.length) parts.push(`Goals: ${profile.goals.join(', ')}`)

  return parts.join('\n').slice(0, 8000)
}

/**
 * Calculate cosine similarity between two vectors
 * Returns value between 0 (completely different) and 1 (identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} !== ${b.length}`)
  }

  let dotProduct = 0
  let magA = 0
  let magB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB)
  if (magnitude === 0) return 0

  return dotProduct / magnitude
}

/**
 * Find similar profiles using vector similarity
 * This is a placeholder - in production, use pgvector SQL queries
 */
export function findSimilarProfiles(
  queryEmbedding: number[],
  profileEmbeddings: Array<{ id: string; embedding: number[] }>,
  limit = 10
): Array<{ id: string; similarity: number }> {
  const similarities = profileEmbeddings.map(profile => ({
    id: profile.id,
    similarity: cosineSimilarity(queryEmbedding, profile.embedding)
  }))

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}

/**
 * Batch generate embeddings for multiple texts
 * More efficient than calling generateEmbedding() multiple times
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (!features.openai()) {
    throw new Error('OpenAI API key not configured')
  }

  const env = getEnv()

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts.map(t => t.slice(0, 8000)),
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI API error: ${error.error?.message}`)
    }

    const data = await response.json()
    return data.data.map((item: { embedding: number[] }) => item.embedding)
  } catch (error) {
    console.error('Failed to generate embeddings batch:', error)
    throw error
  }
}
