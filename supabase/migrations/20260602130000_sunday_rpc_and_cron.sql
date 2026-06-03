-- Sunday — Phase 1.5: RPC functions, pg_cron schedules, edge-function settings.
-- Depends on 20260602120000_sunday_schema.sql.

begin;

-- ----------------------------------------------------------------------------
-- Semantic memory search RPC. Returns top-K memories scored by cosine similarity.
-- Used by the memory_search tool and the agent loop's automatic memory recall.
-- ----------------------------------------------------------------------------
create or replace function public.sunday_match_memories(
  query_embedding vector(1536),
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
    1 - (m.embedding <=> query_embedding) as similarity,
    m.created_at
  from public.sunday_memories m
  where
    (filter_user is null or m.user_id = filter_user)
    and (filter_kinds is null or m.kind = any(filter_kinds))
    and m.embedding is not null
  order by m.embedding <=> query_embedding
  limit match_count;
end;
$$;

grant execute on function public.sunday_match_memories(vector, integer, uuid, text[]) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Wake reminders RPC — flips pending reminders to fired when fire_at <= now().
-- Called by pg_cron every minute.
-- ----------------------------------------------------------------------------
create or replace function public.sunday_fire_due_reminders()
returns integer
language plpgsql
security definer
as $$
declare
  fired_count integer;
begin
  update public.sunday_reminders
  set status = 'fired', fired_at = now()
  where status = 'pending'
    and fire_at <= now();
  get diagnostics fired_count = row_count;
  return fired_count;
end;
$$;

grant execute on function public.sunday_fire_due_reminders() to service_role;

-- ----------------------------------------------------------------------------
-- pg_cron + pg_net for scheduled edge function invocations.
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net   with schema extensions;

-- Helper: post a JSON body to a Sunday edge function with the cron secret header.
-- Reads SUPABASE_URL and SUNDAY_CRON_SECRET from vault (set via Supabase secrets UI).
-- For simplicity in v1, we accept the secret being passed in via settings.
create or replace function public.sunday_invoke_edge(fn_name text, payload jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
as $$
declare
  url text;
  secret text;
  req_id bigint;
begin
  -- Project-ref-derived URL; configured once via:
  --   alter database postgres set app.settings.sunday_functions_base = 'https://<ref>.supabase.co/functions/v1';
  url := current_setting('app.settings.sunday_functions_base', true);
  secret := current_setting('app.settings.sunday_cron_secret', true);
  if url is null or url = '' then
    raise exception 'app.settings.sunday_functions_base is not set';
  end if;

  select net.http_post(
    url      := url || '/' || fn_name,
    headers  := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sunday-cron-secret', coalesce(secret, '')
    ),
    body     := payload
  ) into req_id;

  return req_id;
end;
$$;

grant execute on function public.sunday_invoke_edge(text, jsonb) to service_role;

-- Nightly synthesis — fires at 04:00 UTC (≈ 11pm CT / 10pm CST depending on DST).
-- Sunday's nightly job is best-effort idempotent (upserts by user_id + date).
select cron.schedule(
  'sunday-nightly-synthesize',
  '0 4 * * *',
  $$select public.sunday_invoke_edge('sunday-synthesize', '{}'::jsonb);$$
);

-- Every-minute reminder check (cheap, just flips statuses).
select cron.schedule(
  'sunday-fire-reminders',
  '* * * * *',
  $$select public.sunday_fire_due_reminders();$$
);

commit;
