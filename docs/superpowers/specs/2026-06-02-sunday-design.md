# Sunday — Personal AI Agent (v1 Design)

**Date:** 2026-06-02
**Owner:** Trenton Taylor
**Status:** Design — pending implementation plan
**Lives in:** taylorurl-com (admin-only routes + Supabase Edge Functions)

---

## 1. Overview

Sunday is a personal AI agent that lives inside the taylorurl-com web application. It is voice-driven, memory-rich, and tool-equipped — designed to act as a chief-of-staff for a solo web development business. Sunday remembers every conversation, manages projects and tasks, dispatches coding work to Claude Code on the user's local machine, controls smart home devices through Home Assistant, and synthesizes daily reflections each night.

Sunday is admin-only. It is not a customer-facing feature.

### Why integrate into taylorurl-com instead of a standalone app

The taylorurl-com project already provides:
- Supabase Auth with three roles (`client`, `staff`, `admin`)
- Postgres with established RLS patterns
- Tailwind 3.4 + a working design system
- Vercel deployment pipeline with security headers
- Folder conventions (`src/app/{components,hooks,views,data,constants}`)
- Edge Functions pattern for backend mutations

Building Sunday as a new role-gated surface inside this app reuses every piece of that infrastructure. Sunday is cleanly namespaced under `src/app/sunday/` and `supabase/functions/sunday-*/` so it can be extracted later if desired.

---

## 2. Goals & Non-Goals

### Goals (v1)
- Voice-driven conversation from any browser (phone or laptop) with audio output to AirPods
- Persistent four-layer memory: working, episodic, semantic, reflective
- Project and task ledger that the agent reads from and writes to
- Smart home control via Home Assistant
- Claude Code dispatch — agent briefs Claude Code in the right repo with full memory context
- Nightly synthesis that summarizes the day and queues tomorrow
- Dashboard surfaces for thoughts, memories, tasks, projects, daily history
- All Sunday data RLS-scoped to the authenticated admin user

### Non-goals (v1)
- Always-listening (only push-to-talk while a browser tab is active)
- Wake-word detection
- Email drafting / inbox triage
- Calendar management
- Slack / SMS / client comms automation
- Stripe / invoicing / CRM
- Social posting
- Document drafting beyond what fits in a chat message
- Mobile-native shell (web only)
- Multi-user (admin user is the only Sunday user for now)

These are explicitly out of v1 but the tool architecture leaves clean slots for adding them later.

---

## 3. Architecture

```
+------------------------------------------------------------------+
|  taylorurl-com (Vite + React 19 + React Router 7, Vercel SPA)    |
|                                                                  |
|  +------------------------+  +-------------------------------+   |
|  |  Existing site         |  |  /sunday/* (admin-only)       |   |
|  |  - Marketing           |  |  - /sunday        (Today)     |   |
|  |  - Client portal       |  |  - /sunday/talk               |   |
|  |  - Admin panel         |  |  - /sunday/thoughts           |   |
|  |                        |  |  - /sunday/memories           |   |
|  |                        |  |  - /sunday/tasks              |   |
|  |                        |  |  - /sunday/projects           |   |
|  |                        |  |  - /sunday/day/:date          |   |
|  +------------------------+  +---------------+---------------+   |
+--------------------------------------------------|---------------+
                                                   |
        +------------------------------------------v-------+
        |  Supabase Edge Functions (Deno, streaming)       |
        |  - sunday-chat       (agent loop + tool calls)   |
        |  - sunday-stt        (Deepgram passthrough)      |
        |  - sunday-tts        (ElevenLabs passthrough)    |
        |  - sunday-synthesize (cron: nightly synthesis)   |
        |  - sunday-tool-*     (tool execution, one per    |
        |                       tool that needs isolation) |
        +------+-----------------------------+-------------+
               |                             |
        +------v-----------+         +-------v---------------------+
        | Anthropic /      |         | Supabase Postgres           |
        | Deepgram /       |         | - sunday_* tables           |
        | ElevenLabs /     |         | - pgvector (semantic recall)|
        | Home Assistant   |         | - pg_cron (nightly trigger) |
        +------------------+         | - realtime (live thoughts)  |
                                     | - RLS scoped to user_id     |
                                     +-------------+---------------+
                                                   |
                                       +-----------v-----------------+
                                       | Local daemon on user's Mac  |
                                       | (sunday-code-daemon)        |
                                       | - Polls sunday_code_queue   |
                                       | - Runs Claude Code          |
                                       | - Streams logs back to DB   |
                                       | - No exposed port           |
                                       +-----------------------------+
```

