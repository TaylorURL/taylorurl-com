#!/usr/bin/env node
/**
 * Sunday MCP server (stdio).
 * Exposes Sunday's tool registry (memory, tasks, projects, smart home,
 * web, time, claude-code dispatch) to Claude Code via the MCP protocol.
 *
 * Spawned by the chat-runner as: `node src/mcp-server.js`
 * Referenced by Claude Code via the sunday-mcp-config.json shipped alongside.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { getSupabase } from './supabase.js'
import { config } from './config.js'
import { listCachedRepos, listRepoIssues, syncGithubRepos, trackRepoAsProject } from './github.js'
import { fireScheduledPromptById } from './recurring-tasks.js'

const supabase = getSupabase()
const USER_ID = config.userId

const TOOLS = [
  {
    name: 'memory_search',
    description:
      "Search Sunday's persistent memory for relevant entries. Uses Postgres trigram fuzzy text matching, so phrase queries the way a person might mention the thing. Use this aggressively whenever the user references people, projects, decisions, or preferences.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language query.' },
        kinds: {
          type: 'array',
          items: { enum: ['person', 'project', 'decision', 'preference', 'fact'] },
        },
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
      },
      required: ['query'],
    },
    handler: async ({ query, kinds, limit }) => {
      const { data, error } = await supabase.rpc('sunday_match_memories', {
        query_text: query,
        match_count: Math.min(Math.max(Number(limit ?? 8), 1), 20),
        filter_user: USER_ID,
        filter_kinds: Array.isArray(kinds) && kinds.length > 0 ? kinds : null,
      })
      if (error) throw new Error(error.message)
      return { matches: data ?? [] }
    },
  },
  {
    name: 'memory_write',
    description:
      'Persist a durable memory. Use whenever the user shares a stable fact, preference, decision, or entity worth remembering across sessions. source_message_id auto-attributes to the most recent user message if omitted.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { enum: ['person', 'project', 'decision', 'preference', 'fact'] },
        content: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1, default: 0.85 },
        source_message_id: {
          type: 'string',
          description: "Optional. Defaults to the user's most recent message.",
        },
      },
      required: ['kind', 'content'],
    },
    handler: async ({ kind, content, confidence, source_message_id }) => {
      const trimmed = String(content ?? '').trim()
      if (!trimmed) throw new Error('content required')

      // Auto-attribute to the most recent user message if not explicitly provided.
      // The current user turn is what triggered Sunday's thinking, so it's the
      // correct context for the resulting memory.
      let sourceId = source_message_id ?? null
      if (!sourceId) {
        const { data: latest } = await supabase
          .from('sunday_messages')
          .select('id')
          .eq('user_id', USER_ID)
          .eq('role', 'user')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (latest) sourceId = latest.id
      }

      const { data, error } = await supabase
        .from('sunday_memories')
        .insert({
          user_id: USER_ID,
          kind,
          content: trimmed,
          confidence: typeof confidence === 'number' ? confidence : 0.85,
          source_message_id: sourceId,
        })
        .select('id, kind, content, confidence, source_message_id')
        .single()
      if (error) throw new Error(error.message)
      return { memory: data }
    },
  },
  {
    name: 'memory_update',
    description: 'Update an existing memory by id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        content: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['id'],
    },
    handler: async ({ id, content, confidence }) => {
      const patch = {}
      if (typeof content === 'string') patch.content = content.trim()
      if (typeof confidence === 'number') patch.confidence = confidence
      if (Object.keys(patch).length === 0) return { noop: true }
      const { data, error } = await supabase
        .from('sunday_memories')
        .update(patch)
        .eq('id', id)
        .eq('user_id', USER_ID)
        .select('id, kind, content, confidence')
        .single()
      if (error) throw new Error(error.message)
      return { memory: data }
    },
  },
  {
    name: 'memory_delete',
    description: 'Delete a memory by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const { error } = await supabase
        .from('sunday_memories')
        .delete()
        .eq('id', id)
        .eq('user_id', USER_ID)
      if (error) throw new Error(error.message)
      return { deleted: id }
    },
  },
  {
    name: 'tasks_add',
    description:
      'Create a new task. Pass `recurrence` (rule like "daily", "weekdays", "weekly:fri", "monthly:1", "monthly:last") to make a recurring scheduled-prompt template. Pass `fire_time` as "HH:MM" (24-hour) to set when it fires in local time (defaults to 09:00). Pass `prompt` to set the body Sunday runs each time.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        project_id: { type: 'string' },
        priority: { enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
        due: { type: 'string', description: 'ISO 8601 timestamp (one-off tasks only)' },
        recurrence: {
          type: 'string',
          description:
            'Recurrence rule. Examples: "daily", "weekdays", "weekly:fri", "monthly:1", "monthly:last".',
        },
        fire_time: {
          type: 'string',
          description:
            'Local time of day "HH:MM" (24-hour) for the recurrence to fire. Defaults to "09:00". Recurring templates only.',
        },
        prompt: {
          type: 'string',
          description:
            'Prompt to run through the chat pipeline each time this recurring task fires. Recurring templates only.',
        },
      },
      required: ['title'],
    },
    handler: async ({ title, project_id, priority, due, recurrence, fire_time, prompt }) => {
      const isRecurring = !!recurrence
      const { hour, minute } = parseFireTime(fire_time)
      const { data, error } = await supabase
        .from('sunday_tasks')
        .insert({
          user_id: USER_ID,
          title: String(title).trim(),
          project_id: project_id ?? null,
          priority: priority ?? 'normal',
          due: isRecurring ? null : (due ?? null),
          recurrence_rule: recurrence ?? null,
          recurrence_template: isRecurring,
          prompt: isRecurring && prompt ? String(prompt).trim() : null,
          fire_hour: isRecurring ? hour : undefined,
          fire_minute: isRecurring ? minute : undefined,
        })
        .select(
          'id, title, status, priority, due, project_id, recurrence_rule, recurrence_template, prompt, fire_hour, fire_minute'
        )
        .single()
      if (error) throw new Error(error.message)
      return { task: data }
    },
  },
  {
    name: 'tasks_list',
    description:
      'List tasks. Excludes recurring templates (use tasks_recurring_list for those). Filter by project, status, or both.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        status: { enum: ['open', 'in_progress', 'snoozed', 'done', 'cancelled'] },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
      },
    },
    handler: async ({ project_id, status, limit }) => {
      let q = supabase
        .from('sunday_tasks')
        .select('id, title, status, priority, due, project_id, created_at, parent_recurrence_id')
        .eq('user_id', USER_ID)
        .eq('recurrence_template', false)
        .order('priority', { ascending: false })
        .order('due', { ascending: true, nullsFirst: false })
        .limit(Number(limit ?? 25))
      if (project_id) q = q.eq('project_id', project_id)
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return { tasks: data ?? [] }
    },
  },
  {
    name: 'tasks_recurring_list',
    description:
      "List Sunday's scheduled prompts — recurring templates that auto-fire a background chat with their prompt at the rule's local time.",
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const { data, error } = await supabase
        .from('sunday_tasks')
        .select(
          'id, title, recurrence_rule, fire_hour, fire_minute, last_recurrence_fired_at, conversation_id, priority, project_id, prompt, created_at'
        )
        .eq('user_id', USER_ID)
        .eq('recurrence_template', true)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return { recurring: data ?? [] }
    },
  },
  {
    name: 'tasks_recurring_update',
    description:
      'Edit a scheduled prompt\'s title, rule, fire time, prompt, or priority. Pass `fire_time` as "HH:MM" (24-hour) to change when it fires.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        recurrence: {
          type: 'string',
          description:
            'New recurrence rule. Examples: "daily", "weekdays", "weekly:fri", "monthly:1", "monthly:last".',
        },
        fire_time: {
          type: 'string',
          description: 'Local time of day "HH:MM" (24-hour).',
        },
        prompt: { type: 'string' },
        priority: { enum: ['low', 'normal', 'high', 'urgent'] },
      },
      required: ['id'],
    },
    handler: async ({ id, title, recurrence, fire_time, prompt, priority }) => {
      const patch = {}
      if (typeof title === 'string') patch.title = title.trim()
      if (typeof recurrence === 'string') patch.recurrence_rule = recurrence.trim()
      if (typeof prompt === 'string') patch.prompt = prompt.trim()
      if (priority) patch.priority = priority
      if (typeof fire_time === 'string') {
        const { hour, minute } = parseFireTime(fire_time)
        patch.fire_hour = hour
        patch.fire_minute = minute
      }
      if (Object.keys(patch).length === 0) return { noop: true }
      const { data, error } = await supabase
        .from('sunday_tasks')
        .update(patch)
        .eq('id', id)
        .eq('user_id', USER_ID)
        .eq('recurrence_template', true)
        .select('id, title, recurrence_rule, fire_hour, fire_minute, prompt, priority')
        .single()
      if (error) throw new Error(error.message)
      return { template: data }
    },
  },
  {
    name: 'devices_list',
    description:
      'List browsers/devices that have signed in to Sunday. Returns each device with its label, browser, OS, type, first/last seen timestamps, and a live `online` flag (true when last_seen is within 90 seconds).',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const { data, error } = await supabase
        .from('sunday_devices')
        .select(
          'id, label, browser, os, device_type, user_name, first_seen_at, last_seen_at, device_fingerprint'
        )
        .eq('user_id', USER_ID)
        .order('last_seen_at', { ascending: false })
      if (error) throw new Error(error.message)
      const now = Date.now()
      const devices = (data ?? []).map(d => ({
        ...d,
        online: now - new Date(d.last_seen_at).getTime() < 90_000,
      }))
      return { devices }
    },
  },
  {
    name: 'tasks_recurring_run_now',
    description:
      "Fire a scheduled prompt immediately. Opens a background chat with the template's prompt and updates last_recurrence_fired_at so it won't fire again today.",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const result = await fireScheduledPromptById(id)
      return result ?? { fired: false }
    },
  },
  {
    name: 'tasks_recurring_delete',
    description:
      'Delete a scheduled prompt. Stops future auto-firings. Past conversations spawned by it are kept.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const { error } = await supabase
        .from('sunday_tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', USER_ID)
        .eq('recurrence_template', true)
      if (error) throw new Error(error.message)
      return { deleted: id }
    },
  },
  {
    name: 'tasks_complete',
    description: 'Mark a task as done.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const { data, error } = await supabase
        .from('sunday_tasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', USER_ID)
        .select('id, title, status')
        .single()
      if (error) throw new Error(error.message)
      return { task: data }
    },
  },
  {
    name: 'tasks_snooze',
    description: 'Snooze a task until a specific ISO 8601 timestamp.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, until: { type: 'string' } },
      required: ['id', 'until'],
    },
    handler: async ({ id, until }) => {
      const { data, error } = await supabase
        .from('sunday_tasks')
        .update({ status: 'snoozed', snooze_until: until })
        .eq('id', id)
        .eq('user_id', USER_ID)
        .select('id, title, status, snooze_until')
        .single()
      if (error) throw new Error(error.message)
      return { task: data }
    },
  },
  {
    name: 'tasks_update',
    description: 'Update arbitrary task fields.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        status: { enum: ['open', 'in_progress', 'snoozed', 'done', 'cancelled'] },
        priority: { enum: ['low', 'normal', 'high', 'urgent'] },
        due: { type: 'string' },
        project_id: { type: 'string' },
      },
      required: ['id'],
    },
    handler: async args => {
      const patch = {}
      for (const f of ['title', 'status', 'priority', 'due', 'project_id']) {
        if (args[f] !== undefined) patch[f] = args[f]
      }
      if (Object.keys(patch).length === 0) return { noop: true }
      const { data, error } = await supabase
        .from('sunday_tasks')
        .update(patch)
        .eq('id', args.id)
        .eq('user_id', USER_ID)
        .select('id, title, status, priority, due, project_id')
        .single()
      if (error) throw new Error(error.message)
      return { task: data }
    },
  },
  {
    name: 'projects_list',
    description: "List Sunday's known projects. Defaults to active.",
    inputSchema: {
      type: 'object',
      properties: {
        status: { enum: ['active', 'paused', 'archived'], default: 'active' },
      },
    },
    handler: async ({ status }) => {
      let q = supabase
        .from('sunday_projects')
        .select('id, name, repo_path, client, stack, notes, status, updated_at')
        .eq('user_id', USER_ID)
        .order('updated_at', { ascending: false })
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return { projects: data ?? [] }
    },
  },
  {
    name: 'projects_get',
    description: 'Fetch a project and its open tasks by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const { data: project, error: pErr } = await supabase
        .from('sunday_projects')
        .select('id, name, repo_path, client, stack, notes, status, updated_at')
        .eq('id', id)
        .eq('user_id', USER_ID)
        .single()
      if (pErr) throw new Error(pErr.message)
      const { data: tasks } = await supabase
        .from('sunday_tasks')
        .select('id, title, status, priority, due')
        .eq('user_id', USER_ID)
        .eq('project_id', id)
        .in('status', ['open', 'in_progress'])
        .order('priority', { ascending: false })
      return { project, open_tasks: tasks ?? [] }
    },
  },
  {
    name: 'projects_create',
    description: 'Create a new project.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        repo_path: { type: 'string' },
        client: { type: 'string' },
        stack: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['name'],
    },
    handler: async args => {
      const row = { user_id: USER_ID, name: args.name }
      for (const f of ['repo_path', 'client', 'stack', 'notes']) {
        if (args[f] !== undefined) row[f] = args[f]
      }
      const { data, error } = await supabase
        .from('sunday_projects')
        .insert(row)
        .select('id, name, repo_path, client, stack, notes, status')
        .single()
      if (error) throw new Error(error.message)
      return { project: data }
    },
  },
  {
    name: 'projects_update',
    description: 'Update a project.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        repo_path: { type: 'string' },
        client: { type: 'string' },
        stack: { type: 'string' },
        notes: { type: 'string' },
        status: { enum: ['active', 'paused', 'archived'] },
      },
      required: ['id'],
    },
    handler: async args => {
      const patch = {}
      for (const f of ['name', 'repo_path', 'client', 'stack', 'notes', 'status']) {
        if (args[f] !== undefined) patch[f] = args[f]
      }
      if (Object.keys(patch).length === 0) return { noop: true }
      const { data, error } = await supabase
        .from('sunday_projects')
        .update(patch)
        .eq('id', args.id)
        .eq('user_id', USER_ID)
        .select('id, name, status')
        .single()
      if (error) throw new Error(error.message)
      return { project: data }
    },
  },
  {
    name: 'home_assistant_list_entities',
    description:
      'List Home Assistant entities (from the cached snapshot). Use this first to map natural language to entity_id.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'e.g. light, switch, climate, lock' },
        search: { type: 'string' },
      },
    },
    handler: async ({ domain, search }) => {
      const { data, error } = await supabase
        .from('sunday_ha_entities')
        .select('entity_id, friendly_name, domain, state, last_refreshed_at')
        .eq('user_id', USER_ID)
      if (error) throw new Error(error.message)
      let entities = data ?? []
      if (domain) entities = entities.filter(e => e.domain === domain)
      if (search) {
        const needle = String(search).toLowerCase()
        entities = entities.filter(
          e =>
            (e.friendly_name ?? '').toLowerCase().includes(needle) ||
            e.entity_id.toLowerCase().includes(needle)
        )
      }
      return { entities }
    },
  },
  {
    name: 'home_assistant_get_state',
    description: 'Fetch the live state of one Home Assistant entity.',
    inputSchema: {
      type: 'object',
      properties: { entity_id: { type: 'string' } },
      required: ['entity_id'],
    },
    handler: async ({ entity_id }) => {
      const res = await haFetch(`/api/states/${entity_id}`)
      return { state: res }
    },
  },
  {
    name: 'home_assistant_call_service',
    description:
      'Call a Home Assistant service (e.g. domain=light, service=turn_on, entity_id=light.office).',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string' },
        service: { type: 'string' },
        entity_id: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['domain', 'service'],
    },
    handler: async ({ domain, service, entity_id, data }) => {
      const body = { ...(data ?? {}) }
      if (entity_id) body.entity_id = entity_id
      const res = await haFetch(`/api/services/${domain}/${service}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return { result: res }
    },
  },
  {
    name: 'claude_code_dispatch',
    description:
      "Enqueue a coding task for a separate Claude Code session running in a specific project's repo. Use this when the user wants real code changes, not just a chat about code.",
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        brief: { type: 'string' },
        context: { type: 'object' },
      },
      required: ['project_id', 'brief'],
    },
    handler: async ({ project_id, brief, context }) => {
      const { data: project, error: pErr } = await supabase
        .from('sunday_projects')
        .select('id, name, repo_path')
        .eq('id', project_id)
        .eq('user_id', USER_ID)
        .single()
      if (pErr) throw new Error(`project lookup: ${pErr.message}`)
      if (!project?.repo_path) throw new Error('project has no repo_path configured')

      const { data, error } = await supabase
        .from('sunday_code_queue')
        .insert({
          user_id: USER_ID,
          project_id,
          brief: String(brief ?? '').trim(),
          context: context ?? null,
          status: 'pending',
        })
        .select('id, status, created_at')
        .single()
      if (error) throw new Error(error.message)
      return { dispatch: data, project: { id: project.id, name: project.name } }
    },
  },
  {
    name: 'claude_code_status',
    description: 'Check the status and recent logs of a code dispatch.',
    inputSchema: {
      type: 'object',
      properties: { dispatch_id: { type: 'string' } },
      required: ['dispatch_id'],
    },
    handler: async ({ dispatch_id }) => {
      const { data: dispatch, error } = await supabase
        .from('sunday_code_queue')
        .select('id, status, started_at, completed_at, result_summary, brief')
        .eq('id', dispatch_id)
        .eq('user_id', USER_ID)
        .single()
      if (error) throw new Error(error.message)
      const { data: logs } = await supabase
        .from('sunday_code_logs')
        .select('stream, line, created_at')
        .eq('dispatch_id', dispatch_id)
        .order('created_at', { ascending: false })
        .limit(20)
      return { dispatch, recent_logs: (logs ?? []).reverse() }
    },
  },
  {
    name: 'claude_code_list_recent',
    description: 'List recent code dispatches, optionally scoped to one project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
      },
    },
    handler: async ({ project_id, limit }) => {
      let q = supabase
        .from('sunday_code_queue')
        .select('id, project_id, brief, status, created_at, completed_at')
        .eq('user_id', USER_ID)
        .order('created_at', { ascending: false })
        .limit(Number(limit ?? 10))
      if (project_id) q = q.eq('project_id', project_id)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return { dispatches: data ?? [] }
    },
  },
  {
    name: 'web_search',
    description: 'Run a web search and return the top results (title, url, snippet).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        num_results: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
      },
      required: ['query'],
    },
    handler: async ({ query, num_results }) => {
      const params = new URLSearchParams({ q: query })
      const response = await fetch(`https://duckduckgo.com/html/?${params.toString()}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        },
      })
      if (!response.ok) throw new Error(`web_search: ${response.status}`)
      const html = await response.text()
      const results = parseDuckDuckGoResults(html).slice(
        0,
        Math.min(Math.max(Number(num_results ?? 5), 1), 10)
      )
      return { results }
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch a URL and return its text content (HTML stripped).',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        max_chars: { type: 'integer', default: 12000 },
      },
      required: ['url'],
    },
    handler: async ({ url, max_chars }) => {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 SundayBot/1.0' },
      })
      if (!response.ok) throw new Error(`web_fetch: ${response.status}`)
      const html = await response.text()
      const cap = Math.min(Math.max(Number(max_chars ?? 12000), 500), 50000)
      const text = stripHtml(html).slice(0, cap)
      return { url, text, truncated: text.length === cap }
    },
  },
  {
    name: 'github_list_repos',
    description:
      "List the user's GitHub repos from the local cache (refreshed every 15 minutes). Use this to find a repo before tracking it or dispatching a coding task.",
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Substring match on full_name or description.' },
        language: {
          type: 'string',
          description: 'Filter by primary language (e.g. "TypeScript").',
        },
        include_archived: { type: 'boolean', default: false },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
      },
    },
    handler: async ({ search, language, include_archived, limit }) => {
      const repos = await listCachedRepos({
        search,
        language,
        limit,
        includeArchived: !!include_archived,
      })
      return { repos }
    },
  },
  {
    name: 'github_sync',
    description: "Force-refresh the cached list of the user's GitHub repos.",
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const result = await syncGithubRepos()
      return result
    },
  },
  {
    name: 'github_track_repo',
    description:
      "Promote a GitHub repo into a Sunday-tracked project so claude_code_dispatch can target it. Use after the user names a repo by full_name (e.g. 'trentbtaylor/taylorurl-com').",
    inputSchema: {
      type: 'object',
      properties: {
        full_name: { type: 'string', description: 'GitHub owner/repo, e.g. user/repo.' },
        repo_path: {
          type: 'string',
          description: 'Local absolute path. Defaults to GITHUB_CLONE_BASE/name.',
        },
        notes: { type: 'string' },
      },
      required: ['full_name'],
    },
    handler: async ({ full_name, repo_path, notes }) => {
      return await trackRepoAsProject(full_name, { repoPath: repo_path, notes })
    },
  },
  {
    name: 'github_list_issues',
    description:
      'List open issues for a GitHub repo (live, not cached). Pass owner/repo as full_name.',
    inputSchema: {
      type: 'object',
      properties: {
        full_name: { type: 'string' },
        state: { enum: ['open', 'closed', 'all'], default: 'open' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      required: ['full_name'],
    },
    handler: async ({ full_name, state, limit }) => {
      const issues = await listRepoIssues(full_name, { state, limit })
      return { issues }
    },
  },
  {
    name: 'time_now',
    description: 'Return the current time in both UTC and the user-configured timezone.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const tz = config.timezone
      const now = new Date()
      const local = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        dateStyle: 'full',
        timeStyle: 'long',
      }).format(now)
      return { iso_utc: now.toISOString(), local, timezone: tz }
    },
  },
  {
    name: 'time_schedule_reminder',
    description: 'Persist a reminder that will fire at a future ISO timestamp.',
    inputSchema: {
      type: 'object',
      properties: {
        at: { type: 'string' },
        message: { type: 'string' },
        project_id: { type: 'string' },
      },
      required: ['at', 'message'],
    },
    handler: async ({ at, message, project_id }) => {
      const { data, error } = await supabase
        .from('sunday_reminders')
        .insert({
          user_id: USER_ID,
          fire_at: at,
          message: String(message).trim(),
          project_id: project_id ?? null,
        })
        .select('id, message, fire_at, project_id')
        .single()
      if (error) throw new Error(error.message)
      return { reminder: data }
    },
  },
]

// ---------- Helpers ----------

/**
 * Parse a "HH:MM" 24-hour time string into integer hour + minute. Falls back
 * to 09:00 on bad / empty input.
 */
