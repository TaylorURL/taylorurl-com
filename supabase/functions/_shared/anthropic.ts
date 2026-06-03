const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

export const SONNET_MODEL = 'claude-sonnet-4-5-20250929'
export const HAIKU_MODEL = 'claude-haiku-4-5-20250929'

export interface AnthropicTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
        | {
            type: 'tool_result'
            tool_use_id: string
            content: string
            is_error?: boolean
          }
      >
}

export interface StreamRequest {
  model: string
  system: string
  messages: AnthropicMessage[]
  tools?: AnthropicTool[]
  max_tokens?: number
}

/** Iterate the Anthropic streaming SSE response, yielding parsed JSON events. */
export async function* streamAnthropic(req: StreamRequest): AsyncGenerator<Record<string, unknown>> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing')

  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: req.model,
      system: req.system,
      messages: req.messages,
      tools: req.tools,
      max_tokens: req.max_tokens ?? 4096,
      stream: true,
    }),
  })

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '(no body)')
    throw new Error(`Anthropic ${response.status}: ${text}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let cutoff
    while ((cutoff = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, cutoff)
      buffer = buffer.slice(cutoff + 2)
      const event = parseSseEvent(chunk)
      if (event) yield event
    }
  }
}

function parseSseEvent(chunk: string): Record<string, unknown> | null {
  const dataLines = chunk
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
  if (dataLines.length === 0) return null
  const payload = dataLines.join('\n')
  if (!payload || payload === '[DONE]') return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

/** Non-streaming Claude call for short subtasks (entity extraction, synthesis, etc.). */
export async function callAnthropic(req: StreamRequest): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing')

  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: req.model,
      system: req.system,
      messages: req.messages,
      tools: req.tools,
      max_tokens: req.max_tokens ?? 2048,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '(no body)')
    throw new Error(`Anthropic ${response.status}: ${text}`)
  }

  const json = await response.json()
  const block = (json.content ?? []).find((b: { type: string }) => b.type === 'text')
  return block?.text ?? ''
}
