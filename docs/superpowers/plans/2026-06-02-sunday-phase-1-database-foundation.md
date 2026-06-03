# Sunday — Phase 1: Database & RLS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land all `sunday_*` tables, indexes, and RLS policies in the taylorurl-com Supabase project, with verification that the schema is correct and RLS isolates rows by `user_id`. Nothing in this plan ships UI — it's the foundation Phase 2+ builds on.

**Architecture:** One Supabase migration file under `supabase/migrations/` containing the entire Sunday schema in a single transaction. Tables prefixed `sunday_`. Vector column on `sunday_memories` for semantic recall (pgvector). RLS on every table, scoped via `auth.uid() = user_id`. Mutations from the frontend will all flow through edge functions (Phase 2+); RLS protects against accidental misuse and direct-from-client mistakes.

**Tech Stack:** PostgreSQL 15 (Supabase) · pgvector · Supabase CLI (via `npx supabase`) · SQL

**Reference spec:** `docs/superpowers/specs/2026-06-02-sunday-design.md` — sections 13 (data model) and 14 (access control).

**Git workflow:** Per project conventions, commits happen via the `/release` skill only, and only when the user explicitly asks. This plan does NOT include direct `git commit` commands. Instead, completion of a logical group is marked with a checkpoint where the user can choose to invoke `/release` to commit progress.

---

## Pre-flight

These checks happen once before Task 1. If anything fails, stop and resolve before continuing.

- [ ] **Confirm working directory**

Run: `pwd`
Expected: `/Users/trentontaylor/WebstormProjects/taylorurl-com`

- [ ] **Confirm Supabase CLI is reachable**

Run:
```bash
PATH="/Users/trentontaylor/.nvm/versions/node/v22.21.1/bin:$PATH" npx supabase --version
```
Expected: a version string (e.g. `1.x.x` or `2.x.x`). If not, install per Supabase docs.

- [ ] **Capture the project ref**

Ask the user for the Supabase project ref (the subdomain of their Supabase URL). Store it as `SUPABASE_PROJECT_REF` for the rest of this plan. Example: if the URL is `https://abcdefghijklmnop.supabase.co`, the ref is `abcdefghijklmnop`.

- [ ] **Link the project**

Run:
```bash
PATH="/Users/trentontaylor/.nvm/versions/node/v22.21.1/bin:$PATH" npx supabase link --project-ref <SUPABASE_PROJECT_REF>
```
Expected: "Finished supabase link." Confirms the local CLI talks to the remote project.

- [ ] **Inventory existing migrations**

Run:
```bash
PATH="/Users/trentontaylor/.nvm/versions/node/v22.21.1/bin:$PATH" npx supabase migration list --linked
```
Expected: prints a table of local vs remote migrations. Note any rows where Local and Remote diverge — this plan only adds a new migration and should not touch the existing ones.

---

## Task 1: Create the migration scaffold

**Files:**
- Create: `supabase/migrations/20260602120000_sunday_schema.sql`

The Supabase CLI conventionally names migrations with a UTC timestamp prefix. We use a fixed timestamp here so the filename is deterministic across runs.

- [ ] **Step 1: Create the migrations directory if missing**

Run:
```bash
mkdir -p /Users/trentontaylor/WebstormProjects/taylorurl-com/supabase/migrations
```

- [ ] **Step 2: Create the migration file with the header**

Write to `supabase/migrations/20260602120000_sunday_schema.sql`:

```sql
-- Sunday schema — Phase 1 foundation.
-- See docs/superpowers/specs/2026-06-02-sunday-design.md for design rationale.
-- All tables are user-scoped via RLS. All mutations from the frontend flow
-- through edge functions; RLS guards against accidental direct-client writes.

begin;
```

- [ ] **Step 3: Verify the file exists and is syntactically minimal SQL**

Run:
```bash
PATH="/Users/trentontaylor/.nvm/versions/node/v22.21.1/bin:$PATH" \
  npx supabase db lint --schema public --linked 2>&1 | head -20
```
Expected: no errors (the migration is empty so far, but the lint should pick up the file without complaint).

The migration is intentionally incomplete (no `commit;` yet) — every subsequent task appends to this file, and we close the transaction at the end of Task 11.

---

## Task 2: Enable pgvector and add the `set_updated_at` trigger function

**Files:**
- Modify: `supabase/migrations/20260602120000_sunday_schema.sql` (append)

pgvector powers semantic memory recall. The `set_updated_at` function gets reused across every table that has an `updated_at` column.

- [ ] **Step 1: Append the extension and helper function**

Append to `supabase/migrations/20260602120000_sunday_schema.sql`:

```sql
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
```

- [ ] **Step 2: Verify the file is well-formed so far**

