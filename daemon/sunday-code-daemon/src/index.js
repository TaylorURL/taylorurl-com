import { assertClaudeBinExists, config } from './config.js'
import { getSupabase } from './supabase.js'
import { processUserMessage } from './chat-runner.js'
import { runDispatch } from './code-runner.js'
import { runSynthesis } from './synthesizer.js'
import { syncGithubRepos } from './github.js'
import { runDueScheduledPrompts } from './recurring-tasks.js'

const supabase = getSupabase()

assertClaudeBinExists()

console.log(
  `[sunday-daemon] starting — user=${config.userId.slice(0, 8)} claude=${config.claudeBin}`
)
console.log(
  `[sunday-daemon] chat poll ${config.chatPollIntervalMs}ms · code poll ${config.pollIntervalMs}ms · tz ${config.timezone}`
)

// ---------- Single-flight tickers ----------

let chatRunning = false
let codeRunning = false

async function chatTick() {
  if (chatRunning) return
  chatRunning = true
  try {
    const { data: pending, error } = await supabase
      .from('sunday_messages')
      .select('id, conversation_id, content, created_at')
      .eq('user_id', config.userId)
      .eq('role', 'user')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
    if (error) throw error
    if (!pending || pending.length === 0) return
    console.log(`[chat] processing message ${pending[0].id}`)
    await processUserMessage(pending[0])
  } catch (err) {
    console.error('[chat] tick error', err)
  } finally {
    chatRunning = false
  }
}

async function codeTick() {
  if (codeRunning) return
  codeRunning = true
  try {
    const { data: rows, error } = await supabase
      .from('sunday_code_queue')
      .select('id, project_id, brief, context, status, created_at')
      .eq('user_id', config.userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
    if (error) throw error
    if (!rows || rows.length === 0) return
    console.log(`[code] processing dispatch ${rows[0].id}`)
    await runDispatch(rows[0])
  } catch (err) {
    console.error('[code] tick error', err)
  } finally {
    codeRunning = false
  }
}

// ---------- Synthesis scheduler ----------

let lastSynthesisDate = null

async function synthesisTick() {
  try {
    const now = new Date()
    const localHour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: config.timezone,
        hour: 'numeric',
        hour12: false,
      }).format(now)
    )
    if (localHour < config.synthesisHourLocal) return
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
    if (lastSynthesisDate === today) return

    // Check DB to be sure we haven't already written today's synthesis.
    const { data: existing } = await supabase
      .from('sunday_syntheses')
      .select('date')
      .eq('user_id', config.userId)
      .eq('date', today)
      .maybeSingle()
    if (existing) {
      lastSynthesisDate = today
      return
    }

    console.log(`[synthesis] generating for ${today}`)
    await runSynthesis(today)
    lastSynthesisDate = today
  } catch (err) {
    console.error('[synthesis] error', err)
  }
}

// ---------- Realtime wakeup ----------

const channel = supabase
  .channel('sunday-daemon-wakeup')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'sunday_messages',
      filter: `user_id=eq.${config.userId}`,
    },
    payload => {
      if (payload.new?.role === 'user' && payload.new?.status === 'pending') {
        chatTick().catch(e => console.error('[chat] realtime tick error', e))
      }
    }
  )
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'sunday_code_queue',
      filter: `user_id=eq.${config.userId}`,
    },
    payload => {
      if (payload.new?.status === 'pending') {
        codeTick().catch(e => console.error('[code] realtime tick error', e))
      }
    }
  )
  .subscribe(status => {
    console.log(`[realtime] ${status}`)
  })

// ---------- GitHub sync ----------

let githubRunning = false
async function githubTick() {
  if (githubRunning || !config.githubToken) return
  githubRunning = true
  try {
    const result = await syncGithubRepos()
    if (result?.synced !== undefined) {
      const trackedNote = result.autoTracked ? ` · auto-tracked ${result.autoTracked} new` : ''
      console.log(`[github] synced ${result.synced} repos${trackedNote}`)
    }
  } catch (err) {
    console.error('[github] sync error', err)
  } finally {
    githubRunning = false
  }
}

// ---------- Recurring tasks ----------

let recurringRunning = false
async function recurringTick() {
  if (recurringRunning) return
  recurringRunning = true
  try {
    const result = await runDueScheduledPrompts()
    if (result?.fired > 0) {
      console.log(`[recurring] fired ${result.fired} prompt${result.fired === 1 ? '' : 's'}`)
    }
  } catch (err) {
    console.error('[recurring] tick error', err)
  } finally {
    recurringRunning = false
  }
}

// ---------- Polling fallbacks ----------

setInterval(chatTick, config.chatPollIntervalMs)
setInterval(codeTick, config.pollIntervalMs)
setInterval(synthesisTick, 60_000)
setInterval(githubTick, config.githubSyncIntervalMs)
setInterval(recurringTick, 5 * 60_000)

// Kick off immediately so a backlog gets drained on startup.
chatTick()
codeTick()
synthesisTick()
githubTick()
recurringTick()

// ---------- Shutdown ----------

function shutdown(signal) {
  console.log(`[sunday-daemon] ${signal} — shutting down`)
  try {
    supabase.removeChannel(channel)
  } catch {
    /* ignore */
  }
  process.exit(0)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