### Data flow — a voice turn end-to-end

1. User opens `/sunday/talk`, presses and holds the mic button.
2. Browser captures audio via Web Audio API, streams chunks to the `sunday-stt` edge function.
3. `sunday-stt` proxies to Deepgram streaming STT, returns partial + final transcripts via SSE.
4. On final transcript, the dashboard calls `sunday-chat` with the user message + conversation ID.
5. `sunday-chat` loads relevant context (recent conversation + retrieved memories), composes a Claude prompt with the tool registry, and invokes the Anthropic API with tool use enabled.
6. Claude streams reasoning + tool calls back. The edge function:
   - Streams text deltas to the dashboard via SSE (visible in `/sunday/thoughts`)
   - Executes tool calls (memory lookups, task writes, Home Assistant actions, code dispatch, etc.)
   - Writes turn artifacts to the database
7. Final text response is streamed to `sunday-tts` (ElevenLabs) and played back through the user's AirPods.
8. The full turn is persisted to `sunday_conversations` and `sunday_messages`.

---

## 4. Stack

| Layer | Choice |
|---|---|
| Frontend framework | React 19 + React Router 7 (existing) |
| Build tool | Vite 7 (existing) |
| Frontend language | JavaScript (existing — matches project conventions, `.jsx`) |
| Edge function language | TypeScript (Deno is TS-native; all `supabase/functions/*` are `.ts`) |
| Styling | Tailwind 3.4, three themes (dark / light / gray) |
| UI primitives | Existing components + new Sunday-specific ones. Lucide for icons. Framer Motion for transitions. |
| Auth | Supabase Auth (existing) — admin role required for all `/sunday/*` routes |
| Database | Supabase Postgres + pgvector + Realtime |
| Backend | Supabase Edge Functions (Deno) |
| LLM | Anthropic Claude (Sonnet for normal turns, can route Haiku for cheap subtasks) |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim, cheap, well-supported by pgvector) |
| STT | Deepgram (streaming) |
| TTS | ElevenLabs (low-latency model) |
| Smart home | Home Assistant REST API |
| Code agent | Claude Code via local daemon |
| Scheduling | `pg_cron` + `pg_net` to call edge functions |
| Deployment | Vercel (existing) |

This mixed-language split (JS frontend, TS edge functions) is normal for Supabase projects — Deno strongly prefers TS in functions, and forcing JS there would lose type help where it matters most (tool schemas, Claude API types).

### Why Supabase Edge Functions over Vercel serverless

The project's CLAUDE.md establishes that all backend mutations go through Supabase Edge Functions. Edge Functions also support streaming responses natively (via Deno's `Response` with a `ReadableStream`), have first-class access to the DB without a round-trip through PostgREST, and keep the agent core's secrets (Anthropic key, Deepgram key, ElevenLabs key, HA token) in one place alongside the rest of the project's backend.

---

## 5. Routes & UI Surfaces

All routes are gated by the admin role (existing pattern from the admin panel). Unauthenticated users redirect to auth; non-admin users redirect to their role-appropriate landing.

