import { spawn } from 'node:child_process'
import { config } from './config.js'
import { getSupabase } from './supabase.js'
import { SUNDAY_PERSONA, composeSystemBlock } from './persona.js'
import { extractMemoriesFromTurn } from './memory-extractor.js'

const supabase = getSupabase()
const MAX_HISTORY_TURNS = 30
const FLUSH_MIN_INTERVAL_MS = 180

const SUNDAY_TOOL_PREFIX = 'mcp__sunday__'
const ALLOWED_TOOLS = [
  `${SUNDAY_TOOL_PREFIX}memory_search`,
  `${SUNDAY_TOOL_PREFIX}memory_write`,
  `${SUNDAY_TOOL_PREFIX}memory_update`,
  `${SUNDAY_TOOL_PREFIX}memory_delete`,
  `${SUNDAY_TOOL_PREFIX}tasks_add`,
  `${SUNDAY_TOOL_PREFIX}tasks_list`,
  `${SUNDAY_TOOL_PREFIX}tasks_complete`,
  `${SUNDAY_TOOL_PREFIX}tasks_snooze`,
  `${SUNDAY_TOOL_PREFIX}tasks_update`,
  `${SUNDAY_TOOL_PREFIX}tasks_recurring_list`,
  `${SUNDAY_TOOL_PREFIX}tasks_recurring_update`,
  `${SUNDAY_TOOL_PREFIX}tasks_recurring_run_now`,
  `${SUNDAY_TOOL_PREFIX}tasks_recurring_delete`,
  `${SUNDAY_TOOL_PREFIX}projects_list`,
  `${SUNDAY_TOOL_PREFIX}projects_get`,
  `${SUNDAY_TOOL_PREFIX}projects_create`,
  `${SUNDAY_TOOL_PREFIX}projects_update`,
  `${SUNDAY_TOOL_PREFIX}home_assistant_list_entities`,
  `${SUNDAY_TOOL_PREFIX}home_assistant_get_state`,
  `${SUNDAY_TOOL_PREFIX}home_assistant_call_service`,
  `${SUNDAY_TOOL_PREFIX}claude_code_dispatch`,
  `${SUNDAY_TOOL_PREFIX}claude_code_status`,
  `${SUNDAY_TOOL_PREFIX}claude_code_list_recent`,
  `${SUNDAY_TOOL_PREFIX}web_search`,
  `${SUNDAY_TOOL_PREFIX}web_fetch`,
  `${SUNDAY_TOOL_PREFIX}time_now`,
  `${SUNDAY_TOOL_PREFIX}time_schedule_reminder`,
  `${SUNDAY_TOOL_PREFIX}github_list_repos`,
  `${SUNDAY_TOOL_PREFIX}github_sync`,
  `${SUNDAY_TOOL_PREFIX}github_track_repo`,
  `${SUNDAY_TOOL_PREFIX}github_list_issues`,
  `${SUNDAY_TOOL_PREFIX}devices_list`,
].join(',')

/**
 * Process one pending user message.
 *
 * Steps:
 *   1. Claim the user row (status 'pending' → 'complete').
 *   2. Create an assistant placeholder row (status='streaming', content='').
 *   3. Load recent conversation history.
 *   4. Spawn `claude --print` with Sunday's MCP config + system prompt.
 *   5. Stream stdout JSON events; accumulate assistant text and append tool calls.
 *   6. Update the assistant row periodically with content and tool_calls.
 *   7. Mark assistant row 'complete' (or 'error').
 *   8. Update conversation.last_message_at.
 */
