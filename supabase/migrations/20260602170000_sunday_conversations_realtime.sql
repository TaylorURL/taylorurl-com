-- Publish sunday_conversations to Realtime so the chat-history panel can
-- live-tail INSERT/UPDATE/DELETE events without polling.

begin;

do $$ begin
  alter publication supabase_realtime add table public.sunday_conversations;
exception when duplicate_object then null;
end $$;

commit;
