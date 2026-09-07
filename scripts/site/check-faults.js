#!/usr/bin/env node
/**
 * That no machine ever gets to speak to a reader in its own words.
 *
 *   npm run check:faults
 *
 * A failure on this site is written by whoever it happened to: Supabase, or
 * Postgres, or a fetch that never landed, or an upstream service handing back
 * its own JSON. Every one of those is addressed to a programmer, and the
 * person who meets it is not one — the presence check used to put a 500 and
 * half a Lighthouse error body under the address field of a page written for a
 * tradesman, which tells them nothing except that they broke something.
 *
 * `src/app/utils/faults.js` is the one door between the two, and this holds it
 * shut from both sides.
 *
 * The first half is the door itself: real machine text in, a written sentence
 * out, every time, including for causes the table has never seen. The cases
 * below are the actual strings these services send, not invented ones.
 *
 * The second half is the part that rots. A door only works while everything
 * goes through it, and the cheap thing to write at a call site — `toast(
 * error.message)` — is exactly the thing that bypasses it, reads fine in
 * review, and is wrong only on the day it fires. So the views and components
 * are swept for a caught value being handed straight to a surface a reader
 * looks at. There is no allowlist: a message worth showing is worth naming as
 * a fallback, which is an argument to `faultMessage` and passes.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FALLBACK_FAULT, faultMessage, readsAsWritten } from '../../src/app/utils/faults.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const FAULTS = path.join(ROOT, 'src/app/utils/faults.js')

const failures = []
let checks = 0

function check(what, ok) {
  checks += 1
  if (!ok) failures.push(what)
}

/* ----------------------------------------------------------------------- *
 * The door: what a service says, and what a reader is told instead.
 * ----------------------------------------------------------------------- */

// Every one of these is a real message, copied from the service that sends it.
const MACHINE_SAID = [
  'The measurement service answered 500. { "error": { "code": 500, "message": "Lighthouse returned error: Something went wrong.", "errors": [',
  'TypeError: Failed to fetch',
  'AuthApiError: Invalid login credentials',
  'duplicate key value violates unique constraint "leads_email_key"',
  'new row violates row-level security policy for table "projects"',
  'PGRST116: JSON object requested, multiple (or no) rows returned',
  'FetchError: request to https://api.stripe.com/v1/checkout/sessions failed, reason: ECONNREFUSED',
  'Error: connect ETIMEDOUT 10.0.0.1:443',
  '500 Internal Server Error',
  '{"error":"invalid_grant","error_description":"Token has expired"}',
  "undefined is not an object (evaluating 'a.b.c')",
  'at Object.<anonymous> (/var/task/api/checkout.js:42:11)',
  'ERR_CONNECTION_REFUSED',
  'over_email_send_rate_limit',
  // Every one below reached a reader through the first version of this gate,
  // and each got past it a different way. They are kept because a rule removed
  // by somebody tidying is a rule nobody misses until it is on screen again.
  // `Auth session missing!` is the sharpest of them: twenty characters, a
  // capital, a terminal stop and no machine word in it, so only the ban on
  // exclamation marks stands between it and the account settings screen.
  'Auth session missing!',
  'A DOMException: The operation is insecure.',
  'The canvas has been tainted by cross-origin data.',
  'Account deletion is not configured on this deployment.',
  'The admin endpoint answered 500.',
  'Your project could not be read (503).',
]

for (const said of MACHINE_SAID) {
  const shown = faultMessage(said)
  check(`a reader never sees: ${said.slice(0, 48)}`, shown !== said)
  check(`what replaces it reads as written: ${said.slice(0, 32)}`, readsAsWritten(shown))
}

// An Error carries its text on `.message`, a Supabase failure on `.message`
// beside a `.code`, a parsed body on `.error`. All three go in the same door.
check('a thrown Error is read', faultMessage(new TypeError('Failed to fetch')).includes('online'))
check(
  'a Supabase error object is read',
  faultMessage({
    message: 'Invalid login credentials',
    code: 'invalid_credentials',
    status: 400,
  }) === faultMessage('Invalid login credentials')
)
check('a parsed body is read', readsAsWritten(faultMessage({ error: 'PGRST301' })))
check('nothing at all still answers', faultMessage(null) === FALLBACK_FAULT)
check(
  'nothing at all with a fallback takes it',
  faultMessage(undefined, 'The build did not save.') === 'The build did not save.'
)

/* ----------------------------------------------------------------------- *
 * The causes a person actually meets get the sentence written for them,
 * rather than the general one.
 * ----------------------------------------------------------------------- */

