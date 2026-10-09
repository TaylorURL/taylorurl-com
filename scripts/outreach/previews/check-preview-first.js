/**
 * Renders a preview-first letter set the way the send job does and checks it
 * reads as one person's note: the subject it was written with, the pictures
 * where the letter names them, the preview's address as a link, the drawn
 * signature, and no unsubscribe link or trading line anywhere in either half.
 *
 * The letters are written on the Pi and only rendered here, so the cases also
 * hold the refusals: a row without a full set is not a preview-first row, and
 * a letter that names a picture it does not carry fails rather than sending a
 * gap.
 *
 *   node scripts/outreach/previews/check-preview-first.js
 */
import {
  PREVIEW_FIRST_DAYS,
  PREVIEW_LIFETIME_DAYS,
  isPreviewFirst,
  previewFirstLetter,
  previewUrl,
} from '../../../lib/outreach/previews.js'
import { check, finish, ok, same } from '../../harness/checks.js'

const SLUG = 'cactusjaxroofingconstruction'
const URL = previewUrl(SLUG)
const IMAGE = name => ({ src: `https://example.test/${SLUG}/${name}.png`, width: 560, alt: name })

const site = {
  slug: SLUG,
  letter: {
    version: 2,
    subject: 'Trenton Taylor - TaylorURL',
    first: [
      'Hi,',
      'A woman-owned roofer with a perfect 5.0 from 68 Google reviews is who people want to hire.',
      '{image:hero}',
      '{link}',
      'What would you change?',
    ],
    follow_ups: [
      ['Hi,', 'Here is what they would see on a phone:', '{image:phones}', '{link}'],
      ['Hi,', '{image:speed}', 'The draft is still up: {url}'],
      ['Hi,', 'I am taking the draft down on Friday.'],
    ],
    images: { hero: IMAGE('hero'), phones: IMAGE('phones'), speed: IMAGE('speed') },
  },
}

const first = previewFirstLetter(site, -1, { track: 'track-1' })
const both = letter => `${letter.text}\n${letter.html}`

check('a full version 2 set is a preview-first row', () =>
  ok(isPreviewFirst(site), 'not recognised')
)
check('an older letter is not a preview-first row', () =>
  ok(!isPreviewFirst({ slug: SLUG, letter: { subject: 'x', paragraphs: ['y'] } }), 'recognised')
)
check('a set missing a follow-up is not a preview-first row', () =>
  ok(
    !isPreviewFirst({ slug: SLUG, letter: { ...site.letter, follow_ups: [['Hi,']] } }),
    'recognised'
  )
)
check('the first letter keeps the subject it was written with', () =>
  same(first.subject, 'Trenton Taylor - TaylorURL', 'subject')
)
check('a follow-up replies under the first subject', () =>
  same(
    previewFirstLetter(site, 0, { track: 't', prior: { subject: first.subject } }).subject,
    'Re: Trenton Taylor - TaylorURL',
    'subject'
  )
)
check('no letter carries an unsubscribe link or the trading line', () => {
  for (let nth = -1; nth < PREVIEW_FIRST_DAYS.length; nth += 1) {
    const letter = previewFirstLetter(site, nth, { track: 't' })
    ok(!/unsubscribe/i.test(both(letter)), `letter ${nth} says unsubscribe`)
    ok(!/TaylorURL LLC/.test(both(letter)), `letter ${nth} carries the trading line`)
  }
})
check('the named picture is drawn, linked to the preview', () => {
  ok(first.html.includes(IMAGE('hero').src), 'no hero picture')
  ok(first.html.includes(`href="${URL}"`), 'the picture does not open the preview')
})
check('the plain half leaves the pictures out and keeps the address', () => {
  ok(!first.text.includes('{image'), 'a token reached the text')
  ok(first.text.includes(URL), 'no address in the text')
})
check('a {url} inside a sentence becomes the address', () => {
  const letter = previewFirstLetter(site, 1, { track: 't' })
  ok(letter.text.includes(`The draft is still up: ${URL}`), letter.text)
})
check('every letter closes on the drawn signature and the typed one', () => {
  ok(first.html.includes('/images/email/signature.png'), 'no drawn signature')
  ok(first.text.includes('Trenton Taylor | CEO'), 'no typed signature')
})
check('no ground is painted behind the letter', () =>
  ok(!/background(-color)?:/i.test(first.html), 'the letter paints a background')
)
check('a letter naming a picture it does not carry is refused', () => {
  const broken = { ...site, letter: { ...site.letter, images: {} } }
  let refused = false
  try {
    previewFirstLetter(broken, -1, { track: 't' })
  } catch {
    refused = true
  }
  ok(refused, 'sent with a missing picture')
})
check('the follow-ups fall inside the draft lifetime', () =>
  ok(
    PREVIEW_FIRST_DAYS.every(day => day < PREVIEW_LIFETIME_DAYS),
    'a follow-up after takedown'
  )
)

await finish()

console.log('preview-first letters: all cases pass')