| Route | Purpose |
|---|---|
| `/sunday` | **Today** — last night's synthesis, what's pending, mic button. The default landing. |
| `/sunday/talk` | Full-screen voice interface. Big hold-to-talk button, live transcript while speaking, streaming agent response. |
| `/sunday/thoughts` | Live stream of agent reasoning + tool calls. Subscribed to Supabase Realtime. Shows what Sunday is doing in real time. |
| `/sunday/memories` | Browseable, searchable memory store. Filter by kind (person, project, decision, preference, fact). Editable. |
| `/sunday/tasks` | Task ledger grouped by project. Status, priority, due date. |
| `/sunday/projects` | List + detail pages. Per-project: context, recent activity, open tasks, dispatch history. |
| `/sunday/day/:date` | Historical day view: transcripts, syntheses, what happened. |

### Three-theme requirement
Every Sunday surface must work in dark, light, and gray themes. Sunday inherits the existing theme tokens; new color choices use the existing CSS variable system.

### No emojis in UI
Per project convention. Use Lucide icons or unicode arrows (`→`, `✓`, `⚠`) where iconography is needed.

---

## 6. Agent Core

The agent core is the `sunday-chat` edge function. It implements a single tool-using loop with streaming output.

### Loop shape

```
function agentTurn(userMessage, conversationId):
    1. Load conversation context (recent N messages from sunday_messages)
    2. Retrieve relevant memories (semantic search via pgvector on user message embedding)
    3. Compose system prompt:
         - Sunday's persona
         - Current date/time
         - User profile facts (name, location, preferences)
         - Available tools (registry)
         - Retrieved memories (top K)
         - Recent conversation
    4. Stream Claude with tool_use enabled
    5. While Claude returns tool_use blocks:
         a. Execute tool(s), gather results
         b. Stream tool_call + tool_result events to the dashboard via SSE
         c. Persist tool calls to sunday_tool_calls
         d. Continue Claude with tool_result messages
    6. Stream final text response to client
    7. Pipe final text to TTS (parallel to display)
    8. Persist final turn to sunday_messages
```

### Persona

Sunday speaks like a capable, dry, low-fluff senior chief-of-staff. Specific tone rules:
- No filler ("Sure!", "Absolutely!", "Great question!")
- No emojis
- Direct, brief by default; expansive only when the user asks for depth
- Acknowledges constraints honestly ("I don't know X" rather than guessing)
- Uses the user's name sparingly
- Refers to projects, people, and decisions by name (memory-rich responses)

The persona prompt lives in `src/app/sunday/constants/persona.js` and is injected at the top of every system prompt.

### Model routing

- Default: Claude Sonnet (latest) for conversation turns
- Cheap subtasks (entity extraction, memory tagging, summarization): Claude Haiku
- Nightly synthesis: Claude Sonnet (worth the cost for quality)

---

## 7. Memory Model

Four memory layers. Each serves a distinct purpose.

| Layer | Holds | Storage | Retrieval |
|---|---|---|---|
| **Working** | Current conversation turns | In-process during a turn | Always loaded |
| **Episodic** | Every message turn, timestamped | `sunday_messages` table | Last N messages by conversation |
| **Semantic** | Extracted entities: people, projects, decisions, preferences, facts | `sunday_memories` table with pgvector embedding | Top-K cosine similarity on user message |
| **Reflective** | Nightly synthesis: themes, patterns, what's pending | `sunday_syntheses` table | Last 7 syntheses summarized into agent context; nightly job loads previous day's synthesis for continuity |

### Semantic memory extraction
After each conversation turn, a lightweight background job (triggered by a DB trigger or by the agent itself) runs Claude Haiku over the new turn to:
1. Extract entities (people, projects, decisions, preferences, facts)
2. Compare against existing memories (similarity search) — update if duplicate, insert if new
3. Embed and store

Memory entries carry:
- `kind` (enum: person, project, decision, preference, fact)
- `content` (text)
- `embedding` (vector)
- `source_message_id` (FK)
- `confidence` (numeric, 0–1)
- `created_at`, `updated_at`

