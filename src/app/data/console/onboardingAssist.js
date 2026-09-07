/**
 * The browser's half of the writing help inside a client's brief.
 *
 * A client answering the brief is being asked to describe their own business in
 * a box, which is the hardest thing on the form and the part nobody enjoys. The
 * assistant behind `/api/onboarding-assist` rewrites what they typed, and this
 * is what asks it.
 *
 * One promise runs through the whole module: nothing here throws, and nothing
 * here hands back less than what went in. `sendTurn` in `liveChat.js` throws
 * and the widget puts the visitor's message back in the composer, which works
 * because a chat message is one sentence. What is at risk here is four
 * paragraphs somebody spent ten minutes on, and a rejected promise reaching the
 * wrong catch is exactly how those are lost. So every path - a refusal, a
 * ceiling, a Pi nobody can reach, a browser with no network - resolves to the
 * same object carrying the caller's own text, and the control that called has
 * one shape to draw and no branch that can drop a draft.
 *
 * The text handed back on a failing path is the caller's own rather than the
 * one the endpoint echoed. The endpoint promises to return it, and believing
 * that promise is still a round trip the words travelled on: the copy that
 * never left the browser is the one that cannot have been damaged on the way.
 */

import { faultFromResponse, faultMessage } from '../../utils/faults.js'

const ENDPOINT = '/api/onboarding-assist'

/**
 * What the assistant can be asked for, named the same here as on the endpoint
 * and on the Pi behind it, so nothing between the button and the model has to
 * translate anything.
 *
 * `start` is the one that may arrive with an empty box, because an empty box is
 * the moment the tool is worth the most. Every other action is a rewrite of
 * something, and a rewrite of nothing is a request nobody meant to make.
 */
export const ASSIST_ACTIONS = ['start', 'expand', 'tighten', 'plain']

/**
 * The longest answer the assistant takes, matching the endpoint's own cap and
 * the Pi's behind it.
 *
 * Held here as well so a person who wrote past it is told by the box in front
 * of them rather than by a request that travels the length of the country to
 * be refused.
 */
export const ASSIST_MAX_CHARS = 6000

/**
 * The sentences a person reads, which are the endpoint's own.
 *
 * Every answer from `api/onboarding-assist.js` carries the sentence it wants
 * shown, so these stand behind that rather than beside it: they are what a
 * person reads when the answer never arrived, arrived from a deployment older
 * than the sentence, or arrived in words nobody wrote for a reader. The
 * endpoint holds the same words and cannot be imported from here, being server
 * code, so the two are kept level by hand and each names the other.
 */
const OFFLINE = 'The writing help is not answering right now. Everything else here still works.'

/**
 * What somebody reads when the words come back exactly as they were sent.
 *
 * The assistant refuses by handing the text back untouched, which is the only
 * refusal that leaves a form field usable - a declining sentence would land in
 * the client's own answer and would have to be deleted by hand. So identical
 * text is the refusal, and this is what it is called in front of a person.
 */
const UNCHANGED =
  'That came back the way you wrote it. Try the starters underneath, or say it the way you ' +
  'would say it out loud.'

/** The same event with an empty box behind it, where the sentence above lies. */
const NOTHING_BACK = 'Nothing came back that time. Try one of the starters underneath.'

/** Three turns are already running on the machine that answers this. */
const BUSY = 'The writing help is busy. Give it a moment and press again.'

/** The two the control can refuse on its own, before anything is spent. */
const TOO_LONG = 'That is longer than the writing help takes. Trim it and try again.'
const NOTHING_TO_WORK_ON = 'Nothing to work on yet.'

/**
 * How long a no stands before it is worth asking again.
 *
 * A yes is kept until something contradicts it, because the only thing that
 * honestly reports a machine going away is a request that tried to reach it,
 * and a probe every minute to confirm what a working button already proves is a
 * request spent on nothing. A no expires, because the Pi coming back is the
 * event nobody is watching for: without this the buttons would stay away until
 * a reload, on a page a client sits on for twenty minutes.
 */
const DOUBT_MS = 60000

/**
 * What the last probe said, and when it said it.
 *
 * A step can hold four of these controls and each asks the same question on
 * mount, so the answer is remembered for all of them rather than fetched four
 * times. It is not keyed on the account, and it does not need to be: the answer
 * is about a machine in a house, and the only reader who could be handed
 * somebody else's answer is a second account signed in to the same tab inside a
 * minute, whose cost is a row of buttons drawn or not drawn for that minute.
 */
