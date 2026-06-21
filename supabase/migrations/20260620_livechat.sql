-- Live-chat assistant — conversation logging + lead capture
--
-- All writes happen from the `livechat-service` edge function using the service
-- role key. RLS is enabled and no anon/authenticated policy is granted, so the
-- anon key (and any browser session) cannot read or write these tables.
--
-- Apply manually via the Supabase SQL editor or `supabase db push`. Safe to
-- re-run: every create uses `if not exists`.

create extension if not exists "pgcrypto";

-- ─── conversations ────────────────────────────────────────────────────────
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  page_url text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists chat_conversations_session_id_idx
  on public.chat_conversations (session_id);

create index if not exists chat_conversations_last_message_at_idx
  on public.chat_conversations (last_message_at desc);

-- ─── messages ─────────────────────────────────────────────────────────────
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_id_created_at_idx
  on public.chat_messages (conversation_id, created_at);

-- ─── leads ────────────────────────────────────────────────────────────────
create table if not exists public.chat_leads (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.chat_conversations(id) on delete set null,
  name text,
  email text,
  project text,
  source text not null default 'livechat',
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

create index if not exists chat_leads_email_idx on public.chat_leads (email);
create index if not exists chat_leads_created_at_idx on public.chat_leads (created_at desc);

-- ─── RLS — locked down to service role only ───────────────────────────────
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_leads enable row level security;

-- No policies are created. With RLS enabled and no grants, the anon and
-- authenticated roles cannot read or write these tables. The service role
-- bypasses RLS by design, so the edge function continues to work.
