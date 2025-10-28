-- Create document tables and search function for AI agent RAG
-- Run this with: psql connection_string -f create_doc_tables_and_search.sql

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- DOCUMENT SOURCES (uploads, notes, URLs, session transcripts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS doc_source (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  source_type text NOT NULL, -- 'upload', 'url', 'note', 'session', 'transcript'
  source_url text,
  file_path text,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending', -- 'pending', 'processing', 'ready', 'error'
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_source_user ON doc_source(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_source_type ON doc_source(source_type);
CREATE INDEX IF NOT EXISTS idx_doc_source_status ON doc_source(status);

-- RLS for doc_source
ALTER TABLE doc_source ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own documents" ON doc_source;
CREATE POLICY "Users can view own documents"
  ON doc_source FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own documents" ON doc_source;
CREATE POLICY "Users can create own documents"
  ON doc_source FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own documents" ON doc_source;
CREATE POLICY "Users can update own documents"
  ON doc_source FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own documents" ON doc_source;
CREATE POLICY "Users can delete own documents"
  ON doc_source FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- DOCUMENT CHUNKS (pgvector embeddings for RAG)
-- ============================================================================
CREATE TABLE IF NOT EXISTS doc_chunk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid REFERENCES doc_source(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-large dimension
  token_count int,
  ord int NOT NULL, -- Order within document
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_chunk_doc ON doc_chunk(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunk_ord ON doc_chunk(doc_id, ord);

-- Create vector index ONLY if table has data (prevents error on empty table)
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM doc_chunk) > 0 THEN
    CREATE INDEX IF NOT EXISTS idx_doc_chunk_embedding
      ON doc_chunk USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
END $$;

-- RLS for doc_chunk (inherits from doc_source)
ALTER TABLE doc_chunk ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view chunks of own documents" ON doc_chunk;
CREATE POLICY "Users can view chunks of own documents"
  ON doc_chunk FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM doc_source
      WHERE doc_source.id = doc_chunk.doc_id
      AND doc_source.user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON doc_source TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON doc_chunk TO authenticated;
GRANT ALL ON doc_source TO service_role;
GRANT ALL ON doc_chunk TO service_role;

-- ============================================================================
-- VECTOR SEARCH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION search_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  doc_id uuid,
  ord int,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.doc_id,
    dc.ord,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM doc_chunk dc
  INNER JOIN doc_source ds ON dc.doc_id = ds.id
  WHERE ds.user_id = p_user_id
    AND ds.status = 'ready'
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission on search function
GRANT EXECUTE ON FUNCTION search_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION search_chunks TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully created doc_source, doc_chunk tables and search_chunks function';
END $$;