Run:
```bash
wc -l /Users/trentontaylor/WebstormProjects/taylorurl-com/supabase/migrations/20260602120000_sunday_schema.sql
```
Expected: roughly 18–22 lines.

---

## Task 3: Add conversations and messages tables

**Files:**
- Modify: `supabase/migrations/20260602120000_sunday_schema.sql` (append)

`sunday_conversations` is a container; `sunday_messages` holds individual turns (user, assistant, tool). Spec §13.

- [ ] **Step 1: Append the table definitions**

Append:

```sql
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
```

- [ ] **Step 2: Sanity-check the SQL parses (dry run)**

Run:
```bash
PATH="/Users/trentontaylor/.nvm/versions/node/v22.21.1/bin:$PATH" \
  npx supabase db lint --schema public --linked
```
Expected: no syntax errors reported.

---

## Task 4: Add memories table with vector column

**Files:**
- Modify: `supabase/migrations/20260602120000_sunday_schema.sql` (append)

`sunday_memories` is the semantic store. `kind` is one of `person | project | decision | preference | fact`. Embedding dimension is 1536 to match OpenAI `text-embedding-3-small`.

- [ ] **Step 1: Append the table**

Append:

```sql
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
```

---

## Task 5: Add projects and tasks tables

**Files:**
- Modify: `supabase/migrations/20260602120000_sunday_schema.sql` (append)

Projects represent web dev work; tasks belong to projects (or are loose). Spec §13.

- [ ] **Step 1: Append the projects table**

Append:

```sql
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
```

- [ ] **Step 2: Append the tasks table**

Append:

```sql
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
```

---

## Task 6: Add syntheses and tool_calls tables

**Files:**
- Modify: `supabase/migrations/20260602120000_sunday_schema.sql` (append)

Nightly reflection output and audit log of every tool the agent invokes. Spec §12, §13.

- [ ] **Step 1: Append the syntheses table**

Append:

```sql
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
```

- [ ] **Step 2: Append the tool_calls audit log**

Append:

```sql
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
```

---

## Task 7: Add code dispatch queue and logs

**Files:**
- Modify: `supabase/migrations/20260602120000_sunday_schema.sql` (append)

The queue-based Claude Code dispatcher. Spec §10.

- [ ] **Step 1: Append the queue table**

Append:

```sql
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
```

- [ ] **Step 2: Append the streaming logs table**

Append:

```sql
-- Streaming logs from a Claude Code run. One row per emitted line.
create table public.sunday_code_logs (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.sunday_code_queue(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stream text not null check (stream in ('stdout', 'stderr', 'meta')),
  line text not null,
  created_at timestamptz not null default now()
);
```

---

## Task 8: Add Home Assistant cache and reminders tables

**Files:**
- Modify: `supabase/migrations/20260602120000_sunday_schema.sql` (append)

HA entity cache lets the agent fuzzy-match natural language ("the lamp in the office") without a round-trip on every turn. Reminders are time-fired follow-ups. Spec §11, §13.

- [ ] **Step 1: Append the HA entity cache**

Append:

```sql
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
```

- [ ] **Step 2: Append the reminders table**

Append:

```sql
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
```

---

## Task 9: Add indexes

**Files:**
- Modify: `supabase/migrations/20260602120000_sunday_schema.sql` (append)

Indexes are mostly forward-looking — they cover the queries Phase 2+ will make. The IVFFlat index on memories is the most important one (semantic search performance).

- [ ] **Step 1: Append all indexes**

Append:

```sql
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
```

---

## Task 10: Enable RLS and add policies

**Files:**
- Modify: `supabase/migrations/20260602120000_sunday_schema.sql` (append)

Every `sunday_*` table gets RLS on, then policies that scope rows to the authenticated user. Spec §14.

- [ ] **Step 1: Append RLS enable statements**

Append:

```sql
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
```

- [ ] **Step 2: Append policies — owner can SELECT**

Append:

```sql
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
```

- [ ] **Step 3: Append policies — owner can INSERT / UPDATE / DELETE**

These are intentionally permissive for an authenticated owner. Production mutations will flow through edge functions (using the service role, bypassing RLS), but admin-side manual edits via Supabase Studio or the SQL editor remain possible.

Append:

```sql
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
```

Note: `sunday_tool_calls`, `sunday_code_logs`, and `sunday_syntheses` deliberately omit UPDATE policies. `tool_calls` and `code_logs` are append-only audit logs; `syntheses` are append-only by date (re-runs use `INSERT ... ON CONFLICT (user_id, date) DO UPDATE`, which the INSERT policy covers since an UPSERT is technically an INSERT in Postgres). `sunday_syntheses` also omits DELETE — historical syntheses are kept forever.

---

## Task 11: Close the transaction

**Files:**
- Modify: `supabase/migrations/20260602120000_sunday_schema.sql` (append)

