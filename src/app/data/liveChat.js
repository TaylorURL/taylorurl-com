/**
 * The browser's half of the chat widget.
 *
 * One turn goes out, one reply comes back, and the thread id the endpoint
 * returns is what makes the next turn a continuation rather than a fresh start.
 *
 * The id lives in sessionStorage. A visitor moving between pages keeps the
 * thread they were in the middle of, and closing the tab ends it -- which is
 * the lifetime a stranger would assume a chat box has, and the one that leaves
 * nothing of theirs on a shared machine.
 *
 * The same endpoint says whether there is an assistant to send a turn to at
 * all, which is the question the widget asks before it appears. It is asked
 * more than once, because a no and an outage are not the same fact.
 *
 * Both calls take a signal and the widget aborts it as it unmounts. A request
 * still in flight when a reader leaves the page is cancelled by the browser
 * either way; the signal is what makes it arrive as a cancellation rather than
 * as a connection that failed.
 */

import { faultFromResponse } from '../utils/faults.js'

const ENDPOINT = '/api/live-chat'
const THREAD_KEY = 'taylorurl_live_thread'

/** Storage that answers even where the browser refuses it. */
function held(read) {
  if (typeof window === 'undefined') return null
  try {
    return read(window.sessionStorage)
  } catch {
    // Private windows and blocked site data both throw on access rather than
    // returning empty. A thread that cannot be remembered still works; every
    // turn simply starts a new one.
    return null
  }
}

export const threadHeld = () => held(store => store.getItem(THREAD_KEY))

const holdThread = id => held(store => store.setItem(THREAD_KEY, id))

export const dropThread = () => held(store => store.removeItem(THREAD_KEY))

/** Whether this page has already said the assistant was missing. */
let toldOnce = false

/**
 * Says, once, that the site is serving pages with no assistant on them.
 *
 * The widget removing itself is the correct answer to an assistant that would
 * not reply, and it is also the one fault on this site that nothing was able to
 * see. Every other break announces itself: a chunk that will not load, a script
 * that throws, an endpoint answering 500 - the reporter in the page head is
 * watching for all of those and files a ticket the error routine claims within
 * ten minutes. A probe that answers `{"up": false}` is none of them. It is a
 * clean, fast, correct HTTP 200, so the reporter sees a request that worked, the
 * uptime monitor sees a site returning 200, and the daily routine sees a
 * PageSpeed score that is if anything better for the widget being gone. The
 * queue stays empty, and an empty queue reads exactly like a working site.
 *
 * `console.error` is the door, and it is the one the reporter opened for this:
 * it wraps the three console methods precisely so that code addressing whoever
 * maintains the site can reach them rather than the visitor, and it swallows
 * what it takes. Nothing is written to a reader's console. Nowhere else in the
 * app writes to one either, and this is the exception rather than a new habit -
 * the site has not had anything to say to us before.
 *
 * Once per page, and only once every ask has been spent, because the sentence
 * claims no widget was drawn and that is not true of a page whose second ask
 * was answered. The collector dedupes across visitors on its own.
 *
 * @param {string} why - What the door answered, in the report's own words.
 */
function tellUsTheAssistantIsGone(why) {
  if (toldOnce || typeof window === 'undefined') return
  toldOnce = true
  console.error(`Live chat: no assistant, so no widget was drawn. ${why}`)
}

/**
 * How long the widget waits before asking again, and so how many times it asks:
 * once on arrival, and once after each of these.
 *
 * A no is not the same fact as an outage. The knock behind this endpoint
 * crosses the open internet to a machine on a home connection, and that route
 * loses a connection now and then with the assistant itself up throughout.
 * Production has the endpoint answering at 22:52, both of its knocks failing at
 * 22:55, and answering again at 22:59, against a service that had not restarted
 * in four days. One ask was all the widget made, so that visitor had no chat on
 * any page of their visit and the disappearance arrived as a fault.
 *
 * The first gap clears the ten seconds the endpoint holds a no in front of the
 * function, because anything shorter is handed the same answer back rather than
 * a fresh one. The rest widen to cover a lost moment measured in minutes
 * without turning a real outage into a poll. Four asks, and then the page has
 * its answer.
 */
export const ASK_GAPS_MS = [12000, 30000, 60000]

/** An abort as the browser raises one, so a caller can tell it from a refusal. */
const cancelled = () => Object.assign(new Error('The probe was cancelled.'), { name: 'AbortError' })