### Reflective synthesis (nightly)
Triggered by `pg_cron` at a fixed time (e.g. 11:00 PM local). Calls `sunday-synthesize`, which:
1. Loads all conversations + tool calls from the day
2. Runs Claude Sonnet with a synthesis prompt
3. Produces: themes, what got accomplished, what slipped, what's queued for tomorrow, anything that surprised Sunday
4. Writes to `sunday_syntheses`
5. Surfaces in `/sunday` (Today view) the next morning

---

## 8. Tool Registry (v1)

All tools are JS functions registered in a central registry in the `sunday-chat` edge function. Each has a JSON Schema for its parameters, an executor function, and an authz check (most are admin-only by default).

### v1 tool list

#### Memory
- `memory.search({ query, kinds?, limit? })` → array of memories
- `memory.write({ kind, content, confidence?, source_message_id? })` → memory ID
- `memory.update({ id, content?, confidence? })` → updated memory
- `memory.delete({ id })` → ack

#### Tasks
- `tasks.add({ title, project_id?, due?, priority? })` → task ID
- `tasks.list({ project_id?, status?, limit? })` → array of tasks
- `tasks.complete({ id })` → updated task
- `tasks.snooze({ id, until })` → updated task
- `tasks.update({ id, ... })` → updated task

#### Projects
- `projects.list()` → array of projects
- `projects.get({ id })` → project + recent activity
- `projects.create({ name, repo_path?, client?, stack?, notes? })` → project ID
- `projects.update({ id, ... })` → updated project

#### Home Assistant
- `home_assistant.list_entities({ filter? })` → entities
- `home_assistant.get_state({ entity_id })` → state
- `home_assistant.call_service({ domain, service, entity_id?, data? })` → result

#### Claude Code dispatch
- `claude_code.dispatch({ project_id, brief, context_overrides? })` → dispatch ID
- `claude_code.status({ dispatch_id })` → status + logs
- `claude_code.list_recent({ project_id?, limit? })` → recent dispatches

#### Web
- `web.search({ query, num_results? })` → array of results
- `web.fetch({ url })` → page text

#### Time
- `time.now()` → ISO timestamp + user-local time
- `time.schedule_reminder({ at, message, project_id? })` → reminder ID

### Tool execution boundary
Memory, tasks, projects, and time tools execute inline in `sunday-chat` (low latency, no extra hop). Home Assistant, Claude Code dispatch, web search, and web fetch can also run inline since they're already external calls — splitting them into separate edge functions buys nothing.

### Adding new tools later
Each post-v1 tool (email, calendar, Stripe, etc.) is a new module dropped into `agent/tools/` + a registry entry. No architectural change required.

---

## 9. Voice Loop

### Capture (browser)
- `MediaRecorder` API with `audio/webm; codecs=opus` (or `audio/mp4` on Safari)
- Hold-to-talk button — recording starts on `pointerdown`, ends on `pointerup` or after a max duration
- Chunks streamed to `sunday-stt` via `fetch` with a `ReadableStream` body

### STT
- `sunday-stt` proxies to Deepgram's streaming API (Nova-3 model or current latest)
- Streams partial transcripts back via SSE
- Final transcript triggers the chat call

### TTS
- `sunday-tts` proxies to ElevenLabs (Flash or Turbo model for low latency)
- Streams audio bytes back as they arrive
- Browser plays via Web Audio API as bytes stream in
- Routed to whatever output device the OS has selected (AirPods if paired)

### Failure modes
- STT timeout → show "didn't catch that" toast, keep mic ready
- TTS failure → fall back to text-only response
- Network drop mid-stream → reconnect and retry; show degraded state in UI

### Latency targets (v1)
- STT first partial: < 500ms after speech onset
- Time to first agent token: < 2s after final transcript
- Time to first audio byte: < 1s after first agent token

---

## 10. Claude Code Dispatcher (Queue-Based)

The Claude Code dispatcher is the one piece that has a presence outside the cloud — a small local daemon on the user's Mac.

### Why queue-based instead of HTTP

A queue avoids exposing a local endpoint to the internet. Benefits:
- No Cloudflare Tunnel, no Tailscale Funnel, no auth headaches
- Mac asleep or daemon offline → work queues, runs when the daemon wakes
- Crashes are recoverable — queue is the source of truth
- Full audit trail in the database

