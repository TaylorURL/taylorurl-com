/**
 * Proves the Server section is wired, shut to everybody but an admin, and
 * still speaking the same language as the machine it reads.
 *
 * Four faults, and the last is the one particular to this section.
 *
 * The first is the one every console section has: it is registered in four
 * files and three of them fail quietly. The menu offers a row that routes
 * nowhere, or the route answers and the menu never shows it, or a direct load
 * is a 404 because nothing prerendered the shell.
 *
 * The second is the door on the feed. It names the units running on the
 * studio's own machine, how full its card is and what it is, which is nobody's
 * business but the studio's - and unlike every other admin endpoint on this
 * site the far end knows nothing about accounts, so nothing behind this proxy
 * will refuse a request it lets through. The role check there is the whole of
 * that door, and a session check standing in for it would open the feed to
 * every client with a login.
 *
 * The third is the door on the section, which is a different door and was
 * missing for as long as the section existed. Marking it admin-only took the
 * row out of the menu and left the address open, so a client who typed it got
 * the machine drawn around them - named, tiled and tabled - over a feed
 * refusing every read. A refused figure is not a refused page.
 *
 * The fourth is that the reading is built in another repository. The server
 * decides what states a routine can be in and this page decides what each one
 * looks like, and the two drift with nothing to say so: a state the page has
 * no entry for is drawn as whatever its fallback happens to be, so a stopped
 * routine could quietly render as a warning. So the vocabulary is asserted
 * here, in the words the feed actually sends, and a page that stops covering
 * one of them fails rather than guessing.
 *
 *   npm run check:server-console
 */

import { cases, check, finish, report, same } from '../harness/checks.js'
import { read } from '../harness/files.js'

const ENDPOINT = 'api/server-feed.js'
const PAGE = 'src/app/views/console/pages/health/ServerPage.jsx'
const HOOK = 'src/app/hooks/console/useServerFeed.js'
const SECTIONS = 'src/app/views/console/lib/sections.js'
const FRAME = 'src/app/views/console/ConsoleFrame.jsx'

/**
 * The states the server sends, which are the states the page has to draw.
 *
 * `state` is a routine's own; `overall` is the machine's, and the server takes
 * the worst of the two halves it reports, so it is drawn from the same three
 * words. Both live in `server_feed.py` in the intelligence repository - a
 * change there is what this list is checked against.
 */
const STATES = ['operational', 'degraded', 'down']

check('the section is registered everywhere a section is registered', () => {
  const faults = []
  const places = [
    [SECTIONS, "id: 'server'"],
    ['src/app/constants/routes.js', "key: 'ConsoleServer', path: 'server'"],
    ['src/app/views.js', 'ConsoleServer:'],
    ['vite/site-routes.js', "'/console/server'"],
  ]
  for (const [path, needle] of places) {
    if (!read(path).includes(needle)) faults.push(`${path} does not carry the Server section`)
  }
  report(faults)
})

check('the section is admin-only, and offers no scope, window or traffic strip', () => {
  const sections = read(SECTIONS)
  const entry = sections.slice(sections.indexOf("id: 'server'"))
  const body = entry.slice(0, entry.indexOf('},'))
  same(/admin: true/.test(body), true, 'admin only')
  // One machine that hosts none of the sites. A site chooser narrows nothing
  // on it, a date window has nothing to put over a temperature, and the
  // traffic strip counts an audience this section has none of.
  same(/scope: false/.test(body), true, 'no site in scope')
  same(/account: true/.test(body), true, 'answers for the account, not a site')
  same(/figures: false/.test(body), true, 'no traffic strip')
})

