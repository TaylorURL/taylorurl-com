// Tiny service-role Supabase client used by the live-chat function.
//
// We bypass the JS client SDK to keep this function lightweight; PostgREST
// is a fine fit for the few writes we do. The service role key is
// auto-injected as `SUPABASE_SERVICE_ROLE_KEY` in every Supabase function
// runtime.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.warn(
    '[livechat-service] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — DB writes will fail.',
  )
}

const HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

type ConversationRow = {
  id: string
  session_id: string
}

async function postgrestRequest(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers as Record<string, string> | undefined) },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`PostgREST ${response.status} on ${path}: ${body}`)
  }
  return response
}

/**
 * Look up or create the conversation row for a session id. Returns the
 * conversation uuid. Stamps page_url + user_agent on insert; updates
 * last_message_at on every call so stale sessions can be aged out later.
 */
export async function upsertConversation(args: {
  sessionId: string
  pageUrl: string | null
  userAgent: string | null
}): Promise<string> {
  const existingResponse = await postgrestRequest(
    `chat_conversations?select=id,session_id&session_id=eq.${encodeURIComponent(args.sessionId)}&limit=1`,
    { method: 'GET' },
  )
  const existing = (await existingResponse.json()) as ConversationRow[]
  if (existing.length > 0) {
    await postgrestRequest(
      `chat_conversations?id=eq.${existing[0].id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ last_message_at: new Date().toISOString() }),
      },
    )
    return existing[0].id
  }

  const insertResponse = await postgrestRequest('chat_conversations', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      session_id: args.sessionId,
      page_url: args.pageUrl,
      user_agent: args.userAgent,
    }),
  })
  const inserted = (await insertResponse.json()) as ConversationRow[]
  return inserted[0].id
}

export async function insertMessage(args: {
  conversationId: string
  role: 'user' | 'assistant'
  content: string
}): Promise<void> {
  await postgrestRequest('chat_messages', {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: args.conversationId,
      role: args.role,
      content: args.content,
    }),
  })
}

export async function insertLead(args: {
  conversationId: string
  name: string
  email: string
  project: string
  notified: boolean
}): Promise<void> {
  await postgrestRequest('chat_leads', {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: args.conversationId,
      name: args.name,
      email: args.email,
      project: args.project,
      source: 'livechat',
      notified_at: args.notified ? new Date().toISOString() : null,
    }),
  })
}

export async function fetchRecentMessages(conversationId: string, limit = 8): Promise<
  Array<{ role: 'user' | 'assistant'; content: string; created_at: string }>
> {
  const response = await postgrestRequest(
    `chat_messages?select=role,content,created_at&conversation_id=eq.${conversationId}&order=created_at.desc&limit=${limit}`,
    { method: 'GET' },
  )
  const rows = (await response.json()) as Array<{
    role: 'user' | 'assistant'
    content: string
    created_at: string
  }>
  return rows.reverse()
}