function parseFireTime(input) {
  if (typeof input !== 'string') return { hour: 9, minute: 0 }
  const match = /^(\d{1,2}):(\d{2})$/.exec(input.trim())
  if (!match) return { hour: 9, minute: 0 }
  const hour = Math.max(0, Math.min(23, parseInt(match[1], 10)))
  const minute = Math.max(0, Math.min(59, parseInt(match[2], 10)))
  return { hour, minute }
}

function haFetch(path, init = {}) {
  if (!config.homeAssistantUrl || !config.homeAssistantToken) {
    throw new Error('Home Assistant is not configured')
  }
  return fetch(`${config.homeAssistantUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.homeAssistantToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  }).then(async r => {
    if (!r.ok) throw new Error(`HA ${r.status} ${await r.text().catch(() => '')}`)
    return r.json()
  })
}

function parseDuckDuckGoResults(html) {
  const results = []
  const re =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
  let m
  while ((m = re.exec(html)) !== null) {
    const url = decodeDdgUrl(m[1])
    const title = stripHtml(m[2]).trim()
    const snippet = stripHtml(m[3]).trim()
    if (title && url) results.push({ title, url, snippet })
  }
  return results
}

function decodeDdgUrl(href) {
  try {
    const u = new URL(href, 'https://duckduckgo.com')
    const uddg = u.searchParams.get('uddg')
    return uddg ? decodeURIComponent(uddg) : href
  } catch {
    return href
  }
}

function stripHtml(input) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------- MCP wiring ----------

const server = new Server(
  { name: 'sunday-tools', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}))

server.setRequestHandler(CallToolRequestSchema, async request => {
  const tool = TOOLS.find(t => t.name === request.params.name)
  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    }
  }
  try {
    const result = await tool.handler(request.params.arguments ?? {})
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)

// Keep alive — stdio transport handles signals on disconnect.
