import { SITE } from '../site/current.js'

/**
 * The questions every endpoint asks before it does anything.
 *
 * They are here rather than beside each handler because the answers are the
 * shape of the API rather than the business of any one endpoint: a caller
 * meeting a different refusal at one door than at the next has to learn each
 * door separately, and a door that forgets to ask is not visibly different from
 * one that asked and was satisfied.
 *
 * Each writes its own refusal and reports whether the request may go on, so a
 * handler reads as a list of gates rather than as nested conditions.
 *
 * A refusal is written as a sentence, because most of these doors are shut on a
 * browser rather than on a script: the console fetches through them and puts
 * whatever is in `error` in front of whoever pressed the button. `not
 * authorized` reads to that person as though they did something wrong, and
 * gives them nothing to do about it. The machine's half of the answer is
 * already in the status line and, for a 405, in `Allow`, which is where a
 * script reads it anyway.
 */

/**
 * The caller's `Authorization` header, or null once the refusal is written.
 *
 * The header is only checked for its scheme here. Whether the token behind it
 * means anything is a question for whoever can verify it.
 *
 * @param {object} request
 * @param {object} response
 * @returns {string|null}
 */
export function bearerOr401(request, response) {
  const authorization = request.headers.authorization || ''
  if (authorization.startsWith('Bearer ')) return authorization
  // Nothing arrived rather than something that failed to verify, but the two
  // are the same thing to read: the session this page is holding is not one the
  // API will take, and signing in again is what fixes either.
  response.status(401).json({ error: 'You are not signed in. Sign in and try that again.' })
  return null
}

/**
 * Whether the request's method is one of `allowed`, refusing it if not.
 *
 * A 405 carries `Allow`, which is what tells a caller which method to use
 * instead rather than leaving it to guess. That is the whole of what a script
 * needs, so the body does not repeat it: a reader who somehow meets a 405 met a
 * bug on the page they are on, and the methods this door takes would tell them
 * nothing about it.
 *
 * @param {object} request
 * @param {object} response
 * @param {string[]} allowed Methods, in the order the header should list them.
 * @returns {boolean}
 */
export function methodsOr405(request, response, allowed) {
  if (allowed.includes(request.method)) return true
  response.setHeader('Allow', allowed.join(', '))
  response
    .status(405)
    .json({ error: 'That request could not be handled here. Reload the page and try again.' })
  return false
}

/**
 * Whether this deployment serves this endpoint at all, refusing it if not.
 *
 * One tree builds two sites and `vercel.json` carries no `functions` block, so
 * every Vercel project deploys the whole `api/` tree whatever its route table
 * says. Without this, the subsidiary answers on all 36 endpoints: it would run
 * checkout and the Stripe webhook, send newsletters, drive the outreach
 * pipeline, spend the Google PageSpeed quota, and stand up a second copy of the
 * relay that client deployments post through - all on the same credentials, with
 * its own separate rate limiters, so every ceiling in the system is quietly
 * doubled.
 *
 * A 404 rather than a 403. The endpoint is not forbidden here, it does not exist
 * here, and saying so is both true and the answer that tells a scanner nothing
 * about what the other deployment runs. The sentence keeps that property: it
 * says this site does not do that, and not that somewhere else does.
 *
 * The endpoint is read from the request path rather than passed in, so a handler
 * cannot name itself something the router does not agree with.
 *
 * @param {object} request
 * @param {object} response
 * @returns {boolean} Whether the request may go on.
 */
export function servedHereOr404(request, response) {
  const allowed = SITE.apiAllowlist
  // null means every endpoint, which is the studio and every repo that has only
  // ever had one site. An empty array would mean none, and is not the same thing.
  if (allowed === null) return true

  const path = (request.url || '').split('?')[0]
  // vercel.json sets trailingSlash false, so a trailing slash should never
  // arrive. Stripped anyway: a gate that fails open on a URL shape nobody
  // predicted is the wrong way round, and this costs nothing.
  const endpoint = path
    .replace(/^\/+/, '')
    .replace(/^api\//, '')
    .replace(/\.js$/, '')
    .replace(/\/+$/, '')

  if (allowed.includes(endpoint)) return true
  response.status(404).json({ error: 'That is not available on this site.' })
  return false
}
