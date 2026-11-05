/**
 * Renders a preview-first letter set the way the send job does and checks it
 * reads as one person's note: a subject naming the business, the pictures
 * where the letter names them, the preview's address as a link, the offer to
 * drive out and talk, the line saying Trenton will call with the number he
 * has, "Thanks, Trenton" over the drawn signature, none of the
 * compliment lines that read as a mail merge, and no unsubscribe link or
 * trading line anywhere in either half.
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
  PREVIEW_OFFER,
  PREVIEW_THANKS,
  isPreviewFirst,
  previewFirstLetter,
  previewUrl,
  spokenName,
} from '../../../lib/outreach/previews.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
check('the first letter is titled with the business, not the subject the Pi filed', () => {
  same(first.subject, 'New website for your business', 'a row with no name')
  const named = { ...site, name: 'GULF BEND ROOFING LLC' }
  same(
    previewFirstLetter(named, -1, { track: 't' }).subject,
    'New website for Gulf Bend Roofing',
    'a filed name'
  )
})
check('a follow-up replies under the subject its thread opened with', () => {
  same(
    previewFirstLetter(site, 0, { track: 't', prior: { subject: first.subject } }).subject,
    'Re: New website for your business',
    'a new thread'
  )
  same(
    previewFirstLetter(site, 2, { track: 't', prior: { subject: 'Trenton Taylor - TaylorURL' } })
      .subject,
    'Re: Trenton Taylor - TaylorURL',
    'a thread opened under the old subject'
  )
})
check('every letter offers to drive out, signed Thanks, Trenton', () => {
  for (let nth = -1; nth < PREVIEW_FIRST_DAYS.length; nth += 1) {
    const { text, html } = previewFirstLetter(site, nth, { track: 't' })
    ok(html.includes('Thanks,<br>Trenton'), `letter ${nth} is not signed in the html`)
    const paragraphs = text.split('\n\n')
    const last = paragraphs[paragraphs.indexOf(PREVIEW_THANKS) - 1]
    if (nth >= 0) {
      same(last, PREVIEW_OFFER, `follow-up ${nth + 1} does not close on the offer`)
    } else {
      ok(/\bdrive\b/.test(last), `the first letter's close does not offer to drive out:\n${last}`)
      ok(!text.includes(PREVIEW_OFFER), 'the first letter offers to drive out twice')
    }
  }
})
check('no letter carries a compliment line or a rating', () => {
  const rich = {
    ...site,
    name: 'Gulf Bend Roofing',
    letter: {
      ...site.letter,
      first: ['Hi,', 'Family owned since 1987, with a perfect 5.0 from 68 Google reviews.'],
      facts: ['Founded in 1987.', 'Google rating of 5.0.', '68 Google reviews.'],
      follow_ups: [
        site.letter.follow_ups[0],
        site.letter.follow_ups[1],
        ['Hi,', 'Good luck with the busy season either way.'],
      ],
    },
  }
  for (let nth = -1; nth < PREVIEW_FIRST_DAYS.length; nth += 1) {
    const { text } = previewFirstLetter(rich, nth, { track: 't' })
    ok(!/1987|years|family|stars|reviews|Good luck/i.test(text), `letter ${nth}:\n${text}`)
  }
})
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
  ok(letter.text.includes(`You can still see it here: ${URL}`), letter.text)
})
check('a business with no speed test gets a plain check-in, not the Pi write-up', () => {
  const { text } = previewFirstLetter(site, 1, { track: 't' })
  ok(text.includes('I wanted to check in again about the website I built for your business.'), text)
  ok(!text.includes('The draft is still up'), 'the Pi write-up went out')
})
check('a business with a speed test gets both load times and the picture', () => {
  const timed = {
    ...site,
    letter: {
      ...site.letter,
      facts: ['Their current site takes 34.9 seconds and the new site 2.9 seconds on mobile.'],
    },
  }
  const { text, html } = previewFirstLetter(timed, 1, { track: 't' })
  ok(/34\.9 seconds/.test(text) && /\b2\.9\b/.test(text), text)
  ok(html.includes(IMAGE('speed').src), 'no speed picture')
})
check('every letter closes on the drawn signature and the typed one', () => {
  ok(first.html.includes('/images/email/signature.png'), 'no drawn signature')
  ok(first.text.includes('Trenton Taylor | Owner'), 'no typed signature')
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
check('the letters name the business the way a person would, not as it is filed', () => {
  same(spokenName('XENOS MARINE LLC'), 'Xenos Marine', 'capitals and the company form')
  same(spokenName('Torcsill Foundations LLC (Pasadena, TX)'), 'Torcsill Foundations', 'the town')
  same(spokenName('BAY AREA HVAC LLC'), 'Bay Area HVAC', 'initials kept')
  same(spokenName("Joe's Tacos"), "Joe's Tacos", 'a name already in ordinary case')
  const filed = {
    ...site,
    name: 'XENOS MARINE LLC',
    letter: {
      ...site.letter,
      first: [
        'Hi,',
        'So I built XENOS MARINE LLC a new website:',
        '{link}',
        'XENOS MARINE is ready.',
      ],
    },
  }
  const text = previewFirstLetter(filed, -1, { track: 't' }).text
  ok(text.includes('Xenos Marine'), text)
  ok(!text.includes('XENOS'), 'the filed name survives')
})
check('every first letter says Trenton will call, reads out the number and asks after it', () => {
  // Enough slugs that each of the three ways of opening is drawn.
  const openings = new Set()
  for (const slug of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']) {
    const one = { ...site, slug }
    const { text, html } = previewFirstLetter(one, -1, { track: 't', phone: '+1 832-555-0142' })
    openings.add(text.split('\n').find(line => /Trenton/.test(line) && !/^Thanks/.test(line)))
    for (const half of [text, html]) {
      ok(/introduce myself/.test(half), `${slug}: no call promised`)
      ok(half.includes('(832) 555-0142'), `${slug}: the number is not read out`)
      ok(
        /\?/.test(half.slice(half.indexOf('(832) 555-0142'))),
        `${slug}: the number is not asked after`
      )
      ok(/let me know/.test(half), `${slug}: nothing says to say if it is wrong`)
    }
    ok(
      text.indexOf('introduce myself') > text.indexOf(previewUrl(slug)),
      `${slug}: the call comes before the link`
    )
    const close = text.split('\n\n').find(paragraph => paragraph.includes('introduce myself'))
    ok(/\bdrive\b/.test(close), `${slug}: the call and the drive are not one paragraph`)
    ok(close.includes('(832) 555-0142'), `${slug}: the number is not in the closing paragraph`)
    ok(
      /let me know( a better one)?\.$/.test(close),
      `${slug}: the close does not end on the question`
    )
    const bare = previewFirstLetter(one, -1, { track: 't', phone: null }).text
    ok(/introduce myself/.test(bare), `${slug}: no call promised without a number`)
    ok(/best number to reach you\?/.test(bare), `${slug}: no number asked for`)
    ok(
      !/\(\d{3}\)/.test(bare.slice(0, bare.indexOf(PREVIEW_THANKS))),
      `${slug}: a number read out that is not on file`
    )
    same(
      previewFirstLetter(one, -1, { track: 't', phone: '555-0142' }).text,
      bare,
      `${slug}: a number short of ten digits is read out`
    )
  }
  same(openings.size, 3, 'all three ways of opening')
  for (const nth of [0, 1, 2]) {
    const { text } = previewFirstLetter(site, nth, { track: 't', phone: '8325550142' })
    ok(!/introduce myself/.test(text), `follow-up ${nth + 1} promises the call again`)
    ok(!text.includes('555-0142'), `follow-up ${nth + 1} reads out the number`)
  }
  const sender = readFileSync(
    join(import.meta.dirname, '../../../api/outreach/previews.js'),
    'utf8'
  )
  ok(
    /previewFirstLetter\([\s\S]*?phone: prospect\.phone/.test(sender),
    'the sender hands no number in'
  )
  ok(/select\('id, name, email, phone,/.test(sender), 'the sender does not read the number')
})
check('the follow-ups fall inside the draft lifetime', () =>
  ok(
    PREVIEW_FIRST_DAYS.every(day => day < PREVIEW_LIFETIME_DAYS),
    'a follow-up after takedown'
  )
)

await finish()

console.log('preview-first letters: all cases pass')