check('a reader who is not an admin cannot open the section by typing its address', () => {
  // The mark above takes the row out of the menu. Read there and nowhere else
  // it leaves /console/server open to anybody with a login: the feed refuses
  // every read, and the section draws anyway - the machine named, its tiles and
  // its table laid out - which is the studio's own hardware described to a
  // client. The frame reads the same mark and sends them back.
  const frame = read(FRAME)
  const faults = []
  const guard = frame.match(/if \([^\n]*section\?\.admin[^\n]*\) \{\n\s*return <Navigate[^\n]*\n/)
  if (!guard) faults.push(`${FRAME} does not turn a non-admin away from an admin section`)
  else {
    if (!/role !== 'admin'/.test(guard[0])) faults.push('the guard does not test the role')
    if (!/replace/.test(guard[0])) faults.push('the guard leaves the refused address in history')
  }
  // The role arrives with the overview read, so a guard that fired before it
  // landed would throw an admin off their own section on every refresh - which
  // is how a gate like this gets taken back out again.
  if (!/const roleKnown = /.test(frame)) faults.push('the guard does not wait for the role')
  report(faults)
})

check('the endpoint asks for the admin role rather than for a session', () => {
  const endpoint = read(ENDPOINT)
  same(endpoint.includes('authorizeAdmin'), true, 'authorizeAdmin is the door')
  same(
    /authorizeAccount\s*\(/.test(endpoint),
    false,
    'no plain session check stands in for the role check'
  )
})

check('nothing is read from the server before the caller has been checked', () => {
  // The far end is a machine with no account model, so it answers whatever
  // arrives carrying the token. A fetch above the role check would hand the
  // reading to anybody who reached this URL, whatever the response said
  // afterwards.
  const endpoint = read(ENDPOINT)
  const door = endpoint.indexOf('authorizeAdmin(clients')
  const reads = endpoint.indexOf('await readFeed()')
  same(door > -1 && reads > -1 && door < reads, true, 'the door stands before the read')
})

check("the server's token never leaves this side", () => {
  const faults = []
  const endpoint = read(ENDPOINT)
  // It travels in one header and nowhere else: not into a response, not into a
  // log line, and not into the URL, where a relay would write it to an access
  // log at both ends.
  //
  // Line by line rather than across the file. A window of characters spans the
  // statement boundary between a refusal and the guard under it, and reports a
  // token flowing into a response that never touches one.
  for (const [index, line] of endpoint.split('\n').entries()) {
    if (!/\bTOKEN\b/.test(line)) continue
    const at = `${ENDPOINT}:${index + 1}`
    if (/\bresponse\b/.test(line) && !/^\s*if \(/.test(line)) {
      faults.push(`${at} puts the token in a response`)
    }
    if (/console\.(error|log|warn)/.test(line)) faults.push(`${at} puts the token in the log`)
    if (/\?|searchParams/.test(line) && !/\|\|/.test(line)) {
      faults.push(`${at} puts the token in the query string, where a relay logs it`)
    }
  }
  const mentions = endpoint.match(/\bTOKEN\b/g) || []
  same(
    mentions.length,
    3,
    'the token is named where it is read, guarded and sent, and nowhere else'
  )
  // And it is never handed to a browser, which is what an env var read through
  // the bundler's own prefix would do.
  if (/VITE_/.test(endpoint)) faults.push('the endpoint reads a variable the browser also gets')
  report(faults)
})

check('the page draws every state the server can send', () => {
  const page = read(PAGE)
  const faults = []
  for (const state of STATES) {
    // Each appears twice: once as a routine's state and once as the machine's.
    const found = page.match(new RegExp(`^\\s*${state}:`, 'gm')) || []
    if (found.length < 2) {
      faults.push(`${state} is a state the server sends and the page has ${found.length} entry for`)
    }
  }
  report(faults)
})

check('a routine the page cannot place is drawn as a problem rather than as fine', () => {
  // The server can grow a fourth state, and the page will meet it before
  // anybody edits this file. Falling back to the settled reading would draw an
  // unknown condition in green, which is the one wrong answer here.
  const page = read(PAGE)
  same(/STATE\[routine\.state\] \|\| STATE\.degraded/.test(page), true, 'a routine falls back')
  same(/OVERALL\[server\?\.overall\] \|\| OVERALL\.degraded/.test(page), true, 'the machine does')
})

check('the age of the reading is judged, not the success of the request', () => {
  // The process serving this feed is one of the things that can die, so a
  // request can land perfectly on a body nothing has rebuilt for an hour. The
  // page checks when the server says it built the reading rather than when
  // this side fetched it.
  const page = read(PAGE)
  same(/updated_at/.test(page), true, 'the page reads the moment the server built it')
  same(/STALE_AFTER_MS/.test(page), true, 'and holds it against a limit')
  const stale = page.match(/const stale = ([^\n]+)/)
  same(Boolean(stale && /builtAt/.test(stale[1])), true, 'staleness is measured from that moment')
})

check('the machine is looked up here rather than left to the platform to find', () => {
  // The name is an ordinary public record that Google, Cloudflare and every
  // browser resolve, and the resolver inside a deployed function answers
  // ENOTFOUND for it while resolving everything else on the internet. Plain
  // `fetch` has no way past that: it fails before a packet leaves, and every
  // 502 this endpoint has ever logged was that lookup rather than the machine.
  //
  // `reach` asks the system resolver first and a public one only when the
  // system says the name is not there, so this stays an ordinary request the
  // day that resolver is right.
  const endpoint = read(ENDPOINT)
  const faults = []
  if (!/from '\.\.\/lib\/http\/reach\.js'/.test(endpoint)) {
    faults.push('the endpoint does not resolve the machine itself')
  }
  if (!/await reach\(/.test(endpoint)) faults.push('the read does not go through that lookup')
  // The bare `fetch` is the regression: it reads as a smaller change than it
  // is, and it puts the endpoint back on the resolver that cannot see the name.
  if (/await fetch\(/.test(endpoint)) faults.push('a read still goes out on the platform resolver')
  // A socket fault comes back bare rather than wrapped, so a reason read only
  // off `cause` would log every one of these as nothing in particular.
  if (!/error\.code/.test(endpoint)) faults.push('a bare socket fault is logged without its code')
  report(faults)
})

check('a machine that cannot be looked up does not read as a machine that is gone', () => {
  // The address of the far end is a subdomain of a zone somebody else runs,
  // and that zone refuses to resolve it every so often. A refusal is cached
  // against the caller for the zone's SOA minimum - five minutes - so both
  // attempts below it are the same lookup inside the same cached refusal, and
  // for those five minutes a machine that is up and answering in under a
  // second cannot be reached from here at all.
  //
  // The reading this side already has is still the truthful answer to the
  // question the page asks, and it arrives carrying the moment the machine
  // built it, which is what the page judges it by. So it is served, and the
  // page draws it and says how old it is - the case above this one.
  const endpoint = read(ENDPOINT)
  const faults = []

  const kept = endpoint.indexOf('held = body')
  const reads = endpoint.indexOf('await readFeed()')
  if (kept < 0) faults.push('no reading is kept')
  else if (!(reads > -1 && reads < kept)) {
    faults.push('a reading is kept before it has been read, so a failure would be held as one')
  }

  const serves = endpoint.indexOf('response.status(200).json(held)')
  const gives = endpoint.indexOf('.status(502)')
  if (serves < 0) faults.push('a failed read is not answered with the reading this side holds')
  else if (!(gives > -1 && serves < gives)) {
    faults.push('the failure is answered before the held reading is offered')
  }

  // Bounded, or a machine that has genuinely gone away is drawn forever off a
  // reading nothing will ever replace.
  if (!/HOLD_MS/.test(endpoint)) faults.push('the reading is held without a limit')
  if (gives < 0) faults.push('there is no failure left for a machine that is really gone')

  report(faults)
})

check('a failed read leaves the last reading standing', () => {
  // Every figure here measures a machine that may have gone away, and blanking
  // the page on one failed read turns a two-second blip in a home connection
  // into a page saying the server is gone.
  const hook = read(HOOK)
  const faults = []
  if (/setServer\(null\)/.test(hook)) faults.push('a failure clears the reading')
  if (!/setError\(/.test(hook)) faults.push('a failure is not reported at all')
  // A body with no routines in it is a different endpoint answering - a
  // relay's own error page, most likely - and drawing it puts an empty table
  // under live headings.
  if (!/Array\.isArray\(payload\.routines\)/.test(hook)) {
    faults.push('a body that is not the feed is taken as the feed')
  }
  report(faults)
})

check('the machine is called the Sunday Server wherever a reader sees it', () => {
  // The board it runs on has a make and a model, and that is a fact about the
  // hardware rather than a name for the thing. The hardware line comes off the
  // feed and says whatever the machine says about itself; no label, heading,
  // sentence or comment written on this side names it that way.
  const faults = []
  for (const path of [PAGE, HOOK, ENDPOINT, SECTIONS]) {
    const source = read(path)
    for (const [index, line] of source.split('\n').entries()) {
      if (/\bPi\b|\braspberry\s*pi\b/i.test(line)) {
        faults.push(`${path}:${index + 1} calls the machine a Pi`)
      }
    }
  }
  same(read(PAGE).includes('Sunday Server'), true, 'the page names the machine')
  report(faults)
})

const passed = await finish({ listed: true })
console.log(`\n${passed}/${cases.length} passed`)
