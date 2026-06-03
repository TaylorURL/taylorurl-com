import { supabase } from '@data/supabaseClient'

const TASK_FIELDS =
  'id, project_id, title, status, priority, due, snooze_until, completed_at, created_at, updated_at, parent_recurrence_id'
const RECURRING_FIELDS =
  'id, title, recurrence_rule, fire_hour, fire_minute, last_recurrence_fired_at, conversation_id, priority, project_id, prompt, created_at'

// ---------- one-off tasks (used by Today + ProjectDetail panels) ----------

export async function listTasks({ status, projectId, limit = 200 } = {}) {
  let query = supabase
    .from('sunday_tasks')
    .select(TASK_FIELDS)
    .eq('recurrence_template', false)
    .order('priority', { ascending: false })
    .order('due', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    if (Array.isArray(status)) query = query.in('status', status)
    else query = query.eq('status', status)
  }
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function listOpenTasks() {
  return listTasks({ status: ['open', 'in_progress'] })
}

export async function createTask({
  userId,
  title,
  priority = 'normal',
  projectId = null,
  due = null,
}) {
  const { data, error } = await supabase
    .from('sunday_tasks')
    .insert({
      user_id: userId,
      title: title.trim(),
      priority,
      project_id: projectId,
      due,
    })
    .select(TASK_FIELDS)
    .single()
  if (error) throw error
  return data
}

export async function completeTask(id) {
  const { error } = await supabase
    .from('sunday_tasks')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function reopenTask(id) {
  const { error } = await supabase
    .from('sunday_tasks')
    .update({ status: 'open', completed_at: null })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTask(id) {
  const { error } = await supabase.from('sunday_tasks').delete().eq('id', id)
  if (error) throw error
}

// ---------- scheduled prompts (the Tasks page) ----------

export async function listScheduledPrompts() {
  const { data, error } = await supabase
    .from('sunday_tasks')
    .select(RECURRING_FIELDS)
    .eq('recurrence_template', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createScheduledPrompt({
  userId,
  title,
  rule,
  prompt,
  priority = 'normal',
  projectId = null,
  fireHour = 9,
  fireMinute = 0,
}) {
  const { data, error } = await supabase
    .from('sunday_tasks')
    .insert({
      user_id: userId,
      title: title.trim(),
      priority,
      project_id: projectId,
      recurrence_rule: rule,
      recurrence_template: true,
      prompt: prompt?.trim() || title.trim(),
      fire_hour: clampHour(fireHour),
      fire_minute: clampMinute(fireMinute),
    })
    .select(RECURRING_FIELDS)
    .single()
  if (error) throw error
  return data
}

export async function updateScheduledPrompt(id, patch) {
  const allowed = [
    'title',
    'recurrence_rule',
    'prompt',
    'priority',
    'project_id',
    'fire_hour',
    'fire_minute',
  ]
  const sanitized = {}
  for (const key of allowed) {
    if (patch[key] !== undefined) sanitized[key] = patch[key]
  }
  if (Object.keys(sanitized).length === 0) return null
  if (typeof sanitized.title === 'string') sanitized.title = sanitized.title.trim()
  if (typeof sanitized.prompt === 'string') sanitized.prompt = sanitized.prompt.trim()
  if (typeof sanitized.fire_hour === 'number') sanitized.fire_hour = clampHour(sanitized.fire_hour)
  if (typeof sanitized.fire_minute === 'number')
    sanitized.fire_minute = clampMinute(sanitized.fire_minute)
  const { data, error } = await supabase
    .from('sunday_tasks')
    .update(sanitized)
    .eq('id', id)
    .eq('recurrence_template', true)
    .select(RECURRING_FIELDS)
    .single()
  if (error) throw error
  return data
}

function clampHour(h) {
  const n = Math.round(Number(h))
  if (!Number.isFinite(n)) return 9
  return Math.max(0, Math.min(23, n))
}

function clampMinute(m) {
  const n = Math.round(Number(m))
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(59, n))
}

export async function deleteScheduledPrompt(id) {
  const { error } = await supabase
    .from('sunday_tasks')
    .delete()
    .eq('id', id)
    .eq('recurrence_template', true)
  if (error) throw error
}

/**
 * Manually fire a scheduled prompt right now. Mirrors what the daemon does
 * on a scheduled tick: opens a fresh conversation, posts the prompt as a
 * pending user message, and stamps the template so it doesn't re-fire today.
 *
 * Returns the new conversation id so callers can navigate to it.
 */
export async function runScheduledPromptNow({ userId, template }) {
  const promptText = (template.prompt ?? '').trim() || (template.title ?? '').trim()
  if (!promptText) throw new Error('Template has no prompt or title to run')

  const { data: conversation, error: convError } = await supabase
    .from('sunday_conversations')
    .insert({ user_id: userId, title: template.title })
    .select('id')
    .single()
  if (convError) throw convError

  const { error: msgError } = await supabase.from('sunday_messages').insert({
    conversation_id: conversation.id,
    user_id: userId,
    role: 'user',
    content: promptText,
    status: 'pending',
  })
  if (msgError) throw msgError

  await supabase
    .from('sunday_tasks')
    .update({
      last_recurrence_fired_at: new Date().toISOString(),
      conversation_id: conversation.id,
    })
    .eq('id', template.id)

  return conversation.id
}
