/**
 * One client's brief, and the two things they can do to it.
 *
 * A brief belongs to the project it was answered for, and the project belongs
 * to the account that paid for it. There is one row per project and it is
 * opened by being read: a client who has never seen the questions has no row
 * until the first GET, which is why the read is a function call rather than a
 * select. Nothing here takes an account as an argument, because the only
 * account any of it works on is the caller's own verified one.
 *
 * POST carries one action:
 *
 *   { action: 'save',   project_id, answers, step, percent }
 *   { action: 'submit', project_id }
 *
 * `save` runs on a debounce as the client types, on every step change, and on
 * page hide, so it happens many times over one sitting and has to be both
 * cheap and total. It replaces the answers rather than merging them: the
 * browser holds the whole form, and a merge would let two tabs half-agree
 * about a question neither of them asked twice.
 *
 * `percent` is what the browser worked out, and it is not what gets stored.
 * The arithmetic runs in the browser because that is where the typing is, and
 * the function clamps whatever it is handed to 99 and raises the stored figure
 * rather than setting it - so a client cannot post themselves finished, and a
 * client who goes back and empties a required field does not lose the ground
 * they made. Only `submit` writes 100, and it re-checks the required answers
 * itself before it does.
 *
 * Nothing on the form asks for a login and nothing here would take one. The
 * brief asks where a web address is registered, which is a question with the
 * name of a company for an answer; the access that goes with it is arranged by
 * voice near the end of the build. A login sitting in a jsonb column beside
 * somebody's opening hours is a different kind of record from the rest of
 * this, and the two must not end up in the same row because a field was added
 * one afternoon.
 *
 * Every refusal is the database's. A project belonging to somebody else, a
 * save against a build that is not the caller's, a submit against a form still
 * missing a required answer - all of it comes back from the function that owns
 * the change. This endpoint decides who is asking and nothing else.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAccount, connect } from '../lib/db/clients.js'
import { field, uuid } from '../lib/db/fields.js'

/**
 * The largest the answers may be, measured on the JSON that would be stored.
 *
 * The brief is thirty-odd fields and the long ones are paragraphs somebody
 * types about their own trade, not documents they paste. Sixty thousand
 * characters is every written answer at the length the writing help refuses to
 * go past, several times over, with the towns, the hours, the pages and the
 * price list on top - so nothing a person can fill in reaches it.
 *
 * What it stops is the other thing. `answers` is a jsonb column written
 * straight through from a browser and read back on every step change, so
 * without a ceiling one request puts a megabyte in the row and the form gets
 * slower for the client who did it every time they answer another question.
 * A cap is refused rather than cut, because a save that silently dropped half
 * of somebody's answers would be worse than one that did not happen.
 */
const ANSWERS_LIMIT = 60000

/** The longest a step name is. They are keys from the flow, not prose. */
const STEP_LIMIT = 40

/**
 * The answers, if what arrived is a set of them.
 *
 * An array and a string both survive a jsonb column and neither is a form, so
 * they are refused here rather than stored and puzzled over later.
 */
function answersIn(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value
}

/**
 * How much of the cap a set of answers spends.
 *
 * Measured on the serialized form because that is the thing the column holds;
 * counting keys or fields would let one field carry the whole payload.
 */
function weight(answers) {
  try {
    return JSON.stringify(answers).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

/**
 * The figure the browser worked out, as something a smallint takes.
 *
 * Anything that is not a number at all counts as nothing, which costs the
 * client nothing: the function raises the stored figure rather than setting
 * it, so a save that arrives without one leaves the bar where it was.
 */
function percent(value) {
  const figure = Number(value)
  if (!Number.isFinite(figure)) return 0
  return Math.min(100, Math.max(0, Math.round(figure)))
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const wired = connect()
  if (!wired) return response.status(503).json({ error: 'Your brief is not available right now.' })

  const account = await authorizeAccount(
    wired,
    request.headers.authorization,
    'You have been signed out. Sign in again and the brief is where you left it.'
  )
  if (account.error) return response.status(account.status).json({ error: account.error })

  if (request.method === 'GET') {
    const project = uuid(request.query?.project)
    if (!project) return response.status(400).json({ error: 'Which project?' })

    // The read is what creates the row, so the first client to open the
    // questions and the hundredth take the same path and there is no separate
    // moment where a brief has to be brought into existence.
    const { data, error } = await wired.db.rpc('project_onboarding_open', {
      p_actor: account.userId,
      p_project: project,
    })
    if (error) return response.status(500).json({ error: error.message })
    if (data?.error) return response.status(400).json({ error: data.error })

    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json({ brief: data })
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const body = request.body || {}

  // The writes answer the same way, so they are read off one table rather than
  // written out as two near-identical blocks: the difference between them is
  // the function and its arguments, and nothing else.
  const writes = {
    save: () => {
      const project = uuid(body.project_id)
      if (!project) return { fault: 'Which project?' }
      const answers = answersIn(body.answers)
      if (!answers) return { fault: 'Nothing to save.' }
      if (weight(answers) > ANSWERS_LIMIT) {
        return {
          fault:
            'That is more than the brief holds. Shorten the longest answers and it saves again.',
        }
      }
      return {
        name: 'project_onboarding_save',
        args: {
          p_actor: account.userId,
          p_project: project,
          p_answers: answers,
          // Where the client had got to, which is a fact about them rather
          // than about their answers, and is why it is a column.
          p_step: field(body.step, STEP_LIMIT),
          p_progress: percent(body.percent),
        },
      }
    },
    submit: () => {
      const project = uuid(body.project_id)
      if (!project) return { fault: 'Which project?' }
      return {
        name: 'project_onboarding_submit',
        args: { p_actor: account.userId, p_project: project },
      }
    },
  }

  const chosen = writes[body.action]
  if (!chosen) return response.status(400).json({ error: 'Unknown action.' })

  const call = chosen()
  if (call.fault) return response.status(400).json({ error: call.fault })

  const { data, error } = await wired.db.rpc(call.name, call.args)
  if (error) return response.status(500).json({ error: error.message })
  if (data?.error) return response.status(400).json({ error: data.error })

  // The stored row rather than an acknowledgement, because what the browser
  // sent and what the row now holds are not the same thing: the figure is
  // clamped and raised on the way in, and submitting stamps a time. A console
  // that drew its own arithmetic back would be drawing something nobody else
  // can see.
  response.setHeader('Cache-Control', 'no-store')
  return response.status(200).json({ brief: data })
}
