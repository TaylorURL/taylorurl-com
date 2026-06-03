import { spawn } from 'node:child_process'
import { config } from './config.js'
import { getSupabase } from './supabase.js'

const supabase = getSupabase()
const ALLOWED_KINDS = new Set(['person', 'project', 'decision', 'preference', 'fact'])

const EXTRACTION_SYSTEM_PROMPT = `You analyze a single chat turn between Trenton and Sunday and identify any DURABLE memories worth persisting across sessions.

Output a single strict JSON object — nothing else:
{
  "memories": [
    { "kind": "person|project|decision|preference|fact", "content": "specific factual statement", "confidence": 0.0-1.0 }
  ]
}

Rules:
- Only stable facts that should be true tomorrow, next week, next month.
- SKIP transient context: greetings, questions, things Sunday just looked up, weather, time, ephemeral state.
- SKIP tool-call narration: "I'll search now…", "I called X…" — those are not memories.
- Be SPECIFIC. "Trenton lives in Baytown, Texas" not "Trenton lives somewhere".
- Confidence: 0.95 explicitly stated · 0.7 strongly implied · 0.4 inferred guess. Skip anything below 0.4.
- Output {"memories":[]} if nothing notable. Empty array is correct most of the time.
- Output JSON only. No prose, no code fences.`

/**
 * Run a background memory extraction pass on a completed turn.
 * Fire-and-forget — caller doesn't await.
 */
export async function extractMemoriesFromTurn({ userMessage, assistantText, userMessageId }) {
  const userText = (userMessage ?? '').trim()
  const assistantTextTrimmed = (assistantText ?? '').trim()
  if (!userText && !assistantTextTrimmed) return

  const prompt = [
    `Trenton: ${userText || '(no message)'}`,
    `Sunday: ${assistantTextTrimmed || '(no response)'}`,
    '',
    'Extract memories.',
  ].join('\n')

  const raw = await runClaudeExtraction(prompt).catch(err => {
    console.error('[memory-extract] claude invocation failed', err)
    return null
  })
  if (!raw) return

  const parsed = parseJson(raw)
  const memories = Array.isArray(parsed?.memories) ? parsed.memories : []
  if (memories.length === 0) return

  for (const m of memories) {
    const kind = String(m.kind ?? '').trim()
    const content = String(m.content ?? '').trim()
    const confidence = typeof m.confidence === 'number' ? m.confidence : null
    if (!ALLOWED_KINDS.has(kind)) continue
    if (!content) continue
    if (confidence !== null && confidence < 0.4) continue

    try {
      await supabase.from('sunday_memories').insert({
        user_id: config.userId,
        kind,
        content,
        confidence: confidence ?? 0.7,
        source_message_id: userMessageId ?? null,
      })
    } catch (err) {
      console.error('[memory-extract] insert failed', err)
    }
  }
  console.log(
    `[memory-extract] persisted ${memories.length} candidate memor${memories.length === 1 ? 'y' : 'ies'}`
  )
}

function runClaudeExtraction(prompt) {
  return new Promise((resolve, reject) => {
    const args = [
      '--print',
      '--output-format',
      'text',
      '--append-system-prompt',
      EXTRACTION_SYSTEM_PROMPT,
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
    child.stdout.on('data', c => (stdout += c.toString()))
    child.stderr.on('data', c => (stderr += c.toString()))
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr.trim() || `claude exited ${code}`))
    })
  })
}

function parseJson(raw) {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}
