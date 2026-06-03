-- Phase 2 pivot: agent runtime moves to local daemon via Claude Code Max.
-- Drops the embeddings dependency (no more OpenAI). Memory search becomes
-- trigram-based. Adds streaming status to sunday_messages so the browser
-- can render the agent's response as it streams via Realtime.

begin;

-- Trigram extension for fuzzy text similarity.
create extension if not exists pg_trgm;

-- GIN trigram index on memory content.
create index if not exists sunday_memories_content_trgm_idx
  on public.sunday_memories
  using gin (content gin_trgm_ops);

-- Replace embedding-based RPC with trigram similarity.
drop function if exists public.sunday_match_memories(vector, integer, uuid, text[]);

create or replace function public.sunday_match_memories(
  query_text text,
  match_count integer default 8,
  filter_user uuid default null,
  filter_kinds text[] default null
)
returns table (
  id uuid,
  kind text,
  content text,
  confidence numeric,
  similarity float,
  created_at timestamptz
)
language plpgsql
security definer
as $$
begin
  return query
  select
    m.id,
    m.kind,
    m.content,
    m.confidence,
    similarity(m.content, query_text) as similarity,
    m.created_at
  from public.sunday_memories m
  where
    (filter_user is null or m.user_id = filter_user)
    and (filter_kinds is null or m.kind = any(filter_kinds))
    and (m.content % query_text or m.content ilike '%' || query_text || '%')
  order by similarity(m.content, query_text) desc, m.created_at desc
  limit match_count;
end;
$$;

grant execute on function public.sunday_match_memories(text, integer, uuid, text[]) to authenticated, service_role;

-- Streaming state on chat messages.
alter table public.sunday_messages
  add column if not exists status text
    check (status in ('pending', 'streaming', 'complete', 'error')),
  add column if not exists error text;

create index if not exists sunday_messages_pending_user_idx
  on public.sunday_messages (user_id, created_at)
  where status = 'pending';

-- Make sunday_messages eligible for Supabase Realtime broadcast.
-- The publication may already include it; alter is idempotent here.
do $$ begin
  alter publication supabase_realtime add table public.sunday_messages;
exception when duplicate_object then null;
end $$;

commit;
