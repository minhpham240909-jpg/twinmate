-- Fix "doc_chunk does not exist" error for AI Agent RAG
-- Copy and paste this into Supabase Dashboard → SQL Editor → New Query → Run

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. CREATE doc_source TABLE
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
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own documents" ON doc_source;
CREATE POLICY "Users can create own documents"
  ON doc_source FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own documents" ON doc_source;
CREATE POLICY "Users can update own documents"
  ON doc_source FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own documents" ON doc_source;
CREATE POLICY "Users can delete own documents"
  ON doc_source FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON doc_source TO authenticated;
GRANT ALL ON doc_source TO service_role;

-- ============================================================================
-- 2. CREATE doc_chunk TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS doc_chunk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid REFERENCES doc_source(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  token_count int,
  ord int NOT NULL, -- Order within document
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_chunk_doc ON doc_chunk(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunk_ord ON doc_chunk(doc_id, ord);

-- RLS for doc_chunk (inherits from doc_source)
ALTER TABLE doc_chunk ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view chunks of own documents" ON doc_chunk;
CREATE POLICY "Users can view chunks of own documents"
  ON doc_chunk FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM doc_source
      WHERE doc_source.id = doc_chunk.doc_id
      AND doc_source.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON doc_chunk TO authenticated;
GRANT ALL ON doc_chunk TO service_role;

-- ============================================================================
-- 3. CREATE search_chunks FUNCTION (for vector similarity search)
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
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION search_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION search_chunks TO service_role;

-- ============================================================================
-- SUCCESS!
-- ============================================================================
-- Run this query to verify tables were created:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('doc_source', 'doc_chunk');