- [ ] **Step 1: Append the closing commit**

Append the final line to `supabase/migrations/20260602120000_sunday_schema.sql`:

```sql

commit;
```

- [ ] **Step 2: Eyeball-verify the file**

Run:
```bash
wc -l /Users/trentontaylor/WebstormProjects/taylorurl-com/supabase/migrations/20260602120000_sunday_schema.sql
grep -c "^create table" /Users/trentontaylor/WebstormProjects/taylorurl-com/supabase/migrations/20260602120000_sunday_schema.sql
grep -c "^create policy" /Users/trentontaylor/WebstormProjects/taylorurl-com/supabase/migrations/20260602120000_sunday_schema.sql
grep -c "^create index" /Users/trentontaylor/WebstormProjects/taylorurl-com/supabase/migrations/20260602120000_sunday_schema.sql
```
Expected:
- Total lines: ~280–340
- `create table` count: **11**
- `create policy` count: **40** (11 SELECT + 11 INSERT + 8 UPDATE + 10 DELETE)
- `create index` count: **11**

Policy breakdown:
- SELECT on all 11 tables → 11
- INSERT on all 11 tables → 11
- UPDATE on 8 tables (omits the append-only `sunday_tool_calls`, `sunday_code_logs`, `sunday_syntheses`) → 8
- DELETE on 10 tables (omits `sunday_syntheses` — append-only by date) → 10

If counts don't match, re-inspect the file before applying.

---

## Task 12: Dry-run the migration against the linked project

**Files:** none (CLI invocation only)

`supabase db push` applies pending migrations to the linked remote project. Before applying, inspect the diff.

- [ ] **Step 1: Show what will be applied**

Run:
```bash
cd /Users/trentontaylor/WebstormProjects/taylorurl-com && \
  PATH="/Users/trentontaylor/.nvm/versions/node/v22.21.1/bin:$PATH" \
  npx supabase db push --dry-run --linked 2>&1 | tee /tmp/sunday-dry-run.log
```
Expected: lists `20260602120000_sunday_schema.sql` as pending, prints the SQL that will run, does NOT actually run it.

If the dry-run errors with a SQL syntax issue, the error message points to the line. Fix in the migration file and re-run the dry-run.

If the dry-run reports "no migrations to apply", the CLI didn't pick up your file — verify the filename matches the `YYYYMMDDHHMMSS_name.sql` pattern and lives in `supabase/migrations/`.

---

## Task 13: Apply the migration to the remote project

**Files:** none (CLI invocation only)

This is the first irreversible step. Once applied, the schema lives in the remote Supabase project. The project ref was captured in pre-flight.

- [ ] **Step 1: Apply the migration**

Run:
```bash
cd /Users/trentontaylor/WebstormProjects/taylorurl-com && \
  PATH="/Users/trentontaylor/.nvm/versions/node/v22.21.1/bin:$PATH" \
  npx supabase db push --linked
```
Expected: "Applying migration 20260602120000_sunday_schema.sql..." followed by "Finished supabase db push."

If it errors mid-way: the migration is wrapped in `begin; ... commit;` so partial application should not leave dangling tables. Verify with the smoke queries in Task 14.

- [ ] **Step 2: Confirm migration history is up to date**

Run:
```bash
PATH="/Users/trentontaylor/.nvm/versions/node/v22.21.1/bin:$PATH" \
  npx supabase migration list --linked
```
Expected: `20260602120000_sunday_schema` appears in both Local and Remote columns.

---

## Task 14: Smoke-test the schema

**Files:** none (ad-hoc SQL via the Supabase SQL editor or CLI)

Verification that every table and policy exists in the remote DB. Per project rules, ad-hoc SQL is run in the chat / Supabase Studio, not saved as `.sql` files in the repo.

- [ ] **Step 1: Run the smoke queries**

Open the Supabase SQL Editor for the linked project (or run via `npx supabase db remote query` if preferred) and execute:

```sql
-- Count Sunday tables — expect 11.
select count(*) as sunday_table_count
from information_schema.tables
where table_schema = 'public'
  and table_name like 'sunday\_%' escape '\';

-- List Sunday tables.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'sunday\_%' escape '\'
order by table_name;

-- Count RLS policies on Sunday tables — expect 40.
select count(*) as sunday_policy_count
from pg_policies
where schemaname = 'public'
  and tablename like 'sunday\_%' escape '\';

-- Confirm RLS is enabled on every Sunday table.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 'sunday\_%' escape '\'
order by tablename;
-- Expected: every row shows rowsecurity = true.

-- Confirm pgvector is installed.
select extname, extversion
from pg_extension
where extname = 'vector';
-- Expected: one row.

-- Confirm the IVFFlat index on memories.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'sunday_memories'
  and indexname = 'sunday_memories_embedding_idx';
-- Expected: one row whose indexdef contains "ivfflat".
```

