/**
 * Embedding Client - Generate vector embeddings for text
 * Supports OpenAI and caching for performance
 */

export interface EmbeddingProvider {
  embed(text: string): Promise<{
    embedding: number[]
    tokenCount: number
  }>
  embedBatch(texts: string[]): Promise<Array<{
    embedding: number[]
    tokenCount: number
  }>>
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string
  private cache: Map<string, { embedding: number[]; tokenCount: number }>

  constructor(apiKey: string, model: string = 'text-embedding-3-large') {
    this.apiKey = apiKey
    this.model = model
    this.cache = new Map()
  }

  async embed(text: string): Promise<{ embedding: number[]; tokenCount: number }> {
    // Check cache first
    const cacheKey = this.getCacheKey(text)
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const result = {
      embedding: data.data[0].embedding,
      tokenCount: data.usage.total_tokens,
    }

    // Cache result
    this.cache.set(cacheKey, result)

    return result
  }

  async embedBatch(texts: string[]): Promise<Array<{ embedding: number[]; tokenCount: number }>> {
    // Check cache for each text
    const uncached: string[] = []
    const uncachedIndices: number[] = []
    const results: Array<{ embedding: number[]; tokenCount: number } | null> = new Array(texts.length).fill(null)

    for (let i = 0; i < texts.length; i++) {
      const cacheKey = this.getCacheKey(texts[i])
      if (this.cache.has(cacheKey)) {
        results[i] = this.cache.get(cacheKey)!
      } else {
        uncached.push(texts[i])
        uncachedIndices.push(i)
      }
    }

    // Fetch uncached embeddings
    if (uncached.length > 0) {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: uncached,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const data = await response.json()

      // Fill in results and update cache
      for (let i = 0; i < uncached.length; i++) {
        const result = {
          embedding: data.data[i].embedding,
          tokenCount: data.usage.total_tokens / uncached.length, // Approximate
        }
        results[uncachedIndices[i]] = result
        this.cache.set(this.getCacheKey(uncached[i]), result)
      }
    }

    return results.filter(r => r !== null) as Array<{ embedding: number[]; tokenCount: number }>
  }

  private getCacheKey(text: string): string {
    // Simple hash for caching - in production use a proper hash function
    return `${this.model}:${text.substring(0, 100)}`
  }

  clearCache(): void {
    this.cache.clear()
  }
}

/**
 * Mock embedding provider for testing
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<{ embedding: number[]; tokenCount: number }> {
    // Generate deterministic fake embedding
    const embedding = new Array(1536).fill(0).map((_, i) =>
      Math.sin(i + text.length) * 0.5
    )

    return {
      embedding,
      tokenCount: Math.ceil(text.split(/\s+/).length / 0.75),
    }
  }

  async embedBatch(texts: string[]): Promise<Array<{ embedding: number[]; tokenCount: number }>> {
    return Promise.all(texts.map(text => this.embed(text)))
  }
}
