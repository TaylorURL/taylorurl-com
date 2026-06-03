import { supabase } from '@data/supabaseClient'

export async function listMessages({ conversationId, limit = 200 }) {
  const { data, error } = await supabase
    .from('sunday_messages')
    .select('id, role, content, tool_calls, tool_results, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function listMessagesForDate(date) {
  const start = new Date(`${date}T00:00:00.000Z`).toISOString()
  const end = new Date(`${date}T23:59:59.999Z`).toISOString()
  const { data, error } = await supabase
    .from('sunday_messages')
    .select('id, role, content, tool_calls, tool_results, created_at, conversation_id')
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}