const NAMED = [
  ['Invalid login credentials', /do not match an account/],
  ['Email not confirmed', /still needs confirming/],
  ['A user with this email address has already been registered', /already an account/],
  ['Password should be at least 6 characters.', /too short/],
  ['New password should be different from the old password.', /already on the account/],
  ['Email link is invalid or has expired', /expired/],
  ['For security purposes, you can only request this after 47 seconds.', /Wait a moment/],
  ['Email rate limit exceeded', /few minutes/],
  ['Failed to fetch', /online/],
  ['The operation was aborted due to timeout', /took too long/],
  ['duplicate key value violates unique constraint', /already on the list/],
]

for (const [said, wanted] of NAMED) {
  const shown = faultMessage(said)
  check(`"${said.slice(0, 40)}" gets its own sentence`, wanted.test(shown))
  check(`and that sentence is not the general one: ${said.slice(0, 28)}`, shown !== FALLBACK_FAULT)
}

/* ----------------------------------------------------------------------- *
 * A status with nothing readable beside it still says something true.
 * ----------------------------------------------------------------------- */

for (const status of [400, 401, 403, 404, 409, 413, 429, 500, 502, 503, 504]) {
  const shown = faultMessage(status)
  check(`${status} has a sentence`, readsAsWritten(shown) && shown !== FALLBACK_FAULT)
  check(`${status} never shows its own number`, !shown.includes(String(status)))
}

/*
 * Two ways of saying the same refusal have to come out as one sentence.
 *
 * A sign-in door that distinguishes "no account on that address" from "wrong
 * password" answers, to anybody with a script, the question of which addresses
 * hold accounts. Supabase declines to make that distinction and this must not
 * reintroduce it by giving the two causes different sentences — which is a
 * thing a table of friendly messages makes very easy to do by accident.
 */
check(
  'a missing account and a wrong password are indistinguishable',
  faultMessage('User not found') === faultMessage('Invalid login credentials')
)

// A status on the object beats an unreadable message beside it, because the
// status is at least true about what happened.
check(
  'a status outranks machine text',
  faultMessage({ message: '{"code":429}', status: 429 }) === faultMessage(429)
)

/* ----------------------------------------------------------------------- *
 * A sentence a person wrote is better than one chosen from a table, so it is
 * let through — and only it.
 * ----------------------------------------------------------------------- */

const WRITTEN = [
  'Google could not load that address. Check it opens in a browser.',
  'That address could not be read. Check the spelling and run it again.',
  'Google is rate limiting the measurement. Try again in a few minutes.',
]
for (const said of WRITTEN)
  check(`a written sentence is kept: ${said.slice(0, 32)}`, faultMessage(said) === said)

/*
 * The other direction, which is the one that goes wrong quietly.
 *
 * The gate is deliberately eager, and an eager gate eats good sentences. These
 * are the endpoint's own words with somebody's real trading name in them, and
 * an earlier rule read HVAC as an error code and replaced the whole sentence
 * with a general one naming no business and no stage. A false positive here
 * costs a reader the only sentence that could have told them what happened, so
 * the names below are held as firmly as the machine text above.
 */
const TRADING_NAMES = [
  'Smith HVAC is already on file at the found stage.',
  'ACME Plumbing is already on file at the found stage.',
  '1st Choice Roofing is already on file at the found stage.',
  'Bright & Co is already on file at the found stage.',
]
for (const said of TRADING_NAMES) {
  check(`a business keeps its name: ${said.slice(0, 30)}`, faultMessage(said) === said)
}

const FRAGMENTS = ['Bad Request', 'error', 'FAILED', 'not ok', 'Unauthorized']
for (const said of FRAGMENTS) {
  check(`a fragment is not mistaken for a sentence: ${said}`, !readsAsWritten(said))
}

/* ----------------------------------------------------------------------- *
 * Every sentence this module can hand back has to survive its own test. A
 * message written here and never read back is how one of them ends up a
 * fragment, or ends up naming a service the reader has never heard of.
 * ----------------------------------------------------------------------- */

const source = readFileSync(FAULTS, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')
const written = [...source.matchAll(/'((?:[^'\\]|\\.)*)'/g)]
  .map(found => found[1].replaceAll("\\'", "'"))
  .filter(said => said.includes(' ') && /[.!?]$/.test(said))

check('the module holds sentences to read back', written.length >= 20)
check(
  'nothing this module says carries an exclamation mark',
  written.every(said => !said.includes('!'))
)
for (const said of written) {
  check(`this module's own words read as written: ${said.slice(0, 40)}`, readsAsWritten(said))
}

