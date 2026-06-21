// Thin Anthropic Messages API wrapper. Streams via SSE; supports a single
// round-trip of tool use so the model can call `capture_lead` mid-response.

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

export type ChatMessage = {
  role: 'user' | 'assistant'
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
        | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
      >
}

export const CAPTURE_LEAD_TOOL = {
  name: 'capture_lead',
  description:
    "Save a prospective customer's contact info so Trenton can reach out personally. Call this only when the visitor has provided a name, an email that looks valid, and a one-line description of what they want built. Do not call it speculatively.",
  input_schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: "The visitor's full name as they gave it.",
      },
      email: {
        type: 'string',
        description: "The visitor's email address. Must look like a real address.",
      },
      project: {
        type: 'string',
        description:
          'One short sentence describing the project — what kind of business, what they need.',
      },
    },
    required: ['name', 'email', 'project'],
  },
} as const

type AnthropicRequestBody = {
  model: string
  max_tokens: number
  system: string
  messages: ChatMessage[]
  tools: typeof CAPTURE_LEAD_TOOL[]
  stream: boolean
}

export async function callAnthropic(args: {
  system: string
  messages: ChatMessage[]
  stream: boolean
}): Promise<Response> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured.')
  }

  const body: AnthropicRequestBody = {
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: args.system,
    messages: args.messages,
    tools: [CAPTURE_LEAD_TOOL],
    stream: args.stream,
  }

  return await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}