Expected results: `sunday_table_count = 11`, `sunday_policy_count = 40`, every `rowsecurity` is `true`, `pg_extension` row for `vector` exists, IVFFlat index exists.

If any check fails, drop the offending objects manually and re-investigate the migration before continuing to Phase 2.

---

## Task 15: Insert and read back a test row (RLS sanity check)

**Files:** none (ad-hoc SQL via Supabase Studio, run as the authenticated admin user)

This proves RLS works end-to-end: an authenticated user can insert and read their own rows; a different user (or anon) cannot. Run these in the Supabase SQL Editor while signed in as the admin user.

- [ ] **Step 1: Insert a probe conversation**

```sql
-- Run as the authenticated admin user (Supabase SQL Editor uses your session).
insert into public.sunday_conversations (user_id, title)
values (auth.uid(), 'Sunday RLS smoke test')
returning id, user_id, title, started_at;
```
Expected: one row returned with your `user_id`.

- [ ] **Step 2: Read it back**

```sql
select id, title, started_at
from public.sunday_conversations
where title = 'Sunday RLS smoke test';
```
Expected: the row inserted in Step 1.

- [ ] **Step 3: Try to insert a row claiming a different user_id (should fail)**

```sql
-- Replace 00000000-0000-0000-0000-000000000000 with any non-auth.uid() UUID.
insert into public.sunday_conversations (user_id, title)
values ('00000000-0000-0000-0000-000000000000', 'Should fail')
returning id;
```
Expected: `new row violates row-level security policy` error. If this succeeds, the INSERT policy is broken — investigate before continuing.

- [ ] **Step 4: Clean up the probe row**

```sql
delete from public.sunday_conversations
where title = 'Sunday RLS smoke test';
```
Expected: `DELETE 1`.

---

## Task 16: Update project docs

**Files:**
- Modify: `README.md` (append a section)

A brief note in the README that Sunday's schema lives in the project, so future-you isn't surprised by `sunday_*` tables.

- [ ] **Step 1: Append the section to README.md**

Append to the bottom of `/Users/trentontaylor/WebstormProjects/taylorurl-com/README.md`:

```markdown

## Sunday (Personal AI Agent)

Sunday is an admin-only personal agent integrated into this project. It lives at `/sunday/*` (Phase 2+), with a Postgres schema (`sunday_*` tables, see `supabase/migrations/20260602120000_sunday_schema.sql`) and edge functions under `supabase/functions/sunday-*` (Phase 2+).

Design spec: `docs/superpowers/specs/2026-06-02-sunday-design.md`.
Implementation plans: `docs/superpowers/plans/2026-06-02-sunday-phase-*.md`.
```

- [ ] **Step 2: Confirm the README still reads cleanly**

Run:
```bash
tail -10 /Users/trentontaylor/WebstormProjects/taylorurl-com/README.md
```
Expected: the new Sunday section is the last thing in the file.

---

## Checkpoint: Phase 1 Complete

At this point:
- `supabase/migrations/20260602120000_sunday_schema.sql` exists and has been applied to the remote project.
- All 11 `sunday_*` tables exist with RLS enabled and 40 policies in force.
- pgvector is installed and the IVFFlat index on `sunday_memories.embedding` is in place.
- README is updated.

**To commit**: ask the user to run `/release` to stage and commit the new migration and README change. Per project conventions, Claude does not run `git` directly.

After the user commits, this plan is done. Phase 2 (Agent Core Skeleton — `sunday-chat` edge function with streaming Claude responses, no tools yet) becomes the next plan to write.

---

## Self-Review Notes

**Spec coverage:** Every table from spec §13 is created with the documented columns. RLS covers all SELECT/INSERT/UPDATE/DELETE per §14. Indexes target the queries called out in spec §13.

**Things deferred to later phases (intentional):**
- pg_cron scheduling for nightly synthesis → Phase 10 (Daily Synthesis)
- Realtime publications for `sunday_thoughts` / `sunday_code_logs` → Phase 2 (Agent Core) — Supabase auto-publishes by default for tables in `public`; verify there
- Edge function for entity extraction → Phase 6 (Memory Extraction)
- Vault entries for Anthropic/OpenAI/Deepgram/ElevenLabs/HA secrets → Phase 2 onward, set via `supabase secrets set`

**No placeholders.** Every step has the exact SQL, exact path, exact command. Expected outputs are concrete.

**Type consistency.** All column names, table names, and policy names follow `sunday_<table>` and `sunday_<table>_<action>_own` patterns consistently. The `set_updated_at` function is reused across the three tables that have `updated_at` columns (`memories`, `projects`, `tasks`).
