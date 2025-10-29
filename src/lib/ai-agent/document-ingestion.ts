/**
 * Document Ingestion Pipeline
 * Handles file upload → chunk → embed → store workflow
 */

import { createClient } from '@supabase/supabase-js'
import { DocumentChunker } from '@/../packages/ai-agent/src/rag/chunker'
import { OpenAIEmbeddingProvider } from '@/../packages/ai-agent/src/rag/embeddings'
import { VectorRetriever } from '@/../packages/ai-agent/src/rag/retriever'
import mammoth from 'mammoth'

export interface IngestDocumentOptions {
  userId: string
  file: File
  metadata?: {
    courseId?: string
    topic?: string
    source?: string
    [key: string]: any
  }
}

export interface IngestDocumentResult {
  docId: string
  status: 'processing' | 'ready' | 'error'
  chunksCreated: number
  error?: string
}

/**
 * Ingest a document: extract text, chunk, embed, and store
 */
export async function ingestDocument(
  options: IngestDocumentOptions
): Promise<IngestDocumentResult> {
  const { userId, file, metadata = {} } = options

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const openaiApiKey = process.env.OPENAI_API_KEY!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Upload file to Supabase Storage
    const fileName = `${userId}/${Date.now()}_${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file)

    if (uploadError) {
      throw new Error(`File upload failed: ${uploadError.message}`)
    }

    // 2. Extract text from file
    const text = await extractTextFromFile(file)

    if (!text || text.trim().length === 0) {
      throw new Error('No text content found in file')
    }

    // 3. Create doc_source record
    const { data: docSource, error: docError } = await supabase
      .from('doc_source')
      .insert({
        user_id: userId,
        title: file.name,
        content_type: file.type,
        source_type: 'upload',
        status: 'processing',
        metadata: {
          ...metadata,
          fileName: file.name,
          fileSize: file.size,
          storagePath: uploadData.path,
        },
      })
      .select('id')
      .single()

    if (docError || !docSource) {
      throw new Error(`Failed to create doc_source: ${docError?.message}`)
    }

    const docId = docSource.id

    // 4. Chunk the document
    const chunker = new DocumentChunker()
    const chunks = chunker.chunk(text, {
      maxTokens: 500,
      overlapTokens: 100,
    })

    // 5. Embed and store chunks
    const embeddingProvider = new OpenAIEmbeddingProvider(openaiApiKey)
    const retriever = new VectorRetriever(supabaseUrl, supabaseServiceKey, embeddingProvider)

    await retriever.ingest(userId, docId, chunks)

    // 6. Update doc_source status to ready
    await supabase
      .from('doc_source')
      .update({ status: 'ready' })
      .eq('id', docId)

    return {
      docId,
      status: 'ready',
      chunksCreated: chunks.length,
    }
  } catch (error) {
    console.error('Document ingestion error:', error)
    return {
      docId: '',
      status: 'error',
      chunksCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Extract text from different file types
 */
async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type

  // Plain text
  if (fileType === 'text/plain' || fileType === 'text/markdown') {
    return await file.text()
  }

  // PDF
  if (fileType === 'application/pdf') {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      // Dynamic import for ESM module
      const pdfParse = await import('pdf-parse')
      const data = await (pdfParse as any)(buffer)
      return data.text
    } catch (error) {
      console.error('PDF parsing error:', error)
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Word documents
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileType === 'application/msword'
  ) {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    } catch (error) {
      console.error('Word document parsing error:', error)
      throw new Error(`Failed to extract text from Word document: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // JSON
  if (fileType === 'application/json') {
    const jsonContent = await file.text()
    return JSON.stringify(JSON.parse(jsonContent), null, 2)
  }

  // Fallback: try to read as text
  try {
    return await file.text()
  } catch (error) {
    throw new Error(`Unsupported file type: ${fileType}`)
  }
}

/**
 * Background job version - for processing large documents
 */
export async function enqueueDocumentIngestion(
  options: IngestDocumentOptions
): Promise<{ taskId: string }> {
  const { userId, file, metadata = {} } = options

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Create agent_task for background processing
  const { data: task, error } = await supabase
    .from('agent_task')
    .insert({
      user_id: userId,
      task_type: 'document_ingestion',
      status: 'queued',
      input: {
        fileName: file.name,
        fileSize: file.size,
        metadata,
      },
    })
    .select('id')
    .single()

  if (error || !task) {
    throw new Error(`Failed to create background task: ${error?.message}`)
  }

  // In production, this would trigger a background worker
  // For now, process immediately
  setTimeout(async () => {
    await ingestDocument(options)
    await supabase
      .from('agent_task')
      .update({ status: 'done' })
      .eq('id', task.id)
  }, 0)

  return { taskId: task.id }
}
