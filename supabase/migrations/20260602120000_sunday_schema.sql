-- Sunday schema — Phase 1 foundation.
-- See docs/superpowers/specs/2026-06-02-sunday-design.md for design rationale.
-- All tables are user-scoped via RLS. All mutations from the frontend flow
-- through edge functions; RLS guards against accidental direct-client writes.

begin;

-- pgvector powers semantic recall on sunday_memories.
create extension if not exists vector;

-- Touch helper for updated_at columns.
create or replace function public.sunday_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Conversation containers.
create table public.sunday_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

-- Individual turns. role is one of user | assistant | tool.
-- Audio is NOT persisted in v1 by design (privacy, storage cost).
create table public.sunday_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.sunday_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text,
  tool_calls jsonb,
  tool_results jsonb,
  created_at timestamptz not null default now()
);

-- Semantic memory: extracted entities + embeddings.
-- Embedding dim = 1536 (OpenAI text-embedding-3-small).
create table public.sunday_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('person', 'project', 'decision', 'preference', 'fact')),
  content text not null,
  embedding vector(1536),
  source_message_id uuid references public.sunday_messages(id) on delete set null,
  confidence numeric not null default 0.8 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sunday_memories_set_updated_at
  before update on public.sunday_memories
  for each row execute function public.sunday_set_updated_at();

-- Web dev projects Sunday is aware of.
create table public.sunday_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  repo_path text,
  client text,
  stack text,
  notes text,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sunday_projects_set_updated_at
  before update on public.sunday_projects
  for each row execute function public.sunday_set_updated_at();

-- Task ledger. Tasks may be loose (no project) or scoped to a project.
create table public.sunday_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.sunday_projects(id) on delete set null,
  title text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'snoozed', 'done', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  due timestamptz,
  snooze_until timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sunday_tasks_set_updated_at
  before update on public.sunday_tasks
  for each row execute function public.sunday_set_updated_at();

-- Nightly synthesis written by sunday-synthesize cron job.
create table public.sunday_syntheses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  summary text,
  themes jsonb,
  accomplishments jsonb,
  pending jsonb,
  queued_for_tomorrow jsonb,
  surprises jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- Audit log of every tool the agent invoked, with timing + errors.
create table public.sunday_tool_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.sunday_messages(id) on delete cascade,
  tool_name text not null,
  input jsonb,
  output jsonb,
  error text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

-- Claude Code dispatch queue. The local daemon polls / subscribes to this.
create table public.sunday_code_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.sunday_projects(id) on delete set null,
  brief text not null,
  context jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  result_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Streaming logs from a Claude Code run. One row per emitted line.
