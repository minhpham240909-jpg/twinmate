-- Clerva AI Agent Schema
-- Migration: 20250126000001
-- Description: Complete schema for AI agent with RAG, tools, matching, presence

-- Enable required extensions
create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- ============================================================================
-- USER PROFILE (extends existing auth.users)
-- ============================================================================
create table if not exists profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  grade_level text,
  subjects text[] default '{}',
  goals jsonb default '[]'::jsonb,
  preferences jsonb default '{}'::jsonb,
  learning_style text, -- 'visual', 'auditory', 'kinesthetic', 'reading'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS for profile
alter table profile enable row level security;

create policy "Users can view own profile"
  on profile for select
  using (auth.uid() = user_id);

create policy "Users can update own profile"
  on profile for update
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on profile for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- DOCUMENT SOURCES (uploads, notes, URLs, session transcripts)
-- ============================================================================
create table if not exists doc_source (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  source_type text not null, -- 'upload', 'url', 'note', 'session', 'transcript'
  source_url text,
  file_path text,
  metadata jsonb default '{}'::jsonb,
  status text default 'pending', -- 'pending', 'processing', 'ready', 'error'
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_doc_source_user on doc_source(user_id);
create index idx_doc_source_type on doc_source(source_type);
create index idx_doc_source_status on doc_source(status);

-- RLS for doc_source
alter table doc_source enable row level security;

create policy "Users can view own documents"
  on doc_source for select
  using (auth.uid() = user_id);

create policy "Users can create own documents"
  on doc_source for insert
  with check (auth.uid() = user_id);

create policy "Users can update own documents"
  on doc_source for update
  using (auth.uid() = user_id);

create policy "Users can delete own documents"
  on doc_source for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- DOCUMENT CHUNKS (pgvector embeddings for RAG)
-- ============================================================================
create table if not exists doc_chunk (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid references doc_source(id) on delete cascade,
  content text not null,
  embedding vector(1536), -- OpenAI text-embedding-3-large dimension
  token_count int,
  ord int not null, -- Order within document
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index idx_doc_chunk_doc on doc_chunk(doc_id);
create index idx_doc_chunk_ord on doc_chunk(doc_id, ord);
create index idx_doc_chunk_embedding on doc_chunk using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- RLS for doc_chunk (inherits from doc_source)
alter table doc_chunk enable row level security;

create policy "Users can view chunks of own documents"
  on doc_chunk for select
  using (
    exists (
      select 1 from doc_source
      where doc_source.id = doc_chunk.doc_id
      and doc_source.user_id = auth.uid()
    )
  );

-- ============================================================================
-- AGENT MEMORY (short-term, long-term, preferences)
-- ============================================================================
create table if not exists agent_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  scope text not null, -- 'short', 'long', 'preference', 'context'
  key text not null,
  value jsonb not null,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_agent_memory_user_scope on agent_memory(user_id, scope);
create index idx_agent_memory_key on agent_memory(key);
create index idx_agent_memory_expires on agent_memory(expires_at) where expires_at is not null;

-- RLS for agent_memory
alter table agent_memory enable row level security;

create policy "Users can manage own memory"
  on agent_memory for all
  using (auth.uid() = user_id);

-- ============================================================================
-- FLASHCARDS
-- ============================================================================
create table if not exists flashcard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  front text not null,
  back text not null,
  metadata jsonb default '{}'::jsonb,
  source_doc_id uuid references doc_source(id) on delete set null,
  mastery_level int default 0, -- 0-5 for spaced repetition
  next_review_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_flashcard_user on flashcard(user_id);
create index idx_flashcard_review on flashcard(user_id, next_review_at) where next_review_at is not null;

-- RLS for flashcard
alter table flashcard enable row level security;

create policy "Users can manage own flashcards"
  on flashcard for all
  using (auth.uid() = user_id);

-- ============================================================================
-- QUIZZES
-- ============================================================================
create table if not exists quiz (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  items jsonb not null, -- [{q, choices:[4], answer, explanation, source?}]
  difficulty text, -- 'easy', 'medium', 'hard', 'mixed'
  topic text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index idx_quiz_user on quiz(user_id);
create index idx_quiz_topic on quiz(topic);

-- RLS for quiz
alter table quiz enable row level security;

create policy "Users can manage own quizzes"
  on quiz for all
  using (auth.uid() = user_id);

-- ============================================================================
-- QUIZ ATTEMPTS (track performance)
-- ============================================================================
create table if not exists quiz_attempt (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quiz(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  answers jsonb not null, -- [{itemIndex, selectedAnswer, isCorrect}]
  score numeric, -- 0-100
  time_taken_seconds int,
  created_at timestamptz default now()
);

create index idx_quiz_attempt_user on quiz_attempt(user_id);
create index idx_quiz_attempt_quiz on quiz_attempt(quiz_id);

-- RLS for quiz_attempt
alter table quiz_attempt enable row level security;

create policy "Users can manage own quiz attempts"
  on quiz_attempt for all
  using (auth.uid() = user_id);

-- ============================================================================
-- STUDY PLANS
-- ============================================================================
create table if not exists study_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  goals text[] default '{}',
  time_per_day_min int not null,
  days_per_week int not null,
  deadline timestamptz,
  week_blocks jsonb not null, -- [{week, tasks:[{title,etaMin,link?,completed?}]}]
  status text default 'active', -- 'active', 'paused', 'completed'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_study_plan_user on study_plan(user_id);
create index idx_study_plan_status on study_plan(user_id, status);

-- RLS for study_plan
alter table study_plan enable row level security;

create policy "Users can manage own study plans"
  on study_plan for all
  using (auth.uid() = user_id);

-- ============================================================================
-- LEARNING PROFILE (strengths, weaknesses, analytics)
-- ============================================================================
create table if not exists learning_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  strengths text[] default '{}',
  weaknesses text[] default '{}',
  recommended_focus text[] default '{}',
  analytics jsonb default '{}'::jsonb, -- performance metrics, topic scores
  last_computed_at timestamptz default now(),
  created_at timestamptz default now()
);

-- RLS for learning_profile
alter table learning_profile enable row level security;

create policy "Users can view own learning profile"
  on learning_profile for select
  using (auth.uid() = user_id);

create policy "Users can update own learning profile"
  on learning_profile for update
  using (auth.uid() = user_id);

create policy "Users can insert own learning profile"
  on learning_profile for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- AGENT TASKS (long-running operations, batch jobs)
-- ============================================================================
create table if not exists agent_task (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null, -- 'summarize_session', 'plan_week', 'quiz_gen', 'profile_update'
  status text default 'queued', -- 'queued', 'running', 'done', 'error'
  input jsonb not null,
  output jsonb,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz
);

create index idx_agent_task_user on agent_task(user_id);
create index idx_agent_task_status on agent_task(status);
create index idx_agent_task_kind on agent_task(kind);

-- RLS for agent_task
alter table agent_task enable row level security;

create policy "Users can view own tasks"
  on agent_task for select
  using (auth.uid() = user_id);

-- ============================================================================
-- REALTIME PRESENCE (who's online now)
-- ============================================================================
create table if not exists presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_online boolean default false,
  last_seen timestamptz default now(),
  current_activity text, -- 'idle', 'studying', 'in_session', 'available'
  updated_at timestamptz default now()
);

create index idx_presence_online on presence(is_online) where is_online = true;
create index idx_presence_last_seen on presence(last_seen);

-- RLS for presence (public read for matching, user write)
alter table presence enable row level security;

create policy "Anyone can view presence"
  on presence for select
  using (true);

create policy "Users can update own presence"
  on presence for update
  using (auth.uid() = user_id);

create policy "Users can insert own presence"
  on presence for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- USER AVAILABILITY WINDOWS (for "schedule later" matching)
-- ============================================================================
create table if not exists availability_block (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  dow int not null check (dow >= 0 and dow <= 6), -- 0=Sunday, 6=Saturday
  start_min int not null check (start_min >= 0 and start_min < 1440),
  end_min int not null check (end_min > start_min and end_min <= 1440),
  timezone text not null default 'UTC',
  created_at timestamptz default now()
);

create index idx_availability_user on availability_block(user_id);
create index idx_availability_dow on availability_block(dow);

-- RLS for availability_block (public read for matching, user write)
alter table availability_block enable row level security;

create policy "Anyone can view availability"
  on availability_block for select
  using (true);

create policy "Users can manage own availability"
  on availability_block for all
  using (auth.uid() = user_id);

-- ============================================================================
-- MATCH CANDIDATES CACHE (pre-computed match scores)
-- ============================================================================
create table if not exists match_candidate (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  candidate_id uuid references auth.users(id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 1),
  facets jsonb default '{}'::jsonb, -- {subjects, learningStyle, strengths, etc}
  computed_at timestamptz default now()
);

create index idx_match_candidate_user_score on match_candidate(user_id, score desc);
create index idx_match_candidate_pair on match_candidate(user_id, candidate_id);
create index idx_match_candidate_computed on match_candidate(computed_at);

-- RLS for match_candidate
alter table match_candidate enable row level security;

create policy "Users can view own match candidates"
  on match_candidate for select
  using (auth.uid() = user_id);

-- ============================================================================
-- AGENT TELEMETRY (traces, metrics, costs)
-- ============================================================================
create table if not exists agent_telemetry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  trace_id text,
  event_type text not null, -- 'tool_call', 'llm_call', 'retrieval', 'error'
  tool_name text,
  latency_ms int,
  token_count int,
  cost_usd numeric(10, 6),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index idx_telemetry_user on agent_telemetry(user_id);
create index idx_telemetry_trace on agent_telemetry(trace_id);
create index idx_telemetry_type on agent_telemetry(event_type);
create index idx_telemetry_created on agent_telemetry(created_at);

-- RLS for agent_telemetry (admin only - no user access)
alter table agent_telemetry enable row level security;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to clean up expired memory
create or replace function cleanup_expired_memory()
returns void as $$
begin
  delete from agent_memory
  where expires_at is not null
  and expires_at < now();
end;
$$ language plpgsql security definer;

-- Function to update presence timestamp
create or replace function update_presence_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger presence_updated_at
  before update on presence
  for each row
  execute function update_presence_timestamp();

-- Function to compute match score (placeholder - implement in app)
create or replace function compute_match_score(
  user1_id uuid,
  user2_id uuid
)
returns numeric as $$
declare
  score numeric := 0.5;
begin
  -- Placeholder: implement actual matching logic in app layer
  -- This would analyze subjects overlap, learning style compatibility, etc.
  return score;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table profile is 'Extended user profile for AI agent personalization';
comment on table doc_source is 'User-uploaded documents, notes, URLs for RAG';
comment on table doc_chunk is 'Chunked document content with vector embeddings for semantic search';
comment on table agent_memory is 'Short/long-term memory for contextual conversations';
comment on table flashcard is 'User flashcards for spaced repetition';
comment on table quiz is 'AI-generated quizzes from user content';
comment on table study_plan is 'Personalized study plans with weekly task breakdown';
comment on table learning_profile is 'Computed strengths, weaknesses, and analytics';
comment on table agent_task is 'Long-running AI operations (summarize, quiz gen, etc)';
comment on table presence is 'Real-time online status for partner matching';
comment on table availability_block is 'User availability windows for scheduling';
comment on table match_candidate is 'Pre-computed partner match scores';
comment on table agent_telemetry is 'Performance and cost telemetry for monitoring';
