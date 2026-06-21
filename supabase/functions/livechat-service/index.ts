// supabase/functions/livechat-service/index.ts
//
// Live-chat assistant for taylorurl.com. Streams Anthropic's Messages API back
// to the browser, persists every turn to Supabase, and handles the
// capture_lead tool round-trip so the model can file leads mid-conversation.
//
// Public function (verify_jwt = false in supabase/config.toml). Auth is
// gateway-only — request origin is checked here, plus a per-session rate
// limit. The Anthropic key, service-role key, and Resend key never leave
// this runtime.

import { callAnthropic, CAPTURE_LEAD_TOOL, type ChatMessage } from './_shared/anthropic.ts'
import { buildSystemPrompt } from './_shared/prompt.ts'
import { corsHeaders, preflightResponse, resolveOrigin } from './_shared/cors.ts'
import {
  fetchRecentMessages,
  insertLead,
  insertMessage,
  upsertConversation,
} from './_shared/db.ts'
import { sendLeadNotification } from './_shared/notify.ts'
import { checkRateLimit } from './_shared/rate-limit.ts'

const MAX_USER_MESSAGE_CHARS = 2000
const MAX_HISTORY_TURNS_SENT = 10
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ChatRequest = {
  sessionId?: unknown
  message?: unknown
  pageUrl?: unknown
}

type CaptureLeadArgs = { name: string; email: string; project: string }

type AnthropicSseEvent = {
  type: string
  index?: number
  delta?: {
    type?: string
    text?: string
    partial_json?: string
    stop_reason?: string
  }
  content_block?: {
    type: string
    id?: string
    name?: string
    text?: string
    input?: Record<string, unknown>
  }
  message?: { stop_reason?: string }
}

function jsonResponse(
  origin: string | null,
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

function badRequest(origin: string | null, message: string): Response {
  return jsonResponse(origin, 400, { error: message })
}

function isCaptureLeadArgs(value: unknown): value is CaptureLeadArgs {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.project === 'string'
  )
}

/**
 * Read Anthropic's SSE stream, forward visible text deltas to the writer as
 * plain text chunks, and collect any tool_use block so the caller can act on
 * it after the stream ends. Returns whatever assistant content blocks the
 * model emitted (text + tool_use), suitable for replaying back as an
 * assistant message in a follow-up turn.
 */
