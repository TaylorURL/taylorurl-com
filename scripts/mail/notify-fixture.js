/**
 * How the notify checks put a request to the endpoint and read what it said,
 * and what the two of them post and seed.
 *
 * The endpoint answers into a response the way Vercel hands it one, and a case
 * reads back the status, the body and the headers. Header names are kept
 * lowercased, so a case asks for `cache-control` however the endpoint spelled
 * it.
 *
 * Several of the requests are refusals the endpoint is right to log, and a
 * passing run should read as a passing run, so its logging is held back for the
 * length of the call.
 *
 * The endpoint is handed in rather than imported here. It reads its environment
 * once, at load, and each check sets that environment before importing it.
 *
 * One check drives the endpoint through the client it holds and the other
 * through the HTTP that client speaks, so each has a database stand-in of its
 * own. What both stand-ins have to agree with the real tables on - how a
 * project's secret is held, and how a column that ignores case compares - is
 * written here once, beside the notification both of them post.
 */
import { createHash } from 'node:crypto'
import { quietly } from '../harness/checks.js'

/** One notification, as a project posts it. */
export const SETUP = {
  subject: 'A+ short setup on US30',
  severity: 'urgent',
  lines: [
    ['Instrument', 'US30'],
    ['Side', 'SELL'],
  ],
  body: 'Bearish order block swept the high and closed back inside.',
  link: { url: 'https://www.example.com/app/signals' },
  idempotency_key: 'signal:9f3c1d20-4a77-4a1e-9a8e-6d2b0c5f1e33',
}

/** A project's secret as the table holds it. */
export const digestOf = value => createHash('sha256').update(value).digest('hex')

/** How a value compares in a column that does not care about case. */
export const sameIgnoringCase = (held, value) =>
  typeof held === 'string' && typeof value === 'string'
    ? held.toLowerCase() === value.toLowerCase()
    : held === value

/** The status, body and headers `handler` answered `request` with. */
export async function answerTo(handler, request) {
  const answer = { status: 0, body: null, headers: {} }
  const response = {
    setHeader(name, value) {
      answer.headers[String(name).toLowerCase()] = value
    },
    status(code) {
      answer.status = code
      return response
    },
    json(payload) {
      answer.body = payload
      return response
    },
  }
  await quietly(() => handler(request, response))
  return answer
}
