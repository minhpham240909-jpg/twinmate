/**
 * Admin API: Create Document Tables for RAG
 * POST /api/admin/create-doc-tables
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Simple auth check (same as migrate-ai-tables)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CLEANUP_API_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Enable pgvector extension
    console.log('Enabling pgvector extension...')
    const { error: extError } = await supabase.rpc('exec_sql', {
      sql_string: 'CREATE EXTENSION IF NOT EXISTS vector;',
    })
    if (extError) {
      console.warn('Extension may already exist:', extError)
    }

    // Step 2: Create doc_source table
    console.log('Creating doc_source table...')
    const createDocSource = `
      CREATE TABLE IF NOT EXISTS doc_source (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
        title text NOT NULL,
        source_type text NOT NULL,
        source_url text,
        file_path text,
        metadata jsonb DEFAULT '{}'::jsonb,
        status text DEFAULT 'pending',
        error_message text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_doc_source_user ON doc_source(user_id);
      CREATE INDEX IF NOT EXISTS idx_doc_source_type ON doc_source(source_type);
      CREATE INDEX IF NOT EXISTS idx_doc_source_status ON doc_source(status);

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
    `

    const { error: docSourceError } = await supabase.rpc('exec_sql', {
      sql_string: createDocSource,
    })

    if (docSourceError) {
      console.error('Error creating doc_source:', docSourceError)
    }

    // Step 3: Create doc_chunk table
    console.log('Creating doc_chunk table...')
    const createDocChunk = `
      CREATE TABLE IF NOT EXISTS doc_chunk (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        doc_id uuid REFERENCES doc_source(id) ON DELETE CASCADE,
        content text NOT NULL,
        embedding vector(1536),
        token_count int,
        ord int NOT NULL,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_doc_chunk_doc ON doc_chunk(doc_id);
      CREATE INDEX IF NOT EXISTS idx_doc_chunk_ord ON doc_chunk(doc_id, ord);

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
    `

    const { error: docChunkError } = await supabase.rpc('exec_sql', {
      sql_string: createDocChunk,
    })

    if (docChunkError) {
      console.error('Error creating doc_chunk:', docChunkError)
    }

    // Step 4: Create search_chunks function
    console.log('Creating search_chunks function...')
    const createSearchFunction = `
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

      GRANT EXECUTE ON FUNCTION search_chunks TO authenticated;
      GRANT EXECUTE ON FUNCTION search_chunks TO service_role;
    `

    const { error: functionError } = await supabase.rpc('exec_sql', {
      sql_string: createSearchFunction,
    })

    if (functionError) {
      console.error('Error creating search function:', functionError)
    }

    // Check if tables were created successfully
    const { error: checkDocSource } = await supabase
      .from('doc_source')
      .select('id')
      .limit(1)

    const { error: checkDocChunk } = await supabase
      .from('doc_chunk')
      .select('id')
      .limit(1)

    const tablesCreated = {
      doc_source: !checkDocSource,
      doc_chunk: !checkDocChunk,
    }

    if (docSourceError || docChunkError || functionError) {
      return NextResponse.json({
        success: false,
        message: 'Some operations had errors (may already exist)',
        errors: {
          doc_source: docSourceError?.message,
          doc_chunk: docChunkError?.message,
          search_function: functionError?.message,
        },
        tablesCreated,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Document tables and search function created successfully',
      tablesCreated,
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST with Bearer token to create document tables',
    usage: 'curl -X POST http://localhost:3000/api/admin/create-doc-tables -H "Authorization: Bearer YOUR_KEY"',
  })
}
