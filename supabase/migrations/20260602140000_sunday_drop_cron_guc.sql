-- Phase 1.6: simplify sunday_invoke_edge.
-- The previous version relied on app.settings GUCs that the Supabase Management
-- API role can't set (ALTER DATABASE requires owner privilege). Inlining the
-- public functions URL is fine — it's non-discoverable and the only cron-invoked
-- endpoint (sunday-synthesize) is idempotent (upsert by user_id + date).

begin;

create or replace function public.sunday_invoke_edge(fn_name text, payload jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
as $$
declare
  req_id bigint;
begin
  select net.http_post(
    url      := 'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/' || fn_name,
    headers  := jsonb_build_object('Content-Type', 'application/json'),
    body     := payload
  ) into req_id;
  return req_id;
end;
$$;

commit;
