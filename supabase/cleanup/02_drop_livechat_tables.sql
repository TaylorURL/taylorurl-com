-- Drop the live-chat tables left behind when the chat widget was removed
-- from the site (commit cd853f2, 2026-07-08). Nothing reads or writes them:
-- the only writer was the livechat-service edge function, and the widget
-- that called it is gone.
--
-- ⚠ chat_leads holds prospective-client names and emails collected by the
--   widget. If any of those contacts still matter, export the table from
--   Table Editor (or keep the archive step below) before the drops run.
--
-- Run 01_audit.sql first and confirm these tables show no recent writes.

begin;

-- Pre-flight: see what you're about to delete.
select
  (select count(*) from public.chat_conversations) as conversations,
  (select count(*) from public.chat_messages)      as messages,
  (select count(*) from public.chat_leads)         as leads;

-- Optional safety net: keep a copy out of the way instead of exporting.
-- Delete the archive schema whenever you're sure you're done with it.
create schema if not exists archive;
create table archive.chat_leads_2026_08 as table public.chat_leads;

-- chat_messages and chat_leads reference chat_conversations; CASCADE also
-- clears any dependent policies, triggers, or views the audit surfaced.
drop table if exists public.chat_messages cascade;
drop table if exists public.chat_leads cascade;
drop table if exists public.chat_conversations cascade;

commit;