### Flow

1. Agent's `claude_code.dispatch` tool writes a row to `sunday_code_queue`:
   ```
   { id, project_id, brief, context, status: 'pending', created_at }
   ```
2. Local daemon (`sunday-code-daemon`) subscribes to `sunday_code_queue` inserts via Supabase Realtime, or polls every 2 seconds as a fallback.
3. Daemon picks up the row, marks `status: 'running'`, resolves the repo path from `project_id`, and spawns Claude Code:
   ```
   claude --project <repo_path> --prompt "<brief + context>"
   ```
4. Daemon streams Claude Code's stdout/stderr line-by-line into `sunday_code_logs` (one row per line, keyed by dispatch ID).
5. On completion, daemon marks `status: 'completed'` (or `'failed'`), captures the final summary.
6. Dashboard (subscribed to `sunday_code_logs` realtime) shows the live stream in `/sunday/thoughts` and on the project page.
7. After completion, the agent reads the summary and folds the outcome back into the conversation + memory (e.g. "Sunday dispatched a code task to Acme — completed in 12 minutes, summary saved to project memory").

### Daemon implementation

- Tiny Node project (`daemon/sunday-code-daemon/`)
- Single file, < 200 lines
- Dependencies: `@supabase/supabase-js`, that's basically it
- Runs as a launchd service so it auto-starts on Mac login
- Service account: a dedicated Supabase user (or service role key kept in `~/.config/sunday-daemon/.env`)
- Logs to a local file for daemon-level debugging

---

## 11. Smart Home Integration (Home Assistant)

### Setup (one-time)
- Home Assistant runs on a Raspberry Pi or Mac mini at home
- User generates a long-lived access token in HA → stored as `HOME_ASSISTANT_TOKEN` in Supabase secrets
- User exposes HA either via Nabu Casa Cloud (`https://*.ui.nabu.casa`) or Cloudflare Tunnel to a public hostname → stored as `HOME_ASSISTANT_URL`

### Tool execution
- `home_assistant.list_entities` → `GET /api/states`
- `home_assistant.get_state` → `GET /api/states/{entity_id}`
- `home_assistant.call_service` → `POST /api/services/{domain}/{service}` with body

### Entity cache
A `sunday_ha_entities` table caches the full entity list (refreshed every 15 minutes via cron). Lets the agent fuzzy-match natural-language references ("the lamp in the office") to entity IDs without a round-trip to HA on every turn.

---

## 12. Daily Synthesis

