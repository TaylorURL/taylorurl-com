import { spawn } from 'node:child_process'
import { config } from './config.js'
import { getSupabase } from './supabase.js'

const supabase = getSupabase()

/**
 * Process one pending code dispatch end-to-end:
 *   1. Atomically claim it (pending → running).
 *   2. Look up project + repo_path.
 *   3. Spawn `claude --print` in the repo with the brief.
 *   4. Stream stdout/stderr lines into sunday_code_logs.
 *   5. Mark completed/failed.
 */
export async function runDispatch(dispatch) {
  const startedAt = new Date().toISOString()

  const { data: claimed } = await supabase
    .from('sunday_code_queue')
    .update({ status: 'running', started_at: startedAt })
    .eq('id', dispatch.id)
    .eq('status', 'pending')
    .select('id')
    .single()
  if (!claimed) return { skipped: true }

  const { data: project, error: pErr } = await supabase
    .from('sunday_projects')
    .select('id, name, repo_path')
    .eq('id', dispatch.project_id)
    .eq('user_id', config.userId)
    .single()
  if (pErr || !project?.repo_path) {
    await failDispatch(dispatch.id, `Project lookup failed: ${pErr?.message ?? 'no repo_path'}`)
    return { failed: true }
  }

  await emitLog(dispatch.id, 'meta', `Starting Claude Code in ${project.repo_path}`)

  try {
    const summary = await runClaudeCode({
      dispatch,
      project,
      onLine: (stream, line) => emitLog(dispatch.id, stream, line),
    })
    await supabase
      .from('sunday_code_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result_summary: summary,
      })
      .eq('id', dispatch.id)
    await emitLog(dispatch.id, 'meta', 'Completed')
    return { completed: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await failDispatch(dispatch.id, message)
    return { failed: true }
  }
}

async function failDispatch(id, message) {
  await supabase
    .from('sunday_code_queue')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      result_summary: message.slice(0, 1000),
    })
    .eq('id', id)
  await emitLog(id, 'stderr', `FAILED: ${message}`)
}

async function emitLog(dispatchId, stream, line) {
  if (!line) return
  await supabase.from('sunday_code_logs').insert({
    dispatch_id: dispatchId,
    user_id: config.userId,
    stream,
    line: String(line).slice(0, 8000),
  })
}

function runClaudeCode({ dispatch, project, onLine }) {
  return new Promise((resolve, reject) => {
    const prompt = composePrompt(dispatch, project)
    const args = ['--print', '--output-format', 'stream-json', '--verbose']
    const child = spawn(config.claudeBin, args, {
      cwd: project.repo_path,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdoutBuffer = ''
    let stderrBuffer = ''
    let lastResultText = ''

    child.stdin.write(prompt)
    child.stdin.end()

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString()
      let idx
      while ((idx = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.slice(0, idx).trim()
        stdoutBuffer = stdoutBuffer.slice(idx + 1)
        if (!line) continue
        const parsed = safeParseJson(line)
        if (parsed) {
          const summary = summarizeJsonEvent(parsed)
          if (summary.summary) onLine('stdout', summary.summary)
          if (summary.resultText) lastResultText = summary.resultText
        } else {
          onLine('stdout', line)
        }
      }
    })

    child.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString()
      let idx
      while ((idx = stderrBuffer.indexOf('\n')) !== -1) {
        const line = stderrBuffer.slice(0, idx).trim()
        stderrBuffer = stderrBuffer.slice(idx + 1)
        if (line) onLine('stderr', line)
      }
    })

    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (stdoutBuffer.trim()) onLine('stdout', stdoutBuffer.trim())
      if (stderrBuffer.trim()) onLine('stderr', stderrBuffer.trim())
      if (code === 0) {
        resolve(lastResultText.trim() || 'Completed successfully.')
      } else {
        reject(new Error(`Claude Code exited with code ${code}`))
      }
    })
  })
}

function composePrompt(dispatch, project) {
  const parts = [
    `You are working in the "${project.name}" repository (at ${project.repo_path}).`,
    '',
    'TASK FROM SUNDAY:',
    dispatch.brief,
  ]
  if (dispatch.context && Object.keys(dispatch.context).length > 0) {
    parts.push('', 'CONTEXT:', JSON.stringify(dispatch.context, null, 2))
  }
  parts.push('', 'Apply edits, run tests, and report a concise summary of what changed when finished.')
  return parts.join('\n')
}

function safeParseJson(line) {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function summarizeJsonEvent(event) {
  if (event.type === 'assistant' && event.message?.content) {
    const text = (event.message.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
    return { summary: text ? `[assistant] ${text.slice(0, 400)}` : null, resultText: text }
  }
  if (event.type === 'user' && event.message?.content) {
    const text = (event.message.content || [])
      .filter((b) => b.type === 'tool_result')
      .map((b) => (typeof b.content === 'string' ? b.content : JSON.stringify(b.content)))
      .join(' ')
    return { summary: text ? `[tool_result] ${text.slice(0, 300)}` : null }
  }
  if (event.type === 'result' && event.result) {
    return { summary: `[result] ${String(event.result).slice(0, 400)}`, resultText: event.result }
  }
  if (event.subtype || event.tool_use) {
    return { summary: `[${event.type ?? 'event'}] ${JSON.stringify(event).slice(0, 200)}` }
  }
  return { summary: null }
}
