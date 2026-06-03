# Sunday — Setup Checklist (Claude Code Max edition)

The agent runtime lives on your Mac. Every conversational turn shells out to your local `claude` CLI, which uses your Claude Code Max subscription. No Anthropic API key is involved.

> All ad-hoc SQL below should be run from the Supabase SQL Editor while signed in as the admin user, or via `supabase db query --linked`. Don't save these as `.sql` files in the repo.

## 1. Create the admin auth user

If you haven't already, create your admin user in Supabase Auth:

- Supabase Dashboard → Authentication → Users → "Add user" → email + password.
- Sign in to the Supabase SQL Editor as that user and run `select auth.uid();` — save the UUID.

## 2. Set Vercel / local frontend env vars

In **Vercel** (Project Settings → Environment Variables) and in a local `.env.local`:

```
VITE_SUPABASE_URL=https://gujgtjqqurildqurpffh.supabase.co
VITE_SUPABASE_ANON_KEY=<from Supabase Dashboard → API Settings>
VITE_SUNDAY_ADMIN_USER_ID=<the UUID from step 1>
```

Redeploy the site so the new env vars take effect.

## 3. Set Supabase Edge Function secrets

Only the server-side admin UUID and timezone are required. Home Assistant secrets live in the daemon's `.env` (next step), not edge function secrets.

```bash
PATH="/Users/trentontaylor/.nvm/versions/node/v22.21.1/bin:$PATH" \
  npx supabase secrets set \
    SUNDAY_ADMIN_USER_ID=<UUID from step 1> \
    SUNDAY_USER_TIMEZONE=America/Chicago \
    --project-ref gujgtjqqurildqurpffh
```

There are no other required secrets. Sunday is text-only — voice (STT/TTS) was removed in favor of a chat composer.

## 4. Install the local daemon — REQUIRED

Sunday only thinks when the daemon is running. The daemon:
- Subscribes to new user messages in Supabase Realtime
- Spawns `claude --print` per turn (uses your Max subscription)
- Exposes Sunday's tools (memory, tasks, projects, smart home, code dispatch, etc.) to Claude Code via a local stdio MCP server
- Streams the response back into the assistant row, which the browser renders live
- Also handles the existing code-dispatch queue and nightly synthesis

### Install

```bash
cd /Users/trentontaylor/WebstormProjects/taylorurl-com/daemon/sunday-code-daemon
cp .env.example .env       # then fill in SUPABASE_SERVICE_ROLE_KEY and SUNDAY_USER_ID
npm install                # already done if you've been following along
npm start                  # run in the foreground first to verify
```

You should see:
```
[sunday-daemon] starting — user=07a1299d... claude=claude
[sunday-daemon] chat poll 5000ms · code poll 4000ms · tz America/Chicago
[realtime] SUBSCRIBED
```

Verify `claude` is on PATH and authenticated to your Max account:
```bash
claude --version
# Should print a version. If `claude --print "hello"` works without prompting
# for auth, you're good.
```

### Install as a launchd service (auto-start)

```bash
cp launchd/com.trentontaylor.sunday-code-daemon.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.trentontaylor.sunday-code-daemon.plist
```

Logs land at `~/.sunday-code-daemon.out.log` and `~/.sunday-code-daemon.err.log`.

To stop:
```bash
launchctl unload ~/Library/LaunchAgents/com.trentontaylor.sunday-code-daemon.plist
```

## 5. Smoke test

1. Visit `https://taylorurl.com/sunday/auth` (or `http://localhost:5173/sunday/auth` locally), sign in.
2. Land on `/sunday` (Today). Click **Chat**.
3. Type "Sunday, what's the time?" → Enter.
4. Watch the chat — daemon picks up the message, you'll see a `time.now` tool call chip appear, then Sunday's response stream in.

If nothing happens after 5–10 seconds, check `~/.sunday-code-daemon.out.log`.

## 6. Optional: first project + dispatch

Tell Sunday to create your first project:

> "Sunday, create a project called Acme Dashboard. Repo path is `/Users/trentontaylor/WebstormProjects/acme-dashboard`, client is Acme Co, stack is Next.js + Supabase."

She'll call `projects_create`, write the project, and confirm. Then:

> "Sunday, dispatch a task to Claude Code on Acme Dashboard: add a sentence to the README explaining the project."

She'll call `claude_code_dispatch`, which enqueues onto `sunday_code_queue`. The same daemon picks that up, spawns a separate `claude` session in that repo, streams logs to `/sunday/projects/<id>` and `/sunday/thoughts`.

---

## What runs where

| Concern | Lives in |
|---|---|
| Chat turn (every user message) | **Local daemon** → `claude --print` with Sunday MCP tools |
| Memory write/search/update | Daemon, via Supabase Postgres (trigram text search — no embeddings) |
| Tasks / projects / reminders | Daemon, via Supabase |
| Home Assistant calls | Daemon (uses HA URL + token from daemon's `.env`) |
| Code dispatch | Daemon, spawns separate `claude` per dispatched task |
| Nightly synthesis | Daemon (runs at `SUNDAY_SYNTHESIS_HOUR_LOCAL`, default 23:00 local) |
| Voice STT/TTS | Removed — Sunday is text-only |
| Auth + Realtime + DB | Supabase |
| Dashboard | Vercel-hosted Vite app, talks only to Supabase |

## Things that are NOT in v1

- Always-listening
- Wake-word
- Mobile-native shell
- Email / calendar / Slack / Stripe / CRM / social
- Multi-user
- When your Mac is asleep or the daemon is stopped, Sunday goes silent. This is the trade-off for using your Max subscription instead of the per-token API.

## Reference

- Design spec: `docs/superpowers/specs/2026-06-02-sunday-design.md`
- Phase 1 plan: `docs/superpowers/plans/2026-06-02-sunday-phase-1-database-foundation.md`
- Migrations: `supabase/migrations/2026060212*`, `2026060213*`, `2026060214*`, `2026060215*`
- Edge functions (voice only): `supabase/functions/sunday-{stt,tts}` (chat + synthesize moved to daemon)
- Daemon: `daemon/sunday-code-daemon/`
- Frontend: `src/app/{views,components,hooks,data,constants}/sunday/`
