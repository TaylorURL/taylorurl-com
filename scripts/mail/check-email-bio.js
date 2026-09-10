#!/usr/bin/env node
/**
 * Every message the studio sends says who wrote it, in the one wording.
 *
 * The families render independently — the newsletter builds its own sheet, the
 * confirmation builds another, and outreach builds a third — and all of them
 * are rendered rather than read, because wording that is exported and never
 * drawn into a message is the failure a comparison of the source alone would
 * miss.
 *
 * The laid-out families draw the bio paragraph and the portrait. Outreach no
 * longer does: it is written plain, and a paragraph of biography under a
 * photograph is the thing a letter a person typed does not have. What it
 * carries instead is the name and the studio's address, and the check is that
 * both are the bio's own rather than a second spelling of them.
 *
 * The number is checked for its absence. A cold letter asks for nothing, and a
 * number under a stranger's sign-off is an ask however quietly it is put, so
 * the address is the only way back and a phone reaching the letter is the
 * failure. The number belongs to the families a reader has asked to hear from.
 */

import { confirmationBodies } from '../../lib/mail/message.js'
import { BIO_NAME, BIO_PHONE, BIO_PORTRAIT, bioHtml, bioText } from '../../lib/mail/bio.js'
import { renderIssueHtml, renderIssueText } from '../../lib/mail/emailTemplate.js'
import { compose } from '../../api/outreach/send.js'

const ACCENT = '#1a4ed8'
// The address as a sign-off shows it, which is the studio's own host without
// its protocol. Outreach leaves from another domain and links to this one,
// because what goes under a person's name is where their studio is.
const HOME = 'www.taylorurl.com'
const failures = []

/** Record a failure unless the rendered part carries the fragment. */
function carries(what, part, fragment, called = 'the bio') {
  if (!part.includes(fragment)) failures.push(`${what} does not carry ${called}`)
}

/** Record a failure when the rendered part carries the fragment at all. */
function lacks(what, part, fragment, called = 'the bio') {
  if (part.includes(fragment)) failures.push(`${what} carries ${called}`)
}

/**
 * The three things every laid-out bio holds: the prose, the name it is written
 * in the voice of, and the portrait beside it. A message that keeps the words
 * and loses the frame passes a check that only reads the sentences.
 */
function carriesBio(what, html) {
  carries(`${what} prose`, html, bioHtml({ accent: ACCENT }))
  carries(`${what} name`, html, BIO_NAME)
  carries(`${what} portrait`, html, BIO_PORTRAIT)
}

// An issue with no blocks still draws its footer, which is where the bio sits.
const issue = { title: 'Check', preheader: '', body: [] }
const newsletter = { issue, unsubscribe: 'https://www.taylorurl.com/unsubscribe?token=t' }

const drawn = { 'newsletter HTML': renderIssueHtml(newsletter) }

carriesBio('newsletter HTML', renderIssueHtml(newsletter))
carries('newsletter text', renderIssueText(newsletter), bioText())

// A whole message from the composer rather than a hand-built content object,
// so what is checked is the letter as it leaves rather than a shape assembled
// here to pass.
const outreach = compose({
  name: 'Baytown Collision Center',
  town: 'Baytown',
  trade: 'auto body shop',
  website: 'https://www.example-body-shop.com',
  audit_score: 54,
  site_kind: 'site',
  unsub_token: 'check',
})

drawn['outreach HTML'] = outreach.html

for (const [half, part] of [
  ['outreach HTML', outreach.html],
  ['outreach text', outreach.text],
]) {
  carries(half, part, BIO_NAME, 'the name from the bio')
  // Under the name goes the studio's address and nothing else. The letter asks
  // for nothing, so it offers no number: a phone under a cold sign-off is a
  // call to action, and the one this letter makes is that the reader remembers
  // the name. The address is there so somebody who wants to look can.
  lacks(half, part, BIO_PHONE, 'the number under the sign-off')
  carries(half, part, HOME, 'the address under the sign-off')
}

// A plain letter's envelope holds two images: the square that says whether the
// letter was opened, and the signature it is signed with. Anything else in
// there is a laid-out band that has found its way back into a family that has
// no room for one.
const images = [...outreach.html.matchAll(/<img[^>]*>/g)].map(match => match[0])
const stray = images.filter(tag => !/width="1"/.test(tag) && !/signature\.png/.test(tag))
if (stray.length) {
  failures.push(`outreach HTML draws ${stray.length} image(s) beyond the open pixel`)
}
// The signature is what says who wrote the letter, so it has to say it with
// the pictures turned off as well as on.
if (!images.some(tag => /signature\.png/.test(tag) && tag.includes(`alt="${BIO_NAME},`))) {
  failures.push('outreach HTML is unsigned, or signs with a picture that says nothing')
}

{
  const confirmation = confirmationBodies(
    'https://www.taylorurl.com/subscribe/confirm?token=t',
    'https://www.taylorurl.com/unsubscribe?token=t'
  )

  drawn['confirmation HTML'] = confirmation.html

  carriesBio('confirmation HTML', confirmation.html)
  carries('confirmation text', confirmation.text, bioText())
}

// Formats no mail client can be relied on to draw. WebP is absent from every
// Outlook build on Windows and SVG from most clients anywhere, so an image in
// either format is a broken frame for a share of every list this sends to --
// and the site's own captures are WebP, which is one import away from being
// the thing a message points at.
const UNDRAWABLE = ['.webp', '.svg']

for (const [what, html] of Object.entries(drawn)) {
  for (const source of html.matchAll(/src="([^"]+)"/g)) {
    const url = source[1].toLowerCase().split('?')[0]
    const bad = UNDRAWABLE.find(extension => url.endsWith(extension))
    if (bad) failures.push(`${what} draws a ${bad} image, which mail clients do not: ${source[1]}`)
  }
}

if (failures.length) {
  console.error('check-email-bio: failed')
  for (const failure of failures) console.error(`  ${failure}`)
  console.error('  the wording lives in lib/mail/bio.js')
  process.exit(1)
}

console.log(
  'check-email-bio: every family says who wrote it in the one wording, and every image is one a client draws'
)
