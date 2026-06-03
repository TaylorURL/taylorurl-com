-- Phase 2 cleanup: synthesis now runs in the local daemon (Claude Code Max).
-- Drop the cron + invoker helper that previously called the edge function.

begin;

-- Cron job is gone; the daemon runs synthesis locally at SUNDAY_SYNTHESIS_HOUR_LOCAL.
do $$ begin
  perform cron.unschedule('sunday-nightly-synthesize');
exception when others then null;
end $$;

-- Helper that posted to /functions/v1/sunday-synthesize is no longer needed.
drop function if exists public.sunday_invoke_edge(text, jsonb);

commit;