let answered = null
let answeredAt = 0

/** The probe in flight, so four controls mounting at once ask once. */
let asking = null

/** Whatever the last exchange proved about the machine. */
function remember(up) {
  answered = up
  answeredAt = Date.now()
}

/** One knock on the door, which never throws and never costs a turn. */
async function probe(token) {
  try {
    const response = await fetch(ENDPOINT, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) return false
    const payload = await response.json()
    return payload.up === true
  } catch {
    // A browser that cannot reach the endpoint cannot reach the assistant
    // through it either, so this is a no rather than an unknown.
    return false
  }
}

/**
 * Whether the assistant would answer a request sent now.
 *
 * The buttons are drawn on this and on nothing else. A control offering to
 * rewrite a paragraph is a promise, and a promise nothing is behind costs more
 * than the absence of one: the person presses it, waits, reads an apology, and
 * then has to be told that the openings and the checklist underneath were the
 * real help all along.
 *
 * @param {string|null} token
 * @returns {Promise<boolean>}
 */
export async function assistUp(token) {
  if (answered === true) return true
  if (answered === false && Date.now() - answeredAt < DOUBT_MS) return false
  if (!asking) {
    asking = probe(token).then(up => {
      remember(up)
      asking = null
      return up
    })
  }
  return asking
}

/** One answer, in the shape every path resolves to. */
function answer(text, { assisted = false, refused = false, offline = false, note = null } = {}) {
  return { text, assisted, refused, offline, note }
}

/**
 * Asks for one rewrite.
 *
 * `field` is the question's own label as the console draws it and `trade` is
 * the trade's name, both of which the assistant is told so it knows what it is
 * reading. Neither is an instruction on either side of the wire.
 *
 * @param {{token: string|null, action: string, field?: string, trade?: string,
 *   text?: string}} request
 * @returns {Promise<{text: string, assisted: boolean, refused: boolean,
 *   offline: boolean, note: string|null}>}
 */
export async function assist({ token, action, field, trade, text }) {
  const held = typeof text === 'string' ? text : ''

  // The three refusals this side can make for itself. Each is the same answer
  // the endpoint would give, and a round trip is not worth spending to be told
  // something the box in front of the person already knows.
  if (!ASSIST_ACTIONS.includes(action)) return answer(held, { note: OFFLINE })
  if (held.length > ASSIST_MAX_CHARS) return answer(held, { note: TOO_LONG })
  if (!held.trim() && action !== 'start') return answer(held, { note: NOTHING_TO_WORK_ON })

  let response = null
  let payload = {}
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action,
        field: String(field || '').slice(0, 120),
        trade: String(trade || '').slice(0, 120),
        text: held,
      }),
    })
    payload = await response.json().catch(() => ({}))
  } catch {
    remember(false)
    return answer(held, { offline: true, note: OFFLINE })
  }

  if (!response.ok) {
    // A refusal is the door answering, which is not the same as the door being
    // gone: a ceiling, an expired session and an account with no build are all
    // reasons a working assistant says no, and hiding the buttons over any of
    // them would tell somebody the machine is down when it is not.
    //
    // What the refusal says goes through the one door on every branch. The
    // endpoint writes for readers, but the things in front of it do not, and a
    // client answering a brief about their own business is the last person who
    // should be handed a gateway's words for it.
    //
    // The first two branches read the body without the status behind it. Each
    // already has a sentence about this tool in particular, and those say what
    // the general ones cannot: that the rest of the brief is unaffected, and
    // that the wait is the machine being busy rather than the person being
    // quick. The last branch does read the status, because a session that ran
    // out and an account with nothing to write about are both described better
    // by what the refusal was than by the help not answering.
    if (response.status >= 500) {
      remember(false)
      return answer(held, { offline: true, note: faultMessage(payload, OFFLINE) })
    }
    if (response.status === 429) return answer(held, { note: faultMessage(payload, BUSY) })
    return answer(held, { note: faultFromResponse(response, payload, OFFLINE) })
  }

  if (payload.offline) {
    remember(false)
    return answer(held, { offline: true, note: payload.note || OFFLINE })
  }

  remember(true)

  const written = typeof payload.text === 'string' ? payload.text.trim() : ''
  const same = !written || written === held.trim()
  if (payload.refused || same) {
    return answer(held, {
      refused: true,
      note: payload.note || (held.trim() ? UNCHANGED : NOTHING_BACK),
    })
  }

  return answer(written, { assisted: true, note: payload.note || null })
}