/* ----------------------------------------------------------------------- *
 * A notice nobody can see is the same as no notice.
 *
 * The writes that fail are raised from inside the things at --z-modal: the
 * console's side panels, its shortcut sheet, the search. Each of those draws a
 * scrim across the whole viewport, so a toast layered under them is painted
 * behind it and the reader is told nothing — silent in the one case where they
 * are certainly watching for an answer. The ordering is the only thing holding
 * that open, and it is four characters in a token block.
 * ----------------------------------------------------------------------- */

const tokens = readFileSync(path.join(ROOT, 'src/index.css'), 'utf8')
const layer = name => {
  const found = tokens.match(new RegExp(String.raw`--z-${name}:\s*(\d+)`))
  return found ? Number(found[1]) : NaN
}

const toast = layer('toast')
const modal = layer('modal')
const skip = layer('skip')

check(
  'the layer scale still names a toast, a modal and a skip link',
  [toast, modal, skip].every(Number.isFinite)
)
check(`the toast layer (${toast}) is above the modal layer (${modal})`, toast > modal)
check(`the skip link (${skip}) stays above the toast (${toast})`, skip > toast)

/* ----------------------------------------------------------------------- *
 * The sweep: nothing goes round the door.
 * ----------------------------------------------------------------------- */

// The calls a reader is on the other side of. A caught value reaching any of
// these unread is the whole fault this file exists to prevent.
const SINKS = [
  'toast',
  'setError',
  'setFault',
  'setErr',
  'addToast',
  'setNotice',
  'setFailed',
  'setStatus',
]

// The text a service puts its complaint in, under any of the names it uses.
const SAID = String.raw`[A-Za-z_$][\w$]*\??\.(?:message|error|error_description|statusText)\b`

/**
 * A caught value on its way to a reader, in the two shapes it actually takes.
 *
 * The first is the obvious one: `toast(cause.message)`, the value handed
 * straight to the surface. The second is the one that got past the first
 * version of this sweep and is far commoner in the console — the value put on
 * a property of an object the surface then reads, `setFailed({ key: source,
 * value: payload.error || NOT_SAVED })`, usually wrapped across three lines so
 * the sink and the value are not even on the same one. Both are the same
 * mistake and neither is visible in review.
 *
 * `console.error` is not a surface. Sending the real detail there is exactly
 * what a fixed call site should do, so a line that logs is left alone.
 */
const TO_SINK = new RegExp(
  String.raw`\b(?:${SINKS.join('|')})\(\s*(?!faultMessage|faultFromResponse)${SAID}`
)
const TO_PROPERTY = new RegExp(
  String.raw`\b(?:value|message|error|fault|detail|text)\s*:\s*(?!faultMessage|faultFromResponse)${SAID}`
)
const READ = /faultMessage|faultFromResponse/
const LOGGED = /console\.(?:error|warn|log|debug|info)\s*\(/

/**
 * The other way a machine sentence gets out, and the subtler one: a normalizer
 * that gates on LENGTH rather than on content. `error.message.length < 200`
 * reads like a guard and is not one — every string this file exists to stop is
 * comfortably under two hundred characters, so a Lighthouse body, a Postgres
 * constraint and a stack frame all pass it. Three separate copies of this idiom
 * were written across the app, each believing itself safe.
 */
const LENGTH_GATE = /\.(?:message|error)\??\.?length\s*(?:&&|<|<=)/

function filesUnder(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) filesUnder(full, out)
    else if (/\.jsx?$/.test(entry)) out.push(full)
  }
  return out
}

const swept = filesUnder(path.join(ROOT, 'src/app'))
const leaks = []
for (const file of swept) {
  const shown = path.relative(ROOT, file)
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, index) => {
    if (READ.test(line) || LOGGED.test(line)) return
    const why = TO_SINK.test(line)
      ? 'handed to a surface'
      : TO_PROPERTY.test(line)
        ? 'put on a property a surface reads'
        : LENGTH_GATE.test(line)
          ? 'gated on length, which is not a check on content'
          : null
    if (why) leaks.push(`${shown}:${index + 1}  ${why}\n      ${line.trim()}`)
  })
}

checks += 1
if (leaks.length) {
  failures.push(`${leaks.length} caught values reach a reader unread`)
  for (const leak of leaks) failures.push(`  ${leak}`)
}

check('the sweep read the whole app', swept.length > 200)

if (failures.length) {
  console.error('check-faults: failed')
  for (const failure of failures) console.error(`  ${failure}`)
  console.error(
    '  every failure a reader sees goes through faultMessage in src/app/utils/faults.js'
  )
  process.exit(1)
}

console.log(
  `check-faults: ${checks} checks hold — ${MACHINE_SAID.length} real machine messages are all ` +
    `replaced, ${NAMED.length} named causes keep their own sentence, ${written.length} sentences ` +
    `in the module read as written, and ${swept.length} files carry no unread failure`
)