export async function processUserMessage(userRow) {
  const conversationId = userRow.conversation_id

  // Atomic claim: only proceed if this message is still 'pending'. Prevents
  // double-processing when both Realtime and polling fire for the same row.
  const { data: claimed } = await supabase
    .from('sunday_messages')
    .update({ status: 'complete' })
    .eq('id', userRow.id)
    .eq('status', 'pending')
    .select('id')
    .single()
  if (!claimed) {
    return { skipped: true, reason: 'already claimed' }
  }

  const history = await loadConversationHistory(conversationId, userRow.id)
  const memories = await retrieveMemories(userRow.content)
  const syntheses = await loadRecentSyntheses(3)

  const assistantId = await createAssistantPlaceholder(conversationId)

  const systemBlock = composeSystemBlock({
    memories,
    recentSyntheses: syntheses,
    localTime: localTimeString(),
    timezone: config.timezone,
  })

  const prompt = buildPrompt(history, userRow.content)

  let accumulated = ''
  const toolCalls = []
  let lastFlush = 0

  const flush = async (force = false) => {
    const now = Date.now()
    if (!force && now - lastFlush < FLUSH_MIN_INTERVAL_MS) return
    lastFlush = now
    await supabase
      .from('sunday_messages')
      .update({ content: accumulated, tool_calls: toolCalls.length > 0 ? toolCalls : null })
      .eq('id', assistantId)
  }

  try {
    await runClaude({
      prompt,
      systemAppend: systemBlock,
      onText: async chunk => {
        accumulated += chunk
        await flush()
      },
      onToolUse: async toolUse => {
        toolCalls.push({
          id: toolUse.id,
          toolName: prettyToolName(toolUse.name),
          input: toolUse.input,
          status: 'running',
          startedAt: Date.now(),
        })
        await flush(true)
        await supabase.from('sunday_tool_calls').insert({
          user_id: config.userId,
          message_id: assistantId,
          tool_name: prettyToolName(toolUse.name),
          input: toolUse.input,
        })
      },
      onToolResult: async toolResult => {
        const entry = toolCalls.find(t => t.id === toolResult.tool_use_id)
        if (entry) {
          entry.status = toolResult.is_error ? 'error' : 'complete'
          entry.output = toolResult.content
          entry.durationMs = entry.startedAt ? Date.now() - entry.startedAt : undefined
          delete entry.startedAt
        }
        await flush(true)
      },
    })

    await supabase
      .from('sunday_messages')
      .update({
        content: accumulated,
        tool_calls: toolCalls.length > 0 ? toolCalls : null,
        status: 'complete',
      })
      .eq('id', assistantId)

    await supabase
      .from('sunday_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    // Background memory extraction — fire-and-forget. Runs a separate
    // `claude --print` to identify durable facts in this turn.
    extractMemoriesFromTurn({
      userMessage: userRow.content,
      assistantText: accumulated,
      userMessageId: userRow.id,
    }).catch(err => console.error('[memory-extract] failed', err))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[chat-runner] turn failed: ${message}`)
    await supabase
      .from('sunday_messages')
      .update({
        content: accumulated || '',
        status: 'error',
        error: message,
        tool_calls: toolCalls.length > 0 ? toolCalls : null,
      })
      .eq('id', assistantId)
  }
}

async function createAssistantPlaceholder(conversationId) {
  const { data, error } = await supabase
    .from('sunday_messages')
    .insert({
      conversation_id: conversationId,
      user_id: config.userId,
      role: 'assistant',
      content: '',
      status: 'streaming',
    })
    .select('id')
    .single()
  if (error) throw new Error(`create assistant placeholder: ${error.message}`)
  return data.id
}

async function loadConversationHistory(conversationId, excludingId) {
  // Include historical (null status) + complete + errored rows.
  // Skip pending/streaming — those are in-flight or other unclaimed user turns;
  // including them would duplicate when the daemon eventually picks them up.
  const { data, error } = await supabase
    .from('sunday_messages')
    .select('role, content, status, created_at')
    .eq('conversation_id', conversationId)
    .neq('id', excludingId)
    .in('role', ['user', 'assistant'])
    .or('status.is.null,status.eq.complete,status.eq.error')
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_TURNS)
  if (error) return []
  return (data ?? []).reverse()
}

async function retrieveMemories(query) {
  if (!query?.trim()) return []
  const { data } = await supabase.rpc('sunday_match_memories', {
    query_text: query,
    match_count: 8,
    filter_user: config.userId,
    filter_kinds: null,
  })
  return data ?? []
}

async function loadRecentSyntheses(limit = 3) {
  const { data } = await supabase
    .from('sunday_syntheses')
    .select('date, summary')
    .eq('user_id', config.userId)
    .order('date', { ascending: false })
    .limit(limit)
  return data ?? []
}

function buildPrompt(history, latest) {
  const lines = []
  if (history.length > 0) {
    lines.push('Conversation so far:')
    for (const h of history) {
      const speaker = h.role === 'assistant' ? 'Sunday' : 'Trenton'
      lines.push(`${speaker}: ${h.content ?? ''}`)
    }
    lines.push('')
    lines.push('New turn:')
  }
  lines.push(`Trenton: ${latest}`)
  return lines.join('\n')
}

function localTimeString() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(new Date())
}

function prettyToolName(rawName) {
  return rawName.startsWith(SUNDAY_TOOL_PREFIX) ? rawName.slice(SUNDAY_TOOL_PREFIX.length) : rawName
}

/**
 * Invoke `claude --print --output-format stream-json --mcp-config ...` and parse
 * each stream-json event. Calls the supplied handlers as text / tool events arrive.
 * Resolves when the child exits cleanly.
 */
function runClaude({ prompt, systemAppend, onText, onToolUse, onToolResult }) {
  return new Promise((resolve, reject) => {
    const args = [
      '--print',
      '--output-format',
      'stream-json',
      '--verbose',
      '--mcp-config',
      config.mcpConfigPath,
      '--allowedTools',
      ALLOWED_TOOLS,
      '--append-system-prompt',
      systemAppend,
    ]
    const child = spawn(config.claudeBin, args, {
      cwd: config.rootDir,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdoutBuffer = ''
    let stderrBuffer = ''

    child.stdin.write(prompt)
    child.stdin.end()

    child.stdout.on('data', chunk => {
      stdoutBuffer += chunk.toString()
      let idx
      while ((idx = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.slice(0, idx).trim()
        stdoutBuffer = stdoutBuffer.slice(idx + 1)
        if (!line) continue
        const event = safeParseJson(line)
        if (!event) continue
        handleEvent(event, { onText, onToolUse, onToolResult }).catch(e =>
          console.error('[chat-runner] handler error', e)
        )
      }
    })

    child.stderr.on('data', chunk => {
      stderrBuffer += chunk.toString()
    })

    child.on('error', err => reject(err))
    child.on('close', code => {
      if (code !== 0) {
        const err = stderrBuffer.trim() || `claude exited with code ${code}`
        reject(new Error(err))
      } else {
        resolve()
      }
    })
  })
}

async function handleEvent(event, { onText, onToolUse, onToolResult }) {
  if (!event || typeof event !== 'object') return

  if (event.type === 'assistant' && event.message?.content) {
    for (const block of event.message.content) {
      if (block.type === 'text' && block.text) {
        await onText(block.text)
      } else if (block.type === 'tool_use') {
        await onToolUse({ id: block.id, name: block.name, input: block.input })
      }
    }
  } else if (event.type === 'user' && event.message?.content) {
    for (const block of event.message.content) {
      if (block.type === 'tool_result') {
        await onToolResult({
          tool_use_id: block.tool_use_id,
          content: block.content,
          is_error: !!block.is_error,
        })
      }
    }
  } else if (event.type === 'result' && typeof event.result === 'string') {
    // Some CC versions emit the final text only in the `result` event. If we
    // never received an assistant text block, fall back to the result.
    // We can't easily detect that here, so just append; duplicates are tolerable
    // and rare in practice.
    // (Intentionally no-op — onText handles assistant text blocks.)
  }
}

function safeParseJson(line) {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}
