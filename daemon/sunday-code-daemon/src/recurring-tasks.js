import { config } from './config.js'
import { getSupabase } from './supabase.js'

const supabase = getSupabase()

const VALID_DOWS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
const WEEKDAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri'])
const DEFAULT_FIRE_HOUR = 9 // fallback when a template predates fire_hour
const DEFAULT_FIRE_MINUTE = 0

function tzPart(date, tz, options) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...options }).format(date)
}

function localDateKey(date, tz) {
  // YYYY-MM-DD in tz
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date)
}

/**
 * Decide whether a template should fire right now.
 * One fire per rule-match-day, gated to after FIRE_HOUR in local time.
 *
 * Supported rules:
 *   "daily"           — every day
 *   "weekdays"        — Mon–Fri
 *   "weekly:mon"      — every Monday (mon|tue|wed|thu|fri|sat|sun)
 *   "monthly:1"       — Nth day of the month (1–31)
 *   "monthly:last"    — last day of the month
 */
export function shouldFireRule(
  rule,
  now,
  lastFiredAt,
  tz,
  fireHour = DEFAULT_FIRE_HOUR,
  fireMinute = DEFAULT_FIRE_MINUTE
) {
  if (!rule) return false
  const todayStr = localDateKey(now, tz)
  const lastStr = lastFiredAt ? localDateKey(new Date(lastFiredAt), tz) : null
  if (lastStr === todayStr) return false // already fired today

  const hour = parseInt(tzPart(now, tz, { hour: '2-digit', hour12: false }), 10)
  const minute = parseInt(tzPart(now, tz, { minute: '2-digit' }), 10)
  const localMinutes = hour * 60 + minute
  const fireMinutes = fireHour * 60 + fireMinute
  if (localMinutes < fireMinutes) return false

  if (rule === 'daily') return true

  const dow = tzPart(now, tz, { weekday: 'short' }).toLowerCase()
  if (rule === 'weekdays') return WEEKDAYS.has(dow)

  if (rule.startsWith('weekly:')) {
    const target = rule.slice(7).trim().toLowerCase()
    return VALID_DOWS.has(target) && dow === target
  }

  if (rule.startsWith('monthly:')) {
    const target = rule.slice(8).trim().toLowerCase()
    const day = parseInt(tzPart(now, tz, { day: 'numeric' }), 10)
    if (target === 'last') {
      const tomorrow = new Date(now.getTime() + 25 * 60 * 60 * 1000)
      const tomorrowDay = parseInt(tzPart(tomorrow, tz, { day: 'numeric' }), 10)
      return tomorrowDay < day
    }
    const n = parseInt(target, 10)
    return Number.isFinite(n) && n === day
  }
  return false
}

/**
 * For every recurring template whose rule says "fire today" and hasn't fired
 * yet today, open a background conversation with the template's prompt as a
 * pending user message. The chat-runner picks the message up and processes
 * it through the normal Sunday chat pipeline — same MCP tools, same persona,
 * same memory — so the result appears in the Chat tab automatically.
 */
export async function runDueScheduledPrompts() {
  const { data: templates, error } = await supabase
    .from('sunday_tasks')
    .select('id, title, prompt, recurrence_rule, last_recurrence_fired_at, fire_hour, fire_minute')
    .eq('user_id', config.userId)
    .eq('recurrence_template', true)
    .not('recurrence_rule', 'is', null)
  if (error) throw new Error(`recurring fetch: ${error.message}`)
  if (!templates?.length) return { fired: 0 }

  const now = new Date()
  let fired = 0
  for (const tpl of templates) {
    if (
      !shouldFireRule(
        tpl.recurrence_rule,
        now,
        tpl.last_recurrence_fired_at,
        config.timezone,
        tpl.fire_hour ?? DEFAULT_FIRE_HOUR,
        tpl.fire_minute ?? DEFAULT_FIRE_MINUTE
      )
    ) {
      continue
    }
    try {
      const result = await fireScheduledPrompt(tpl, now)
      if (result) fired++
    } catch (err) {
      console.error(`[recurring] fire failed for ${tpl.id}:`, err?.message ?? err)
    }
  }
  return { fired }
}

/**
 * Manual "Run now" — bypasses shouldFireRule and fires immediately.
 * Used by the Tasks page button and by the tasks_recurring_run_now MCP tool.
 */
export async function fireScheduledPromptById(templateId) {
  const { data: tpl, error } = await supabase
    .from('sunday_tasks')
    .select('id, title, prompt')
    .eq('id', templateId)
    .eq('user_id', config.userId)
    .eq('recurrence_template', true)
    .single()
  if (error) throw new Error(`recurring lookup: ${error.message}`)
  return fireScheduledPrompt(tpl, new Date())
}

async function fireScheduledPrompt(tpl, now) {
  const prompt = (tpl.prompt ?? '').trim() || (tpl.title ?? '').trim()
  if (!prompt) {
    console.warn(`[recurring] template ${tpl.id} has neither prompt nor title — skipping`)
    return null
  }

  const { data: conv, error: convErr } = await supabase
    .from('sunday_conversations')
    .insert({
      user_id: config.userId,
      title: tpl.title,
    })
    .select('id')
    .single()
  if (convErr) throw new Error(`conversation create: ${convErr.message}`)

  const { error: msgErr } = await supabase.from('sunday_messages').insert({
    conversation_id: conv.id,
    user_id: config.userId,
    role: 'user',
    content: prompt,
    status: 'pending',
  })
  if (msgErr) throw new Error(`message create: ${msgErr.message}`)

  await supabase
    .from('sunday_tasks')
    .update({
      last_recurrence_fired_at: now.toISOString(),
      conversation_id: conv.id,
    })
    .eq('id', tpl.id)

  console.log(`[recurring] fired "${tpl.title}" → conversation ${conv.id.slice(0, 8)}`)
  return { conversation_id: conv.id }
}
