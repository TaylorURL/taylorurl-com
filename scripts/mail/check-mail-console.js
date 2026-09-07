/**
 * Proves the mail console cannot write to the things it is looking at, and
 * cannot send anywhere but to the account reading it.
 *
 * Three separate faults are possible here and only one of them is visible on
 * the screen. A preview that keeps its open counter turns every scroll past a
 * cold message into a record of the business reading it, which is the figure
 * the send engine is steered by. A preview that keeps its unsubscribe link is
 * one stray click from taking a business off a list it never asked to leave.
 * And an endpoint that reads a recipient out of the request is a way to send
 * the studio's own mail to an address a browser named.
 *
 * The first two are checked by rendering every message the site sends and
 * looking for what should no longer be in it. The third is checked by reading
 * the endpoint, because the fault is the presence of a line rather than the
 * behaviour of one, and a test that posted a recipient to find out would be
 * the same test with a real send behind it.
 *
 * The last case is the tab existing at all. A section is registered in five
 * places and four of them fail silently: the menu shows a row that routes
 * nowhere, or the route answers and the menu never offers it, or a direct load
 * of the URL is a 404 because nothing prerendered the shell.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ANNOTATION, TRADING_LINE, WORDMARK } from '../../lib/mail/identity.js'
import { BIO_NAME } from '../../lib/mail/bio.js'
import { FAMILIES, renderFamily } from '../../lib/mail/catalogue.js'
import { inertHtml, inertText } from '../../lib/mail/preview.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = path => readFileSync(join(HERE, '../..', path), 'utf8')

const cases = []
function check(name, run) {
  cases.push([name, run])
}

function same(got, want, what) {
  if (got !== want)
    throw new Error(`${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
}

function report(faults) {
  if (faults.length) throw new Error(faults.join('\n      '))
}

// -- what a preview may no longer carry ---------------------------------------

// The counter an outreach capture is served behind, and the two ways off a
// list. A message holding any of them is a message that writes when it is read.
const WRITES = [
  '/api/outreach/open',
  '/api/outreach/unsubscribe',
  '/api/lead-unsubscribe',
  '/unsubscribe?token=',
]

// Rendered with the token a real send carries, so the counter and the campaign
// tag are actually present to be taken out. A sample drawn without one proves
// only that a message with nothing in it has nothing in it.
const TRACK = '00000000-0000-4000-8000-000000000000'

const drawn = FAMILIES.filter(family => family.previewable !== false).map(family => ({
  family,
  message: renderFamily(family.slug, { track: TRACK }),
}))

check('every family the catalogue names actually draws', () => {
  const faults = []
  for (const { family, message } of drawn) {
    if (!message) faults.push(`${family.slug}: the catalogue names it and nothing draws it`)
    else if (!message.html?.length) faults.push(`${family.slug}: drew an empty message`)
    else if (!message.subject?.length) faults.push(`${family.slug}: drew no subject`)
  }
  report(faults)
})

check('a message drawn for the console records nothing when it is read', () => {
  const faults = []
  for (const { family, message } of drawn) {
    if (!message) continue
    const html = inertHtml(message.html, { capture: 'https://example.test/capture.png' })
    const text = inertText(message.text)
    for (const path of WRITES) {
      if (html.includes(path))
        faults.push(`${family.slug}: the laid-out half still carries ${path}`)
      if (text.includes(path)) faults.push(`${family.slug}: the plain half still carries ${path}`)
    }
    if (/utm_/.test(html)) faults.push(`${family.slug}: the laid-out half still carries a campaign`)
    if (/utm_/.test(text)) faults.push(`${family.slug}: the plain half still carries a campaign`)
  }
  report(faults)
})

check('the stand-in a message is previewed with is still drawn', () => {
  // Taking the counter out must not leave a hole where the frame was. The
  // stand-in goes in its place, and a preview that drops the frame entirely is
  // a preview of a message with one fewer image than the one that sends.
  const speed = drawn.find(one => one.family.slug === 'outreach-plain-speed')
  const html = inertHtml(speed.message.html, { capture: 'https://example.test/capture.png' })
  same(html.includes('https://example.test/capture.png'), true, 'the stand-in')
})

check('a message previewed with no stand-in draws a blank rather than reaching the counter', () => {
  const listing = drawn.find(one => one.family.slug === 'outreach-plain-listing')
  const html = inertHtml(listing.message.html)
  same(html.includes('/api/outreach/open'), false, 'the counter')
  same(html.includes('data:image/gif;base64'), true, 'the blank')
})

check('disarming a message does not change what it says', () => {
  // A preview that reads differently from the message it stands for is not a
  // preview of it. Only addresses move; every word stays.
  const faults = []
  for (const { family, message } of drawn) {
    if (!message) continue
    const before = message.html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const after = inertHtml(message.html)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (before !== after) faults.push(`${family.slug}: the wording changed when it was disarmed`)
  }
  report(faults)
})

check('one issue draws as two letters, and each carries only its own side', () => {
  // A block marked for one side of the list is written to somebody who has a
  // site the studio runs, or to somebody who does not. Drawing one copy for
  // both shows half the list a message about a thing they do not have.
  const client = renderFamily('newsletter-client', { track: TRACK })
  const prospect = renderFamily('newsletter-prospect', { track: TRACK })
  same(client.html === prospect.html, false, 'the two copies')

  const faults = []
  const only = (copy, side) =>
    copy.text.includes('the console shows what it is bringing in') === (side === 'client')
  if (!only(client, 'client')) faults.push('the client copy does not carry the client block')
  if (!only(prospect, 'prospect')) faults.push('the prospect copy carries the client block')
  if (client.text.includes('Run the reading')) {
    faults.push('the client copy carries the prospect block')
  }
  if (!prospect.text.includes('Run the reading')) {
    faults.push('the prospect copy does not carry the prospect block')
  }
  report(faults)
})

check('a newsletter send is drawn for the reader who had it', () => {
  // The endpoint reads the side off the recipient's own row. A stand-in
  // subscriber shows the client copy to everybody, and most of the list is on
  // the other side.
  const draw = ENDPOINT.slice(
    ENDPOINT.indexOf('async function newsletterMessage'),
    ENDPOINT.indexOf('/** A family that keeps no record')
  )
  same(/subscribers\(email, source, unsub_token\)/.test(draw), true, 'the reader is read whole')
  same(/subscriber: reader \?\?/.test(draw), true, 'the reader decides the copy')
})

check('a cold message, an issue and a notice open on the same studio', () => {
  // Families arriving under separate identities are separate studios as far as
  // the reader is concerned, and the studio's own notices are read in the same
  // inbox as everything else it sends. The mark and the lines beside it come
  // from one place, and this is what says every laid-out family still draws
  // them.
  const faults = []
  for (const slug of [
    'newsletter-client',
    'newsletter-prospect',
    'speed-check-notice',
    'purchase-notice',
    'outreach-reply-notice',
  ]) {
    const html = renderFamily(slug, { track: TRACK }).html
    if (!html.includes(WORDMARK.src)) faults.push(`${slug} does not carry the wordmark`)
    for (const line of ANNOTATION) {
      if (!html.includes(line)) faults.push(`${slug} does not carry "${line}"`)
    }
  }
  report(faults)
})

check('a cold letter says who is writing and where they trade', () => {
  // A plain letter has no slab to set the mark on, so it says the same thing
  // the way a typed note says it: a name at the bottom and the registered name
  // and town under that. A commercial message carrying neither is one both the
  // law and the filters read as something other than a person writing.
  // The cold letters are the ones sent from the outreach mailbox. The notices
  // that system also sends go to the studio's own inbox and are not a message
  // to a stranger, so the question is not asked of them.
  const COLD = 'The address held in outreach settings'
  const faults = []
  for (const { family, message } of drawn) {
    if (family.from !== COLD || !message) continue
    for (const [half, part] of [
      ['laid-out half', message.html],
      ['plain half', message.text],
    ]) {
      if (!part.includes(BIO_NAME)) faults.push(`${family.slug}: the ${half} is not signed`)
      if (!part.includes(TRADING_LINE)) {
        faults.push(`${family.slug}: the ${half} names no registered studio`)
      }
    }
  }
  report(faults)
})

// -- where a copy is allowed to go --------------------------------------------

const ENDPOINT = read('api/mail-admin.js')
// The session and role check the endpoint stands behind. It is shared with
// every other admin endpoint, so the two questions are asked once and this
// reads them where they are asked rather than where they are relied on.
const DOOR = read('lib/db/clients.js')

check('a copy goes to the session, never to an address in the request', () => {
  const faults = []
  // The only call that hands an address to the provider.
  const call = ENDPOINT.match(/await deliver\(([^,]+),/)
  if (!call) faults.push('nothing in the endpoint delivers a copy any more')
  else if (call[1].trim() !== 'account.email') {
    faults.push(`a copy is addressed to ${call[1].trim()} rather than to the account`)
  }
  // `to` is built inside deliver from that one argument. A recipient reaching
  // it from the body would have to arrive through here.
  if (/to:\s*\[?\s*(body|request)\./.test(ENDPOINT)) {
    faults.push('a recipient is read out of the request')
  }
  report(faults)
})

check('the endpoint refuses anyone who is not an admin', () => {
  same(/await authorizeAdmin\(/.test(ENDPOINT), true, 'the endpoint stands behind the door')
  same(DOOR.includes("!== 'admin'"), true, 'the role check')
  same(DOOR.includes('verifier.auth.getUser'), true, 'the session check')
})

check('every body leaving the endpoint has been through the disarming', () => {
  const faults = []
  // The three functions that turn a row into a message. Everything downstream
  // of them, the send included, is handed what they returned, so this is the
  // one place a body can still be armed.
  const builders = ENDPOINT.slice(
    ENDPOINT.indexOf('async function outreachMessage'),
    ENDPOINT.indexOf('/** Whatever the id names, whole. */')
  )
  for (const half of ['html:', 'text:']) {
    const lines = builders.split('\n').filter(line => line.trim().startsWith(half))
    if (!lines.length) faults.push(`nothing in the endpoint returns a ${half.slice(0, -1)} half`)
    for (const line of lines) {
      if (!/inert(Html|Text)\(/.test(line)) faults.push(`a half leaves undisarmed: ${line.trim()}`)
    }
  }
  report(faults)
})

// -- the tab existing in every place a tab has to exist ------------------------

check('the mail section is registered everywhere a section is registered', () => {
  const faults = []
  const places = [
    ['src/app/views/console/lib/sections.js', "id: 'mail'"],
    ['src/app/constants/routes.js', "key: 'ConsoleMail', path: 'mail'"],
    ['src/app/views.js', 'ConsoleMail:'],
    ['vite/site-routes.js', "'/console/mail'"],
  ]
  for (const [path, needle] of places) {
    if (!read(path).includes(needle)) faults.push(`${path} does not carry the mail section`)
  }
  report(faults)
})

check('the section is admin-only and asks for no site in scope', () => {
  const sections = read('src/app/views/console/lib/sections.js')
  const entry = sections.slice(sections.indexOf("id: 'mail'"))
  const body = entry.slice(0, entry.indexOf('},'))
  same(/admin: true/.test(body), true, 'admin only')
  same(/scope: false/.test(body), true, 'no site in scope')
})

let failed = 0
for (const [name, run] of cases) {
  try {
    run()
    console.log(`  ok  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`  no  ${name}\n      ${error.message}`)
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passed`)
if (failed) process.exit(1)
