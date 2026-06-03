import { supabase } from '@data/supabaseClient'

/** Create a new conversation row and return its id. */
export async function startConversation({ userId, title } = {}) {
  const { data, error } = await supabase
    .from('sunday_conversations')
    .insert({ user_id: userId, title: title?.slice(0, 80) ?? null })
    .select('id')
    .single()
  if (error) throw new Error(`startConversation: ${error.message}`)
  return data.id
}

/**
 * Enqueue a user message for the local daemon to process via Claude Code Max.
 * The daemon picks up rows where status='pending', writes a streaming assistant
 * row alongside, and broadcasts updates via Supabase Realtime.
 */
export async function enqueueUserMessage({ conversationId, userId, content }) {
  const { error } = await supabase.from('sunday_messages').insert({
    conversation_id: conversationId,
    user_id: userId,
    role: 'user',
    content,
    status: 'pending',
  })
  if (error) throw new Error(`enqueueUserMessage: ${error.message}`)
}
