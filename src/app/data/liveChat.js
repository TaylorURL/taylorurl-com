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
 * all, which is the question the widget asks before it appears.
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

export const holdThread = id => held(store => store.setItem(THREAD_KEY, id))

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
 * Once per page, because the probe goes again whenever a hidden tab comes back,
 * and a reader switching tabs is not new information. The collector dedupes
 * across visitors on its own.
 *
 * @param {string} why - What the door answered, in the report's own words.
 */
function tellUsTheAssistantIsGone(why) {
  if (toldOnce || typeof window === 'undefined') return
  toldOnce = true
  console.error(`Live chat: no assistant, so no widget was drawn. ${why}`)
}

/**
 * Whether the assistant is behind the endpoint and would answer a turn sent
 * now.
 *
 * The widget asks before it draws itself. Anything short of a plain yes is a
 * no, including a probe that could not be made: a browser that cannot reach
 * the endpoint cannot reach the assistant through it either, and a corner box
 * offering to answer is worth less than nothing when nothing answers.
 *
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<boolean>}
 */
export async function assistantUp({ signal } = {}) {
  try {
    const response = await fetch(ENDPOINT, { method: 'GET', signal })
    if (!response.ok) {
      tellUsTheAssistantIsGone(`The door answered HTTP ${response.status}.`)
      return false
    }
    const payload = await response.json()
    if (payload.up === true) return true
    tellUsTheAssistantIsGone('The door answered that there is nothing behind it.')
    return false
  } catch (cause) {
    // A probe the widget cancelled itself answers nothing, and calling that a
    // no would record an outage against a page the reader has already left.
    // It is passed on so the caller can drop it.
    if (cause.name === 'AbortError') throw cause
    tellUsTheAssistantIsGone(`The door could not be reached: ${cause.message}`)
    return false
  }
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
