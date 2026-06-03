import { spawn } from 'node:child_process'
import { config } from './config.js'
import { getSupabase } from './supabase.js'

const supabase = getSupabase()

/**
 * Run nightly synthesis via `claude --print`. Writes/upserts a row into
 * sunday_syntheses for the given date.
 */
export async function runSynthesis(date) {
  const day = date ?? formatLocalDate(new Date(), config.timezone)
  const userId = config.userId

  const start = new Date(`${day}T00:00:00`).toISOString()
  const end = new Date(`${day}T23:59:59.999`).toISOString()

  const [{ data: messages }, { data: toolCalls }, { data: prev }] = await Promise.all([
    supabase
      .from('sunday_messages')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true }),
    supabase
      .from('sunday_tool_calls')
      .select('tool_name, error, created_at')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end),
    supabase
      .from('sunday_syntheses')
      .select('date, summary')
      .eq('user_id', userId)
      .lt('date', day)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const prompt = buildSynthesisPrompt({
    date: day,
    messages: messages ?? [],
    toolCalls: toolCalls ?? [],
    previousSummary: prev?.summary ?? null,
  })

  const raw = await runClaudeOneShot(prompt, {
    systemAppend:
      'You are Sunday writing a nightly synthesis. Be terse and structural, no filler. Output ONE strict JSON object — no preamble, no code fences.',
  })

  const parsed = extractJson(raw)
  const row = {
    user_id: userId,
    date: day,
    summary: String(parsed?.summary ?? '').trim(),
    themes: parsed?.themes ?? [],
    accomplishments: parsed?.accomplishments ?? [],
    pending: parsed?.pending ?? [],
    queued_for_tomorrow: parsed?.queued_for_tomorrow ?? [],
    surprises: parsed?.surprises ?? [],
  }

  await supabase
    .from('sunday_syntheses')
    .upsert(row, { onConflict: 'user_id,date' })

  return { date: day, summary: row.summary }
}

function buildSynthesisPrompt({ date, messages, toolCalls, previousSummary }) {
  const lines = [`Date: ${date}`, '']
  if (previousSummary) {
    lines.push(`Previous day summary (for continuity): ${previousSummary}`, '')
  }
  if (messages.length === 0) {
    lines.push("No conversations occurred today.")
  } else {
    lines.push("Today's conversation:")
    for (const m of messages) {
      const role = m.role === 'assistant' ? 'Sunday' : 'Trenton'
      lines.push(`[${role}] ${m.content ?? ''}`)
    }
  }
  lines.push('')
  lines.push(`Tool calls today: ${toolCalls.length}`)
  const byTool = {}
  for (const tc of toolCalls) byTool[tc.tool_name] = (byTool[tc.tool_name] ?? 0) + 1
  for (const [name, count] of Object.entries(byTool)) {
    lines.push(`  ${name}: ${count}`)
  }
  lines.push('')
  lines.push(
    'Produce one JSON object with these fields exactly: summary (2-4 sentence string), themes (string[]), accomplishments (string[]), pending (string[]), queued_for_tomorrow (string[]), surprises (string[]).',
  )
  return lines.join('\n')
}

function runClaudeOneShot(prompt, { systemAppend }) {
  return new Promise((resolve, reject) => {
    const args = [
      '--print',
      '--output-format',
      'text',
      '--append-system-prompt',
      systemAppend,
    ]
    const child = spawn(config.claudeBin, args, {
      cwd: config.rootDir,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdin.write(prompt)
    child.stdin.end()
    child.stdout.on('data', (c) => (stdout += c.toString()))
    child.stderr.on('data', (c) => (stderr += c.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr.trim() || `claude exited ${code}`))
    })
  })
}

function extractJson(raw) {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return {}
  try {
    return JSON.parse(match[0])
  } catch {
    return {}
  }
}

function formatLocalDate(date, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
