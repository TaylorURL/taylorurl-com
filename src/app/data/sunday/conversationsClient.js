import { supabase } from '@data/supabaseClient'

const CONVERSATION_FIELDS = 'id, title, started_at, last_message_at'

export async function listConversations({ limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('sunday_conversations')
    .select(CONVERSATION_FIELDS)
    .order('last_message_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getConversation(id) {
  const { data, error } = await supabase
    .from('sunday_conversations')
    .select(CONVERSATION_FIELDS)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/**
 * Delete a conversation. The FK on sunday_messages cascades, so all message
 * rows and tool-call rows tied to this conversation are removed automatically.
 * RLS scopes to the authenticated user.
 */
export async function deleteConversation(id) {
  const { error } = await supabase.from('sunday_conversations').delete().eq('id', id)
  if (error) throw error
}

export async function renameConversation(id, title) {
  const { data, error } = await supabase
    .from('sunday_conversations')
    .update({ title: title?.slice(0, 80) ?? null })
    .eq('id', id)
    .select(CONVERSATION_FIELDS)
    .single()
  if (error) throw error
  return data
}