create table public.sunday_code_logs (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.sunday_code_queue(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stream text not null check (stream in ('stdout', 'stderr', 'meta')),
  line text not null,
  created_at timestamptz not null default now()
);

-- Cached snapshot of Home Assistant entities. Refreshed periodically.
-- entity_id is globally unique within HA, but we still key by (user_id, entity_id)
-- to keep RLS clean and allow multi-user later.
create table public.sunday_ha_entities (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_id text not null,
  friendly_name text,
  domain text,
  state text,
  attributes jsonb,
  last_refreshed_at timestamptz not null default now(),
  primary key (user_id, entity_id)
);

-- Scheduled reminders. A cron job (or pg_cron) fires these at fire_at.
create table public.sunday_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  project_id uuid references public.sunday_projects(id) on delete set null,
  fire_at timestamptz not null,
  fired_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'fired', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Recent context lookups: most queries scan messages by conversation, newest first.
create index sunday_messages_conversation_created_idx
  on public.sunday_messages (conversation_id, created_at desc);

-- All-user message scan by recency (for daily synthesis).
create index sunday_messages_user_created_idx
  on public.sunday_messages (user_id, created_at desc);

-- Semantic search. IVFFlat with cosine distance is the default for embedding search.
-- lists=100 is a reasonable starting point for low-volume single-user; revisit if scale grows.
create index sunday_memories_embedding_idx
  on public.sunday_memories
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Memory filter by kind (e.g. "give me all the people memories").
create index sunday_memories_user_kind_idx
  on public.sunday_memories (user_id, kind);

-- Task list queries: by user, status, due.
create index sunday_tasks_user_status_due_idx
  on public.sunday_tasks (user_id, status, due);

-- Project lookup by status.
create index sunday_projects_user_status_idx
  on public.sunday_projects (user_id, status);

-- Synthesis by date (Today view).
create index sunday_syntheses_user_date_idx
  on public.sunday_syntheses (user_id, date desc);

-- Tool call audit: recent calls per user.
create index sunday_tool_calls_user_created_idx
  on public.sunday_tool_calls (user_id, created_at desc);

-- Dispatch queue: daemon scans for pending work.
create index sunday_code_queue_status_idx
  on public.sunday_code_queue (status, created_at);

-- Streaming logs: ordered fetch per dispatch.
create index sunday_code_logs_dispatch_created_idx
  on public.sunday_code_logs (dispatch_id, created_at);

-- Reminders: due-soon scan.
create index sunday_reminders_status_fire_at_idx
  on public.sunday_reminders (status, fire_at);

-- Enable RLS on every sunday_* table.
alter table public.sunday_conversations enable row level security;
alter table public.sunday_messages       enable row level security;
alter table public.sunday_memories       enable row level security;
alter table public.sunday_projects       enable row level security;
alter table public.sunday_tasks          enable row level security;
alter table public.sunday_syntheses      enable row level security;
alter table public.sunday_tool_calls     enable row level security;
alter table public.sunday_code_queue     enable row level security;
alter table public.sunday_code_logs      enable row level security;
alter table public.sunday_ha_entities    enable row level security;
alter table public.sunday_reminders      enable row level security;

-- SELECT: owner only. Edge functions using the service role bypass RLS,
-- so this is purely about anon/authenticated client reads.
create policy sunday_conversations_select_own
  on public.sunday_conversations for select
  using (auth.uid() = user_id);

create policy sunday_messages_select_own
  on public.sunday_messages for select
  using (auth.uid() = user_id);

create policy sunday_memories_select_own
  on public.sunday_memories for select
  using (auth.uid() = user_id);

create policy sunday_projects_select_own
  on public.sunday_projects for select
  using (auth.uid() = user_id);

create policy sunday_tasks_select_own
  on public.sunday_tasks for select
  using (auth.uid() = user_id);

create policy sunday_syntheses_select_own
  on public.sunday_syntheses for select
  using (auth.uid() = user_id);

create policy sunday_tool_calls_select_own
  on public.sunday_tool_calls for select
  using (auth.uid() = user_id);

create policy sunday_code_queue_select_own
  on public.sunday_code_queue for select
  using (auth.uid() = user_id);

create policy sunday_code_logs_select_own
  on public.sunday_code_logs for select
  using (auth.uid() = user_id);

create policy sunday_ha_entities_select_own
  on public.sunday_ha_entities for select
  using (auth.uid() = user_id);

create policy sunday_reminders_select_own
  on public.sunday_reminders for select
  using (auth.uid() = user_id);

-- INSERT: owner only (writer must set user_id = auth.uid()).
create policy sunday_conversations_insert_own
  on public.sunday_conversations for insert
  with check (auth.uid() = user_id);

create policy sunday_messages_insert_own
  on public.sunday_messages for insert
  with check (auth.uid() = user_id);

create policy sunday_memories_insert_own
  on public.sunday_memories for insert
  with check (auth.uid() = user_id);

create policy sunday_projects_insert_own
  on public.sunday_projects for insert
  with check (auth.uid() = user_id);

create policy sunday_tasks_insert_own
  on public.sunday_tasks for insert
  with check (auth.uid() = user_id);

create policy sunday_syntheses_insert_own
  on public.sunday_syntheses for insert
  with check (auth.uid() = user_id);

create policy sunday_tool_calls_insert_own
  on public.sunday_tool_calls for insert
  with check (auth.uid() = user_id);

create policy sunday_code_queue_insert_own
  on public.sunday_code_queue for insert
  with check (auth.uid() = user_id);

create policy sunday_code_logs_insert_own
  on public.sunday_code_logs for insert
  with check (auth.uid() = user_id);

create policy sunday_ha_entities_insert_own
  on public.sunday_ha_entities for insert
  with check (auth.uid() = user_id);

create policy sunday_reminders_insert_own
  on public.sunday_reminders for insert
  with check (auth.uid() = user_id);

-- UPDATE: owner only, must keep user_id = auth.uid().
create policy sunday_conversations_update_own
  on public.sunday_conversations for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy sunday_messages_update_own
  on public.sunday_messages for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy sunday_memories_update_own
  on public.sunday_memories for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy sunday_projects_update_own
  on public.sunday_projects for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy sunday_tasks_update_own
  on public.sunday_tasks for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy sunday_code_queue_update_own
  on public.sunday_code_queue for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy sunday_ha_entities_update_own
  on public.sunday_ha_entities for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy sunday_reminders_update_own
  on public.sunday_reminders for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DELETE: owner only.
create policy sunday_conversations_delete_own
  on public.sunday_conversations for delete
  using (auth.uid() = user_id);

create policy sunday_messages_delete_own
  on public.sunday_messages for delete
  using (auth.uid() = user_id);

create policy sunday_memories_delete_own
  on public.sunday_memories for delete
  using (auth.uid() = user_id);

create policy sunday_projects_delete_own
  on public.sunday_projects for delete
  using (auth.uid() = user_id);

create policy sunday_tasks_delete_own
  on public.sunday_tasks for delete
  using (auth.uid() = user_id);

create policy sunday_tool_calls_delete_own
  on public.sunday_tool_calls for delete
  using (auth.uid() = user_id);

create policy sunday_code_queue_delete_own
  on public.sunday_code_queue for delete
  using (auth.uid() = user_id);

create policy sunday_code_logs_delete_own
  on public.sunday_code_logs for delete
  using (auth.uid() = user_id);

create policy sunday_ha_entities_delete_own
  on public.sunday_ha_entities for delete
  using (auth.uid() = user_id);

create policy sunday_reminders_delete_own
  on public.sunday_reminders for delete
  using (auth.uid() = user_id);

commit;