### Trigger
`pg_cron` job runs daily at 11:00 PM (user's local time, stored in user profile). Calls `sunday-synthesize` via `pg_net`.

### Process
1. Load all `sunday_messages`, `sunday_tool_calls`, `sunday_tasks` activity from the day
2. Load the previous synthesis for continuity
3. Call Claude Sonnet with a synthesis prompt
4. Persist result to `sunday_syntheses`:
   ```
   {
     id, date, summary, themes (jsonb),
     accomplishments (jsonb), pending (jsonb),
     queued_for_tomorrow (jsonb), surprises (jsonb),
     created_at
   }
   ```
5. The synthesis becomes the default content on `/sunday` the next morning

### Synthesis prompt skeleton
- "You are Sunday. You just lived through this day with Trenton."
- Today's conversation transcripts
- Tool calls made
- Tasks completed and added
- Previous synthesis
- "Produce themes, what got done, what slipped, what's queued for tomorrow, anything that surprised you. Be terse. No filler."

---

## 13. Data Model

All tables prefixed `sunday_`. All scoped by `user_id` with RLS policies that match against `auth.uid()`. (The admin user is the only user, but the pattern allows expansion.)

### Tables

```sql
-- Conversation containers
sunday_conversations (
  id uuid pk,
  user_id uuid references auth.users(id),
  title text,
  started_at timestamptz,
  last_message_at timestamptz
)

-- Individual turns (both user and assistant)
sunday_messages (
  id uuid pk,
  conversation_id uuid references sunday_conversations(id),
  user_id uuid references auth.users(id),
  role text check (role in ('user', 'assistant', 'tool')),
  content text,
  tool_calls jsonb,         -- for assistant messages
  tool_results jsonb,       -- for tool messages
  created_at timestamptz
)
-- Note: user audio is NOT persisted by default in v1 (privacy + storage cost).
-- Transcripts are the audit trail. A future option could add audio_url + Supabase Storage.

-- Semantic memory
sunday_memories (
  id uuid pk,
  user_id uuid references auth.users(id),
  kind text check (kind in ('person', 'project', 'decision', 'preference', 'fact')),
  content text,
  embedding vector(1536),
  source_message_id uuid references sunday_messages(id),
  confidence numeric default 0.8,
  created_at timestamptz,
  updated_at timestamptz
)

-- Projects (web dev projects)
sunday_projects (
  id uuid pk,
  user_id uuid references auth.users(id),
  name text,
  repo_path text,           -- local absolute path on user's Mac
  client text,
  stack text,
  notes text,
  status text default 'active',
  created_at timestamptz,
  updated_at timestamptz
)

-- Tasks
sunday_tasks (
  id uuid pk,
  user_id uuid references auth.users(id),
  project_id uuid references sunday_projects(id),
  title text,
  status text check (status in ('open', 'in_progress', 'snoozed', 'done', 'cancelled')),
  priority text check (priority in ('low', 'normal', 'high', 'urgent')),
  due timestamptz,
  snooze_until timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)

-- Daily syntheses
sunday_syntheses (
  id uuid pk,
  user_id uuid references auth.users(id),
  date date,
  summary text,
  themes jsonb,
  accomplishments jsonb,
  pending jsonb,
  queued_for_tomorrow jsonb,
  surprises jsonb,
  created_at timestamptz,
  unique (user_id, date)
)

-- Tool call audit log
sunday_tool_calls (
  id uuid pk,
  user_id uuid references auth.users(id),
  message_id uuid references sunday_messages(id),
  tool_name text,
  input jsonb,
  output jsonb,
  error text,
  duration_ms int,
  created_at timestamptz
)

-- Claude Code dispatch queue
sunday_code_queue (
  id uuid pk,
  user_id uuid references auth.users(id),
  project_id uuid references sunday_projects(id),
  brief text,
  context jsonb,
  status text check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  result_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz
)

-- Streaming logs from Claude Code dispatches
sunday_code_logs (
  id uuid pk,
  dispatch_id uuid references sunday_code_queue(id),
  user_id uuid references auth.users(id),
  stream text check (stream in ('stdout', 'stderr', 'meta')),
  line text,
  created_at timestamptz
)

-- Home Assistant entity cache
sunday_ha_entities (
  entity_id text pk,
  user_id uuid references auth.users(id),
  friendly_name text,
  domain text,
  state text,
  attributes jsonb,
  last_refreshed_at timestamptz
)

-- Scheduled reminders
sunday_reminders (
  id uuid pk,
  user_id uuid references auth.users(id),
  message text,
  project_id uuid references sunday_projects(id),
  fire_at timestamptz,
  fired_at timestamptz,
  status text check (status in ('pending', 'fired', 'cancelled')),
  created_at timestamptz
)
```

### Indexes
- `sunday_messages(conversation_id, created_at desc)` — recent context lookups
- `sunday_memories USING ivfflat (embedding vector_cosine_ops)` — semantic search
- `sunday_tasks(user_id, status, due)` — task list queries
- `sunday_code_logs(dispatch_id, created_at)` — streaming logs
- `sunday_syntheses(user_id, date desc)` — recent syntheses

### RLS policies
Every `sunday_*` table has policies:
- `SELECT`: `auth.uid() = user_id`
- `INSERT`: `auth.uid() = user_id` (where applicable — edge functions use service role and set `user_id` explicitly)
- `UPDATE` / `DELETE`: `auth.uid() = user_id`

All mutations from the frontend go through edge functions (per project rules). The frontend only reads from these tables (via Supabase client with RLS).

---

## 14. Access Control

- All `/sunday/*` routes are protected by the existing role guard, restricted to `admin`
- An additional `useAdminGuard` hook redirects non-admin sessions to the client portal or auth page
- Edge functions verify the JWT, extract `user_id`, and confirm the user's role from `profiles` before executing any Sunday tool

---

## 15. Folder Layout

### Frontend (inside taylorurl-com)
```
src/app/
├── views/sunday/
│   ├── SundayToday.jsx
│   ├── SundayTalk.jsx
│   ├── SundayThoughts.jsx
│   ├── SundayMemories.jsx
│   ├── SundayTasks.jsx
│   ├── SundayProjects.jsx
│   ├── SundayProjectDetail.jsx
│   └── SundayDay.jsx
├── components/sunday/
│   ├── MicButton.jsx
│   ├── TranscriptStream.jsx
│   ├── ThoughtFeed.jsx
│   ├── MemoryCard.jsx
│   ├── TaskRow.jsx
│   ├── ProjectCard.jsx
│   ├── SynthesisCard.jsx
│   └── ToolCallChip.jsx
├── hooks/sunday/
│   ├── useAgentChat.js
│   ├── useThoughtStream.js
│   ├── useMemories.js
│   ├── useTasks.js
│   ├── useProjects.js
│   ├── useDispatchLogs.js
│   └── useVoiceCapture.js
├── data/sunday/
│   ├── memoriesClient.js
│   ├── tasksClient.js
│   ├── projectsClient.js
│   ├── dispatchClient.js
│   └── synthesesClient.js
└── constants/sunday/
    ├── routes.js
    ├── persona.js
    └── toolNames.js
```

### Backend (inside taylorurl-com/supabase)
```
supabase/
├── functions/
│   ├── sunday-chat/
│   │   ├── index.ts            # entry, streaming handler
│   │   ├── loop.ts             # agent loop
│   │   ├── prompt.ts           # system prompt composition
│   │   ├── memory.ts           # retrieval + write helpers
│   │   ├── tools/
│   │   │   ├── registry.ts
│   │   │   ├── memory.ts
│   │   │   ├── tasks.ts
│   │   │   ├── projects.ts
│   │   │   ├── homeAssistant.ts
│   │   │   ├── claudeCode.ts
│   │   │   ├── web.ts
│   │   │   └── time.ts
│   │   └── clients/
│   │       ├── anthropic.ts
│   │       └── supabase.ts
│   ├── sunday-stt/
│   │   └── index.ts            # Deepgram passthrough
│   ├── sunday-tts/
│   │   └── index.ts            # ElevenLabs passthrough
│   └── sunday-synthesize/
│       ├── index.ts
│       └── prompt.ts
├── migrations/
│   └── YYYYMMDDHHMMSS_sunday_schema.sql
└── seed/
    └── sunday_seed.sql         # optional starter data
```

### Daemon (separate small project)
```
daemon/sunday-code-daemon/
├── package.json
├── src/
│   ├── index.js                # main loop
│   ├── queue.js                # Supabase subscription + polling
│   ├── runner.js               # spawns Claude Code, streams logs
│   └── config.js               # reads .env, validates
├── launchd/
│   └── com.trentontaylor.sunday-code-daemon.plist
└── README.md                   # install + setup notes for future-Trenton
```

---

## 16. Secrets & Configuration

### Supabase Edge Function secrets (`supabase secrets set ...`)
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY` — used only for embeddings (`text-embedding-3-small`)
- `DEEPGRAM_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `HOME_ASSISTANT_URL`
- `HOME_ASSISTANT_TOKEN`
- `SUNDAY_DEFAULT_USER_ID` — the admin user's UUID (single-user convenience)

### Daemon `.env`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or a dedicated daemon role)
- `SUNDAY_USER_ID`
- `CLAUDE_CODE_BIN` — path to the `claude` CLI binary

### Frontend env (Vite)
No new secrets required — the frontend talks to edge functions via Supabase client and the anon key (already configured).

---

## 17. Implementation Phasing (high level)

The implementation plan (next step, produced by `writing-plans`) will break this into concrete tasks. Rough phasing for orientation:

1. **Database & RLS** — migration with all `sunday_*` tables, indexes, policies
2. **Agent core skeleton** — `sunday-chat` edge function with no tools, just streaming Claude responses
3. **Voice loop** — `sunday-stt`, `sunday-tts`, browser capture, mic button
4. **Routing + admin gate** — `/sunday/*` routes registered, role guard, basic layout
5. **First three tools** — `memory.*`, `tasks.*`, `time.*` (proves the tool architecture end-to-end)
6. **Memory extraction job** — entity extraction after each turn
7. **Smart home tool** — `home_assistant.*` + entity cache cron
8. **Project ledger + UI** — `projects.*` tool, `/sunday/projects` views
9. **Claude Code dispatcher** — `sunday_code_queue`, daemon, `claude_code.dispatch` tool, dispatch logs UI
10. **Daily synthesis** — `sunday-synthesize` + `pg_cron` trigger + `/sunday` Today view
11. **Web tools** — `web.search`, `web.fetch`
12. **Polish pass** — dark/light/gray theme verification, latency tuning, error states

Each phase is a working milestone that can be used immediately even if later phases haven't shipped.

---

## 18. Risks & Open Questions (resolved before implementation)

### Resolved during design
- **Always-listening:** dropped from v1 (web-only constraint)
- **Mobile-native app:** dropped from v1 (web-only)
- **Coding agent inside Sunday:** dropped — Sunday dispatches to Claude Code instead
- **Companion daemon exposure:** resolved via queue-based architecture
- **Backend host:** resolved as Supabase Edge Functions (not Next.js / Vercel functions)

### Acknowledged but accepted for v1
- **Voice latency on cold edge functions:** Supabase Edge Functions cold-start can add ~500ms. Acceptable for v1; can pin warm later if needed.
- **Claude Code dispatch quality depends on brief quality:** Sunday's brief composition will need iteration. Plan accommodates by streaming logs so the user can intervene.
- **Home Assistant exposure:** user is responsible for HA being reachable. Nabu Casa Cloud is the easiest path.
- **Single-user assumption:** schema uses `user_id` to allow expansion, but v1 only ships for the admin user.

### Deferred (post-v1)
- Email / calendar / Slack / Stripe tool slots
- Push notifications for reminders
- Multi-user
- Mobile-native shell with background audio
- Wake word

---

## 19. Success Criteria

Sunday is done with v1 when:

- Trenton can open `/sunday/talk` on his phone, hold the mic, say "Sunday, what's pending on the Acme dashboard," and hear a memory-grounded answer through his AirPods in under 5 seconds.
- He can say "turn off the office lights" and the lights turn off via Home Assistant.
- He can say "fix the date picker bug on Acme — high priority" and watch Sunday dispatch the task to Claude Code on his Mac, with the live log streaming in `/sunday/thoughts`.
- He wakes up to a synthesis of yesterday on `/sunday` each morning.
- Every conversation enriches the memory store, and that memory shows up in the next conversation.
- All `/sunday/*` surfaces work cleanly in dark, light, and gray themes.

---

## 20. Glossary

- **Agent core** — the `sunday-chat` edge function and its tool registry
- **Tool** — a JS function the agent can call, with a typed input schema
- **Memory** — a persisted entity (person, project, decision, preference, fact) extracted from conversation
- **Synthesis** — the nightly summary written by `sunday-synthesize`
- **Dispatch** — a Claude Code job kicked off via the queue
- **Daemon** — the local Node process that drains the dispatch queue
- **Surface** — a route in `/sunday/*` that the user interacts with
