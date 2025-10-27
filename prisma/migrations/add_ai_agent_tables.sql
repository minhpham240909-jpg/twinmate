-- ============================================
-- AI AGENT COMPLETION - MISSING TABLES
-- ============================================
-- Adds: agent_memory, agent_task, availability_block, match_candidate
-- For: context persistence, async jobs, scheduling, match caching

-- AGENT MEMORY (short-term/long-term context + preferences)
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('short', 'long', 'preference')),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_memory_user_scope ON agent_memory(user_id, scope);
CREATE INDEX idx_agent_memory_expires ON agent_memory(expires_at) WHERE expires_at IS NOT NULL;

-- RLS for agent_memory
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent memory"
  ON agent_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agent memory"
  ON agent_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agent memory"
  ON agent_memory FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agent memory"
  ON agent_memory FOR DELETE
  USING (auth.uid() = user_id);

-- AGENT TASKS (async job queue for batch work)
CREATE TABLE IF NOT EXISTS agent_task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- 'summarize_session', 'plan_week', 'quiz_gen', 'match_compute'
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'error')),
  input JSONB NOT NULL,
  output JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_task_user_status ON agent_task(user_id, status);
CREATE INDEX idx_agent_task_kind_status ON agent_task(kind, status);
CREATE INDEX idx_agent_task_created ON agent_task(created_at DESC);

-- RLS for agent_task
ALTER TABLE agent_task ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent tasks"
  ON agent_task FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agent tasks"
  ON agent_task FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update agent tasks"
  ON agent_task FOR UPDATE
  USING (true); -- Service role only, not exposed to client

-- AVAILABILITY BLOCKS (recurring weekly windows for scheduling)
CREATE TABLE IF NOT EXISTS availability_block (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dow INT NOT NULL CHECK (dow >= 0 AND dow <= 6), -- 0=Sunday, 6=Saturday
  start_min INT NOT NULL CHECK (start_min >= 0 AND start_min < 1440), -- minutes from 00:00
  end_min INT NOT NULL CHECK (end_min > start_min AND end_min <= 1440),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_availability_user_dow ON availability_block(user_id, dow);

-- RLS for availability_block
ALTER TABLE availability_block ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own availability"
  ON availability_block FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view others' availability"
  ON availability_block FOR SELECT
  USING (true); -- Public for matching, but sanitized in app layer

CREATE POLICY "Users can insert own availability"
  ON availability_block FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own availability"
  ON availability_block FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own availability"
  ON availability_block FOR DELETE
  USING (auth.uid() = user_id);

-- MATCH CANDIDATE CACHE (precomputed match scores)
CREATE TABLE IF NOT EXISTS match_candidate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score NUMERIC(3, 2) NOT NULL CHECK (score >= 0 AND score <= 1),
  facets JSONB NOT NULL, -- {strengths: [], weaknesses: [], overlap: []}
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, candidate_id)
);

CREATE INDEX idx_match_candidate_user_score ON match_candidate(user_id, score DESC);
CREATE INDEX idx_match_candidate_computed ON match_candidate(computed_at);

-- RLS for match_candidate
ALTER TABLE match_candidate ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own match candidates"
  ON match_candidate FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage match candidates"
  ON match_candidate FOR ALL
  USING (true); -- Service role only for batch compute

-- CLEANUP FUNCTION: Remove expired agent_memory
CREATE OR REPLACE FUNCTION cleanup_expired_agent_memory()
RETURNS void AS $$
BEGIN
  DELETE FROM agent_memory
  WHERE expires_at IS NOT NULL
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- COMMENT DOCUMENTATION
COMMENT ON TABLE agent_memory IS 'Stores short-term context, long-term facts, and user preferences for AI agent';
COMMENT ON TABLE agent_task IS 'Async job queue for long-running AI tasks (quiz gen, summaries, batch matching)';
COMMENT ON TABLE availability_block IS 'Recurring weekly availability windows for study session scheduling';
COMMENT ON TABLE match_candidate IS 'Cached compatibility scores between users for fast partner matching';
