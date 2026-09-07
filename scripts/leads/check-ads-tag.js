/**
 * The wiring between the ad account and the page, checked where it fails
 * without saying so.
 *
 * Every fault this catches leaves an account that looks like it is working. A
 * `config` line that names no ad account still loads the property and still
 * counts readers. A `send_to` naming an account the tag never configured is
 * accepted by the tag, queued, and dropped. A paid visitor whose click
 * identifier is gone by the time the tag arrives still browses the site, still
 * fills in the form, and is still counted - as somebody who came from nowhere.
 * What all three produce is a campaign report of clicks and no conversions,
 * which is the same report a campaign nobody wants produces, and the account
 * spends against it either way.
 *
 * It reads the built head rather than the template, because the template is not
 * a document: the identifiers arrive through `%SITE_X%` tokens the head plugin
 * fills in, and reading the raw file would only prove that the tokens are
 * spelled the way this file spells them.
 *
 * Nothing here touches the network, so this runs anywhere.
 *
 *   npm run check:ads-tag
 */
import { readFileSync } from 'node:fs'
import { withSiteHead } from '../../vite/site-head-plugin.js'
import { taylorurl, taylorwebsite } from '../../lib/site/registry.js'
import { adsSendTo } from '../../src/app/data/leads/conversion.js'
import { counted } from '../../src/app/views/analytics/lib/counted.js'

const TEMPLATE = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const PRIVACY = readFileSync(
  new URL('../../src/app/views/legal/Privacy.jsx', import.meta.url),
  'utf8'
)

/** Every field on a record that names the ad account or an action in it. */
const ADS_FIELDS = ['adsId', 'adsLeadSendTo', 'adsCallSendTo', 'adsCheckoutSendTo']

let failed = 0
function fail(message) {
  failed += 1
  console.error(`FAIL ${message}`)
}

