# Supabase cleanup

The project `gujgtjqqurildqurpffh` (now named **TaylorURL**) started as the
Sunday Analyzer / sunday-my backend, and the database still carries that era's
leftovers. This folder is the version-controlled record of the cleanup that
clears the ground for the client/admin portal.

## What the site actually uses today

| Edge function | Status | Called from |
| :--- | :--- | :--- |
| `collect-email` | **Live** | `src/app/data/collectEmail.js` — newsletter + email capture |
| `analytics-service` | **Live** | `<script>` in `index.html` loads `/beacon.js`; the beacon posts to `/track` and `/heartbeat` |
| `analytics-ingest` | **Dead, still deployed** | Old Sunday Analyzer ingest; last caller removed in `cd853f2` (2026-07-08) |
| `livechat-service` | **Dead, still deployed** | Chat widget removed in `cd853f2` (2026-07-08) |
| `error-reporting-service` | **Configured, never deployed** | Listed in `supabase/config.toml` but returns 404; browser errors currently go to the private `sunday.tail1f78d7.ts.net/report` endpoint instead |

## Table classification

**Known dead** (named in the deleted `livechat-service` source, no remaining
reader or writer): `chat_conversations`, `chat_messages`, `chat_leads`.
`02_drop_livechat_tables.sql` removes them — note the lead-export warning
inside before running it.

**Keep** (written by the live functions): the email-capture table behind
`collect-email` and the analytics tables behind `analytics-service`'s
`/track` and `/heartbeat`. Their server code lives only in the Supabase
project, so match them up by activity counters in the audit output —
they'll be the tables with ongoing inserts.

**Investigate via audit**: whatever `analytics-ingest` wrote (the multi-site
Sunday Analyzer tables — they may hold other sites' data), any non-`public`
schemas, `auth.users` rows, and storage buckets — this site has no login and
uploads nothing, so all of those predate TaylorURL.

## Process

1. Run `01_audit.sql` in the Supabase SQL editor (each numbered section
   separately) and review the output against the classification above.
2. Run `02_drop_livechat_tables.sql`.
3. Extend this folder with a numbered drop script per further batch the audit
   confirms dead, so every removal stays reviewable in git.
4. Delete the orphaned functions once their tables are gone:
   `supabase functions delete analytics-ingest` and
   `supabase functions delete livechat-service` (project ref
   `gujgtjqqurildqurpffh`). Then either deploy a real
   `error-reporting-service` or drop its stale block from
   `supabase/config.toml`.