/** A wait between asks that a reader leaving the page cuts short. */
function rest(ms, signal) {
  return new Promise((settle, drop) => {
    if (signal?.aborted) {
      drop(cancelled())
      return
    }
    const stop = () => {
      clearTimeout(timer)
      drop(cancelled())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', stop)
      settle()
    }, ms)
    signal?.addEventListener('abort', stop, { once: true })
  })
}

/**
 * One ask, as the answer and the words the door answered it in.
 *
 * `why` is what the report would say, and it is null where there is nothing
 * worth saying. A probe that never arrived is a different fact from the two
 * above it: those are the endpoint answering, and this is nothing answering at
 * all. It stays a no - a browser that cannot reach the endpoint cannot reach
 * the assistant through it either - but it is not said out loud, because the
 * sentence would name the assistant for a fault that belongs to the connection,
 * and because the reporter's own fetch wrapper has already judged this exact
 * rejection with more to go on than there is here. It knows whether a
 * controller aborted the request, whether `pagehide` has fired and the reader
 * is simply leaving, and what the platform called it; a reader closing the tab
 * mid-probe produces a bare `TypeError: Failed to fetch` with no name on it,
 * indistinguishable from an outage by anything this function can see. Saying it
 * again from up here both files it twice and files it under the wrong cause.
 *
 * @returns {Promise<{ up: boolean, why: string|null }>}
 */
async function askOnce(signal) {
  try {
    const response = await fetch(ENDPOINT, { method: 'GET', signal })
    if (!response.ok) return { up: false, why: `The door answered HTTP ${response.status}.` }
    const payload = await response.json()
    if (payload.up === true) return { up: true, why: null }
    // `wired: false` is the door saying it was never built with anything behind
    // it, which only a branch build answers. That is a fact about where this
    // copy of the site is running rather than something that broke, so the
    // widget stays off the page in silence: the report would name an assistant
    // as missing from a build that was never given one, and it would be filed
    // by every branch build the site ever puts up, in the same words as a real
    // outage on the live site.
    if (payload.wired === false) return { up: false, why: null }
    return { up: false, why: 'The door answered that there is nothing behind it.' }
  } catch (cause) {
    // A probe the widget cancelled itself answers nothing, and calling that a
    // no would record an outage against a page the reader has already left. It
    // is passed on so the caller can drop it.
    if (cause.name === 'AbortError') throw cause
    return { up: false, why: null }
  }
}

/**
 * Whether the assistant is behind the endpoint and would answer a turn sent
 * now.
 *
 * The widget asks before it draws itself. Anything short of a plain yes is a
 * no, including a probe that could not be made: a corner box offering to answer
 * is worth less than nothing when nothing answers.
 *
 * A no is asked again rather than kept, on the gaps above, and the first yes
 * ends it. Only a no that survives every ask is the answer, and only that one
 * is reported - a widget that arrived late arrived.
 *
 * @param {{ signal?: AbortSignal, gapsMs?: number[] }} [options]
 * @returns {Promise<boolean>}
 */
export async function assistantUp({ signal, gapsMs = ASK_GAPS_MS } = {}) {
  let last = { up: false, why: null }

  for (let asked = 0; asked <= gapsMs.length; asked += 1) {
    if (asked > 0) await rest(gapsMs[asked - 1], signal)
    last = await askOnce(signal)
    if (last.up) return true
  }

  if (last.why) tellUsTheAssistantIsGone(last.why)
  return false
}

/**
 * Sends one turn.
 *
 * A refusal is thrown as a sentence rather than as a status, and the widget
 * shows it the way it shows anything else the assistant says. Only some of
 * those sentences are the endpoint's - a rate limiter or a gateway in front of
 * it answers in its own words and lands in the same field - so what comes back
 * goes through the one door before it is set beside the assistant's own turns,
 * where anything unwritten reads as the assistant saying it.
 *
 * @param {{ message: string, path?: string, signal?: AbortSignal }} turn
 * @returns {Promise<{ reply: string, session: string|null, offline: boolean }>}
 */
export async function sendTurn({ message, path, signal }) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session: threadHeld(), path }),
    signal,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      faultFromResponse(response, payload, 'The assistant did not answer. Try again in a moment.')
    )
  }

  if (payload.session) holdThread(payload.session)

  return {
    reply: payload.reply,
    session: payload.session || null,
    offline: Boolean(payload.offline),
  }
}