function is(where, got, want) {
  if (got !== want) fail(`${where}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
}

function has(where, haystack, needle) {
  if (!haystack.includes(needle)) fail(`${where}: ${JSON.stringify(needle)} is not there`)
}

const studio = taylorurl
const subsidiary = taylorwebsite
const page = withSiteHead(TEMPLATE, studio)

// -- The account reaches the page ---------------------------------------------

// One loader, two destinations. The ad account has no script of its own in the
// head: the property's loader drains the queue, finds both `config` lines and
// fetches each destination itself. So the thing that puts the account on the
// page is the second `config`, and nothing else would be missing without it.
has('the built head', page, `gtag('config', '${studio.gaId}')`)
has('the built head', page, `gtag('config', '${studio.adsId}')`)

// A literal token in the head is a build that filled nothing in.
is('tokens left in the built head', /%SITE_[A-Z_]+%/.test(page), false)

// -- A paid arrival is not made to wait ---------------------------------------

// The tags are held back until the page has settled, which is right for a
// reader and wrong for the one visitor whose identifier is on the address and
// nowhere else. The router replaces that address on the first navigation, so a
// tag fetched ten seconds later has nothing left to read.
// Read off the region around the test rather than off the exact source. An
// assertion that matches the head character for character is an assertion that
// fails when the head is reformatted, and a build refused over whitespace
// teaches everybody to stop believing the check.
const guard = (() => {
  const at = page.indexOf('location.search')
  if (at < 0) return null
  const before = page.slice(Math.max(0, at - 300), at)
  return page.slice(at, at + 200).includes('fetchTags()') ? before : null
})()

if (!guard) {
  fail('the built head waits on every visitor, including the ones who arrived on an ad')
} else {
  // All three, because which one a click carries is Google's choice and not
  // the advertiser's: `gclid` on the web, `gbraid` and `wbraid` where the
  // browser gives Google no identifier to write one against.
  for (const identifier of ['gclid', 'gbraid', 'wbraid']) {
    has('the paid-arrival bypass', guard, identifier)
  }
}

// -- Every action names the account that minted it ----------------------------

for (const field of ADS_FIELDS.slice(1)) {
  const sendTo = studio[field]
  if (typeof sendTo !== 'string' || !sendTo.includes('/')) {
    fail(`${field}: ${JSON.stringify(sendTo)} is not an "<account>/<label>" pair`)
    continue
  }
  const [account, label] = sendTo.split('/')
  is(`${field} account`, account, studio.adsId)
  // A label is minted by the account when an action is created and cannot be
  // derived from anything, so the only thing worth asserting is that one is
  // there. An empty half sends the conversion to the account and to no action
  // in it, which the tag accepts and the account never counts.
  is(`${field} label`, label.length > 0, true)
}

// Three distinct actions, because the report that matters is the one that
// separates them. Two fields holding one label is a conversion column that
// reads as twice the leads and half the calls.
const labels = new Set(ADS_FIELDS.slice(1).map(field => studio[field]))
is('distinct actions', labels.size, 3)

// -- Every form the site sends reaches one of them ----------------------------

// The forms as `sendEnquiry` and `startCheckout` name them. A fifth form added
// later reaches the lead action by default, which is the right default; a form
// reaching nothing is the failure, and it happens when a record loses a field.
for (const form of ['contact', 'start', 'tools', 'checkout']) {
  is(`the ${form} form`, typeof adsSendTo(form, studio), 'string')
  is(`the ${form} form on a site with no account`, adsSendTo(form, subsidiary), null)
}

// -- The subsidiary is told nothing -------------------------------------------

// A `send_to` naming the studio's account on the second site's domain would
// file a second site's leads against the studio's bidding. The four nulls are
// what keep it out, and the fence is what keeps the head off that domain.
for (const field of ADS_FIELDS) {
  is(`${field} on ${subsidiary.key}`, subsidiary[field], null)
}
is(`ad tracking on ${subsidiary.key}`, subsidiary.adTracking, false)
is(
  'the ad account in the second site head',
  withSiteHead(TEMPLATE, subsidiary).includes('AW-'),
  false
)

// A record that publishes the tag block with no account to name is the mistake
// the head plugin's throw exists for, and it has to keep throwing: without it
// the head ships a `config` line reading `null` and the account is silently off.
let refused = false
try {
  withSiteHead(TEMPLATE, { ...studio, adsId: null })
} catch {
  refused = true
}
if (!refused)
  fail('the head plugin accepted a site that publishes the tag block with no ad account')

// -- The console does not sell anything ---------------------------------------

// The layout that carries the tap listener is over the console too, and the
// console shows a project's support number in four places to people who have
// already bought. Reported, those taps land on the call action as a second
// conversion against the click that already paid for them.
//
// The rule is the tracker's own, so what is checked here is that the listener
// still asks it. A guard deleted in a refactor leaves a listener that reads
// correctly and quietly bills the console's support calls to the ad account.
const LAYOUT = readFileSync(
  new URL('../../src/app/components/chrome/Layout.jsx', import.meta.url),
  'utf8'
)
has('the tap listener', LAYOUT, 'counted(window.location.pathname)')

for (const where of ['/console', '/console/project', '/console/onboarding', '/login']) {
  is(`a tap on ${where}`, counted(where), false)
}
// The status board is the exception the tracker already makes, and it is the
// right one here too: it is public, and a reader of it has bought nothing.
for (const where of ['/console/status', '/contact', '/start', '/']) {
  is(`a tap on ${where}`, counted(where), true)
}

// -- The policy says so before the account is told anything -------------------

// Enhanced conversions send Google a one-way fingerprint of what somebody typed
// into a form, and switching it on in the account asserts that the site already
// discloses it. The disclosure is the thing that has to ship first, so it is
// checked here rather than trusted to have been remembered.
// Each phrase has to be absent from the policy as it stood, or the assertion is
// about somebody else's sentence and passes whatever this change does.
for (const phrase of [
  'Google Ads conversion tracking',
  'one-way fingerprints',
  'never reach Google',
]) {
  has('the privacy policy', PRIVACY, phrase)
}

if (failed) {
  console.error(`\n${failed} ads tag ${failed === 1 ? 'check' : 'checks'} failed`)
  process.exit(1)
}

console.log(
  `ads tag: ${studio.adsId} is configured on the built head beside ${studio.gaId}, ` +
    'three distinct actions each name it, a paid arrival fetches the tag rather than ' +
    `waiting for it, ${subsidiary.key} carries none of it, and the policy discloses it`
)
