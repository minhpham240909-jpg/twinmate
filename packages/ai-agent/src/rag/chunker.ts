/**
 * Document Chunker - Split documents into semantic chunks for RAG
 * Production-grade chunking with overlap and token counting
 */

export interface ChunkOptions {
  maxTokens?: number
  overlapTokens?: number
  preserveParagraphs?: boolean
}

export interface Chunk {
  content: string
  ord: number
  tokenCount: number
  metadata?: Record<string, any>
}

export class DocumentChunker {
  private readonly defaultMaxTokens = 500
  private readonly defaultOverlapTokens = 100

  /**
   * Chunk text content into overlapping segments
   */
  chunk(text: string, options?: ChunkOptions): Chunk[] {
    const maxTokens = options?.maxTokens || this.defaultMaxTokens
    const overlapTokens = options?.overlapTokens || this.defaultOverlapTokens
    const preserveParagraphs = options?.preserveParagraphs ?? true

    // Split into paragraphs first if enabled
    const segments = preserveParagraphs
      ? this.splitIntoParagraphs(text)
      : [text]

    const chunks: Chunk[] = []
    let currentChunk = ''
    let currentTokens = 0
    let ord = 0

    for (const segment of segments) {
      const segmentTokens = this.estimateTokens(segment)

      // If segment itself is too large, split it
      if (segmentTokens > maxTokens) {
        // Flush current chunk if any
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            ord: ord++,
            tokenCount: currentTokens,
          })
          currentChunk = ''
          currentTokens = 0
        }

        // Split large segment by sentences
        const sentences = this.splitIntoSentences(segment)
        for (const sentence of sentences) {
          const sentenceTokens = this.estimateTokens(sentence)

          if (currentTokens + sentenceTokens > maxTokens) {
            if (currentChunk.trim()) {
              chunks.push({
                content: currentChunk.trim(),
                ord: ord++,
                tokenCount: currentTokens,
              })

              // Keep overlap from end of previous chunk
              const overlapContent = this.getOverlapContent(currentChunk, overlapTokens)
              currentChunk = overlapContent
              currentTokens = this.estimateTokens(overlapContent)
            }
          }

          currentChunk += (currentChunk ? ' ' : '') + sentence
          currentTokens += sentenceTokens
        }
      } else {
        // Can we fit this segment in current chunk?
        if (currentTokens + segmentTokens > maxTokens) {
          // Flush current chunk
          if (currentChunk.trim()) {
            chunks.push({
              content: currentChunk.trim(),
              ord: ord++,
              tokenCount: currentTokens,
            })

            // Keep overlap
            const overlapContent = this.getOverlapContent(currentChunk, overlapTokens)
            currentChunk = overlapContent + '\n\n' + segment
            currentTokens = this.estimateTokens(currentChunk)
          } else {
            currentChunk = segment
            currentTokens = segmentTokens
          }
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + segment
          currentTokens += segmentTokens
        }
      }
    }

    // Flush remaining
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        ord: ord++,
        tokenCount: currentTokens,
      })
    }

    return chunks
  }

  /**
   * Split text into paragraphs (double newline separated)
   */
  private splitIntoParagraphs(text: string): string[] {
    return text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - in production use a better NLP library
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s + '.')
  }

  /**
   * Get overlap content from end of chunk (last N tokens worth)
   */
  private getOverlapContent(chunk: string, overlapTokens: number): string {
    const words = chunk.split(/\s+/)
    // Rough estimate: 1 token ≈ 0.75 words
    const overlapWords = Math.floor(overlapTokens * 0.75)
    const startIdx = Math.max(0, words.length - overlapWords)
    return words.slice(startIdx).join(' ')
  }

  /**
   * Estimate token count for text
   * Rough approximation: 1 token ≈ 4 characters or 0.75 words
   */
  private estimateTokens(text: string): number {
    // Simple estimation - in production use tiktoken library
    const wordCount = text.split(/\s+/).length
    return Math.ceil(wordCount / 0.75)
  }

  /**
   * Chunk a document with metadata preservation
   */
  chunkDocument(
    docId: string,
    title: string,
    content: string,
    metadata?: Record<string, any>,
    options?: ChunkOptions
  ): Array<Chunk & { docId: string; title: string }> {
    const chunks = this.chunk(content, options)

    return chunks.map(chunk => ({
      ...chunk,
      docId,
      title,
      metadata: {
        ...metadata,
        title,
        totalChunks: chunks.length,
      },
    }))
  }
}

// Export singleton
export const chunker = new DocumentChunker()
