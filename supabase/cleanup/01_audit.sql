-- Database audit for the TaylorURL Supabase project (ref gujgtjqqurildqurpffh).
--
-- The project began life as the Sunday Analyzer / sunday-my backend, so the
-- database may still hold tables from services this site no longer uses (the
-- retired analytics-ingest pipeline, the removed live-chat widget) alongside
-- the live email-capture and analytics tables. Run this audit and review the
-- output before dropping anything — see README.md in this folder.
--
-- ▶ The Supabase SQL editor shows only the last result set of a run, so
--   select and run each numbered section on its own.

-- 1. Every user table with size, row estimate, and activity counters.
--    A table with zero writes (ins/upd/del) since the stats were last reset
--    and no scans is a strong dead-table candidate; confirm against the
--    "still used by code" list in README.md before dropping.
select
  n.nspname                                   as schema,
  c.relname                                   as table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  c.reltuples::bigint                         as approx_rows,
  s.seq_scan + coalesce(s.idx_scan, 0)        as reads,
  s.n_tup_ins                                 as inserts,
  s.n_tup_upd                                 as updates,
  s.n_tup_del                                 as deletes,
  s.last_autoanalyze,
  obj_description(c.oid)                      as comment
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where c.relkind = 'r'
  and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast',
                        'auth', 'storage', 'realtime', 'vault',
                        'supabase_functions', 'extensions', 'graphql',
                        'graphql_public', 'pgsodium', 'pgsodium_masks', 'net')
order by pg_total_relation_size(c.oid) desc;

-- 2. Non-system schemas. Anything beyond `public` likely belongs to the old
--    sunday-my app and deserves a look of its own.
select nspname as schema, pg_get_userbyid(nspowner) as owner
from pg_namespace
where nspname not like 'pg\_%'
  and nspname not in ('information_schema', 'auth', 'storage', 'realtime',
                      'vault', 'supabase_functions', 'extensions', 'graphql',
                      'graphql_public', 'pgsodium', 'pgsodium_masks', 'net')
order by nspname;

-- 3. Views, user-defined functions, and triggers that would break (or should
--    go) when their tables are dropped.
select 'view' as kind, schemaname as schema, viewname as name
from pg_views
where schemaname = 'public'
union all
select 'function', n.nspname, p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
union all
select 'trigger', event_object_schema, trigger_name
from information_schema.triggers
where event_object_schema = 'public'
order by kind, name;

-- 4. Leftover accounts and files from the sunday-my era: this marketing site
--    has no login and uploads nothing, so any rows here predate TaylorURL.
select
  (select count(*) from auth.users)      as auth_users,
  (select count(*) from storage.buckets) as storage_buckets,
  (select count(*) from storage.objects) as storage_objects;

-- 5. RLS coverage — every public table should have RLS enabled; the live
--    tables should be locked to the service role (no anon/authenticated
--    policies).
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(p.polname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relname;