async function pumpAnthropicStream(
  response: Response,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
): Promise<{
  text: string
  toolUse: {
    id: string
    name: string
    inputJson: string
  } | null
  stopReason: string | null
}> {
  if (!response.body) {
    throw new Error('Anthropic returned an empty body.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let assistantText = ''
  let toolUseId: string | null = null
  let toolUseName: string | null = null
  let toolUseInputJson = ''
  let stopReason: string | null = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let eventEnd = buffer.indexOf('\n\n')
    while (eventEnd !== -1) {
      const rawEvent = buffer.slice(0, eventEnd)
      buffer = buffer.slice(eventEnd + 2)
      eventEnd = buffer.indexOf('\n\n')

      const dataLine = rawEvent
        .split('\n')
        .find((line) => line.startsWith('data: '))
      if (!dataLine) continue

      const dataPayload = dataLine.slice('data: '.length).trim()
      if (!dataPayload || dataPayload === '[DONE]') continue

      let event: AnthropicSseEvent
      try {
        event = JSON.parse(dataPayload) as AnthropicSseEvent
      } catch {
        continue
      }

      if (event.type === 'content_block_start' && event.content_block) {
        if (event.content_block.type === 'tool_use') {
          toolUseId = event.content_block.id ?? null
          toolUseName = event.content_block.name ?? null
          toolUseInputJson = ''
        }
      } else if (event.type === 'content_block_delta' && event.delta) {
        if (event.delta.type === 'text_delta' && typeof event.delta.text === 'string') {
          assistantText += event.delta.text
          await writer.write(encoder.encode(event.delta.text))
        } else if (
          event.delta.type === 'input_json_delta' &&
          typeof event.delta.partial_json === 'string'
        ) {
          toolUseInputJson += event.delta.partial_json
        }
      } else if (event.type === 'message_delta' && event.delta?.stop_reason) {
        stopReason = event.delta.stop_reason
      }
    }
  }

  const toolUse =
    toolUseId && toolUseName
      ? { id: toolUseId, name: toolUseName, inputJson: toolUseInputJson }
      : null

  return { text: assistantText, toolUse, stopReason }
}

async function handleCaptureLeadCall(args: {
  conversationId: string
  pageUrl: string | null
  rawInputJson: string
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(args.rawInputJson || '{}')
  } catch {
    return { ok: false, message: 'Tool input was not valid JSON. Ask the visitor again.' }
  }
  if (!isCaptureLeadArgs(parsed)) {
    return {
      ok: false,
      message: 'Missing name, email, or project. Ask for whichever is missing.',
    }
  }

  const name = parsed.name.trim().slice(0, 120)
  const email = parsed.email.trim().slice(0, 200)
  const project = parsed.project.trim().slice(0, 600)

  if (!name || !email || !project) {
    return {
      ok: false,
      message: 'Name, email, and project all need a value. Ask the visitor again.',
    }
  }
  if (!EMAIL_REGEX.test(email)) {
    return {
      ok: false,
      message: 'That email does not look valid. Ask the visitor to retype it.',
    }
  }

  const transcript = await fetchRecentMessages(args.conversationId, 12)
  const notified = await sendLeadNotification({
    name,
    email,
    project,
    pageUrl: args.pageUrl,
    transcript,
  })

  await insertLead({
    conversationId: args.conversationId,
    name,
    email,
    project,
    notified,
  })

  return {
    ok: true,
    message:
      'Lead saved. Confirm to the visitor that Trenton will reach out within 24 hours, and remind them they can also email trenton@taylorurl.com directly.',
  }
}

Deno.serve(async (request) => {
  const origin = resolveOrigin(request)
  if (request.method === 'OPTIONS') return preflightResponse(origin)
  if (request.method !== 'POST') {
    return jsonResponse(origin, 405, { error: 'Method not allowed.' })
  }
  if (!origin) {
    return jsonResponse(null, 403, { error: 'Origin not allowed.' })
  }

  let payload: ChatRequest
  try {
    payload = (await request.json()) as ChatRequest
  } catch {
    return badRequest(origin, 'Request body must be JSON.')
  }

  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : ''
  const message = typeof payload.message === 'string' ? payload.message : ''
  const pageUrl =
    typeof payload.pageUrl === 'string' && payload.pageUrl.length <= 500
      ? payload.pageUrl
      : null

  if (!sessionId || sessionId.length < 8 || sessionId.length > 120) {
    return badRequest(origin, 'sessionId is required.')
  }
  if (!message.trim()) {
    return badRequest(origin, 'message is required.')
  }
  if (message.length > MAX_USER_MESSAGE_CHARS) {
    return badRequest(origin, 'Message is too long. Try shortening it.')
  }

  const rate = checkRateLimit(sessionId)
  if (!rate.ok) {
    return new Response(
      JSON.stringify({ error: 'Slow down for a moment — too many messages too fast.' }),
      {
        status: 429,
        headers: {
          ...corsHeaders(origin),
          'Content-Type': 'application/json',
          'Retry-After': String(rate.retryAfterSeconds),
        },
      },
    )
  }

  const trimmedUserMessage = message.trim()
  const userAgent = request.headers.get('user-agent')?.slice(0, 400) ?? null

  let conversationId: string
  try {
    conversationId = await upsertConversation({
      sessionId,
      pageUrl,
      userAgent,
    })
  } catch (error) {
    console.error('[livechat-service] upsertConversation failed', error)
    return jsonResponse(origin, 500, { error: 'Could not start the chat session.' })
  }

  try {
    await insertMessage({ conversationId, role: 'user', content: trimmedUserMessage })
  } catch (error) {
    console.error('[livechat-service] insertMessage(user) failed', error)
    // Continue — the assistant can still reply even if logging failed.
  }

  const history = await fetchRecentMessages(conversationId, MAX_HISTORY_TURNS_SENT * 2)
  const conversationMessages: ChatMessage[] = history.map((row) => ({
    role: row.role,
    content: row.content,
  }))

  const systemPrompt = buildSystemPrompt()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()
  const encoder = new TextEncoder()

  const responseHeaders = {
    ...corsHeaders(origin),
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Conversation-Id': conversationId,
  }

  const pump = async () => {
    let assistantTextSoFar = ''
    try {
      const firstResponse = await callAnthropic({
        system: systemPrompt,
        messages: conversationMessages,
        stream: true,
      })
      if (!firstResponse.ok) {
        const body = await firstResponse.text().catch(() => '')
        console.error('[livechat-service] Anthropic error', firstResponse.status, body)
        await writer.write(
          encoder.encode(
            "\nSomething went sideways on my end. Try again in a moment — or just email Trenton at trenton@taylorurl.com.",
          ),
        )
        return
      }

      const firstPass = await pumpAnthropicStream(firstResponse, writer, encoder)
      assistantTextSoFar += firstPass.text

      // If the model called a tool, run it and stream a second pass with the
      // tool result so the assistant can confirm to the visitor.
      if (firstPass.toolUse?.name === CAPTURE_LEAD_TOOL.name) {
        const toolResult = await handleCaptureLeadCall({
          conversationId,
          pageUrl,
          rawInputJson: firstPass.toolUse.inputJson,
        })

        const assistantContentBlocks: ChatMessage['content'] = []
        if (firstPass.text) {
          assistantContentBlocks.push({ type: 'text', text: firstPass.text })
        }
        assistantContentBlocks.push({
          type: 'tool_use',
          id: firstPass.toolUse.id,
          name: firstPass.toolUse.name,
          input: (() => {
            try {
              return JSON.parse(firstPass.toolUse.inputJson || '{}') as Record<string, unknown>
            } catch {
              return {}
            }
          })(),
        })

        const followUpMessages: ChatMessage[] = [
          ...conversationMessages,
          { role: 'assistant', content: assistantContentBlocks },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: firstPass.toolUse.id,
                content: toolResult.message,
                is_error: !toolResult.ok,
              },
            ],
          },
        ]

        const secondResponse = await callAnthropic({
          system: systemPrompt,
          messages: followUpMessages,
          stream: true,
        })
        if (secondResponse.ok) {
          const secondPass = await pumpAnthropicStream(secondResponse, writer, encoder)
          assistantTextSoFar += secondPass.text
        } else {
          await writer.write(
            encoder.encode(
              "\nYour info is saved — Trenton will reach out shortly. You can also email him at trenton@taylorurl.com.",
            ),
          )
        }
      }
    } catch (error) {
      console.error('[livechat-service] streaming failure', error)
      try {
        await writer.write(
          encoder.encode(
            '\nLost the connection to the assistant. Try again, or email trenton@taylorurl.com directly.',
          ),
        )
      } catch {
        // writer already closed
      }
    } finally {
      try {
        await writer.close()
      } catch {
        // already closed
      }
      const finalText = assistantTextSoFar.trim()
      if (finalText) {
        try {
          await insertMessage({ conversationId, role: 'assistant', content: finalText })
        } catch (error) {
          console.error('[livechat-service] insertMessage(assistant) failed', error)
        }
      }
    }
  }

  // Fire-and-forget the pump so the response can start streaming immediately.
  pump()

  return new Response(stream.readable, { status: 200, headers: responseHeaders })
})
