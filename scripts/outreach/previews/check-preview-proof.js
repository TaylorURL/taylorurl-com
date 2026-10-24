/**
 * Holds the reviews postscript every preview letter closes on to what the
 * networks actually said, and to the letter it is added to.
 *
 * The line is a claim a stranger is about to go and check, so the failures
 * that matter are the quiet ones: a figure from a reading that never came
 * back, the committed Trustpilot floor quoted as if it were today's, Google
 * named while it holds fewer reviews than Trustpilot, or a link that arrives
 * without the tag that says which letter it came out of. The other half is the
 * letter itself. The postscript may add words and at most two links, and
 * nothing else: no picture, no second open square, no unsubscribe line in a
 * note from Trenton, and no dash, emoji or exclamation mark in either half.
 *
 * Trustpilot and Google are both fakes here, driven through every answer the
 * line has a different sentence for, so this runs anywhere and reaches no
 * network.
 *
 *   node scripts/outreach/previews/check-preview-proof.js
 */
import { readFileSync } from 'node:fs'
import { postscriptText } from '../../../lib/outreach/message.js'
import { PREVIEW_FIRST_DAYS, previewFirstLetter } from '../../../lib/outreach/previews.js'
import {
  previewCampaign,
  proofLine,
  proofNow,
  readProof,
  taggedProfile,
} from '../../../lib/outreach/proof.js'
import { BBB_PROFILE_URL } from '../../../src/app/data/reputation/bbb.js'
import { GOOGLE_PLACE_ID } from '../../../src/app/data/reputation/google.js'
import {
  TRUSTPILOT_DATA_URL,
  TRUSTPILOT_PROFILE_URL,
} from '../../../src/app/data/reputation/trustpilot.js'
import { TRUSTPILOT_STANDING } from '../../../src/app/data/reputation/trustpilot-standing.js'
import { check, finish, ok, report, same } from '../../harness/checks.js'
import { OFFLINE } from '../../harness/offline.js'

// Nothing here may reach the network.
globalThis.fetch = OFFLINE

// Inside the window the committed Trustpilot standing is served in, so a case
// that sees Trustpilot refuse would find the floor if the line ever read it.
const NOW = Date.parse(`${TRUSTPILOT_STANDING.capturedAt}T12:00:00Z`)
const HOUR_MS = 60 * 60 * 1000

/** The TrustBox payload, with the count and score given. */
const trustbox = (total, trustScore = 4.3) => {
  const unit = { trustScore, stars: 4.5, numberOfReviews: { total } }
  return { businessUnit: unit, businessEntity: unit, starsString: 'Excellent' }
}

/**
 * A fetch answering Trustpilot and Google as told. A network handed a number
 * answers that status with no body; one handed an object answers it as JSON.
 */
function networks({ trustpilot, google }) {
  const asked = { trustpilot: 0, google: 0 }
  const answer = value =>
    typeof value === 'number'
      ? new Response(null, { status: value })
      : new Response(JSON.stringify(value), { status: 200 })
  const fetcher = async (url, init = {}) => {
    if (url === TRUSTPILOT_DATA_URL) {
      asked.trustpilot += 1
      if (trustpilot instanceof Error) throw trustpilot
      return answer(trustpilot)
    }
    if (url.startsWith('https://places.googleapis.com/v1/places/')) {
      asked.google += 1
      ok(url.endsWith(encodeURIComponent(GOOGLE_PLACE_ID)), `Google was asked about ${url}`)
      ok(
        init.headers?.['X-Goog-FieldMask'] === 'rating,userRatingCount',
        `Google was asked for ${init.headers?.['X-Goog-FieldMask']}`
      )
      return answer(google)
    }
    throw new Error(`a check reached ${url}`)
  }
  return { fetcher, asked }
}

const read = async (answers, key = 'a-places-key') => {
  const { fetcher, asked } = networks(answers)
  const proof = await readProof({ fetchImpl: fetcher, key, now: NOW })
  return { proof, asked }
}

const sentence = line =>
  line.parts.map(part => (typeof part === 'string' ? part : part.text)).join('')
const links = line => line.parts.filter(part => typeof part !== 'string')
const FIRST = { campaign: previewCampaign(-1, PREVIEW_FIRST_DAYS), nth: -1 }

// ── The reading ─────────────────────────────────────────────────────────

check('both networks answering are both read', async () => {
  const { proof } = await read({
    trustpilot: trustbox(7),
    google: { rating: 5, userRatingCount: 2 },
  })
  same(JSON.stringify(proof.trustpilot), '{"rating":4.3,"reviewCount":7}', 'Trustpilot')
  same(JSON.stringify(proof.google), '{"rating":5,"reviewCount":2}', 'Google')
  ok(proof.bbb === true, 'the accreditation was not held')
})

check('a Trustpilot refusal is no reading, not the committed floor', async () => {
  for (const trustpilot of [403, new Error('unreachable'), { businessUnit: {} }]) {
    const { proof } = await read({ trustpilot, google: { rating: 5, userRatingCount: 2 } })
    same(proof.trustpilot, null, `Trustpilot answering ${trustpilot}`)
  }
})

check('a Google refusal, or no key, is no Google reading', async () => {
  const refused = await read({ trustpilot: trustbox(7), google: 500 })
  same(refused.proof.google, null, 'Google refusing')
  const keyless = await read(
    { trustpilot: trustbox(7), google: { rating: 5, userRatingCount: 9 } },
    ''
  )
  same(keyless.proof.google, null, 'Google with no key')
  same(keyless.asked.google, 0, 'times Google was asked with no key')
})

check('a listing Google answers with nothing on is a reading of zero', async () => {
  const { proof } = await read({ trustpilot: trustbox(7), google: {} })
  same(JSON.stringify(proof.google), '{"rating":0,"reviewCount":0}', 'Google')
})

check('a run takes one reading an hour, and a partial one for five minutes', async () => {
  process.env.GOOGLE_PLACES_API_KEY = 'a-places-key'
  const whole = networks({ trustpilot: trustbox(7), google: { rating: 5, userRatingCount: 2 } })
  globalThis.fetch = whole.fetcher
  const start = NOW + 10 * 24 * HOUR_MS
  await proofNow({ now: start })
  await proofNow({ now: start + HOUR_MS - 1 })
  same(whole.asked.google, 1, 'Google reads inside the hour')
  await proofNow({ now: start + HOUR_MS })
  same(whole.asked.google, 2, 'Google reads once the hour is up')

  const partial = networks({ trustpilot: 403, google: { rating: 5, userRatingCount: 2 } })
  globalThis.fetch = partial.fetcher
  const later = start + 3 * HOUR_MS
  await proofNow({ now: later })
  await proofNow({ now: later + 4 * 60 * 1000 })
  same(partial.asked.trustpilot, 1, 'Trustpilot reads inside five minutes of a refusal')
  await proofNow({ now: later + 5 * 60 * 1000 })
  same(partial.asked.trustpilot, 2, 'Trustpilot reads five minutes after a refusal')
  globalThis.fetch = OFFLINE
  delete process.env.GOOGLE_PLACES_API_KEY
})

// ── The line ────────────────────────────────────────────────────────────

const LIVE = { trustpilot: { rating: 4.3, reviewCount: 7 }, google: null, bbb: true }

check('a live Trustpilot reading and the accreditation make the line', () => {
  const line = proofLine({ ...LIVE, google: { rating: 5, reviewCount: 2 } }, FIRST)
  same(
    sentence(line),
    'P.S. If you want to look me up first, TaylorURL is BBB accredited and rated 4.3 out of 5 from 7 reviews on Trustpilot.',
    'the line'
  )
  same(
    links(line)
      .map(part => part.text)
      .join(' | '),
    'BBB accredited | rated 4.3 out of 5 from 7 reviews on Trustpilot',
    'the linked phrases'
  )
})

check('Google joins only once it holds more reviews than Trustpilot', () => {
  const level = proofLine({ ...LIVE, google: { rating: 4.9, reviewCount: 7 } }, FIRST)
  ok(!/Google/.test(sentence(level)), `Google named at the same count: ${sentence(level)}`)
  const ahead = proofLine({ ...LIVE, google: { rating: 4.9, reviewCount: 12 } }, FIRST)
  same(
    sentence(ahead),
    'P.S. If you want to look me up first, TaylorURL is BBB accredited, rated 4.9 out of 5 from 12 reviews on Google and 4.3 from 7 reviews on Trustpilot.',
    'the line with Google ahead'
  )
  same(links(ahead).length, 2, 'links with Google ahead, which is said without one')
})

check('an unread Trustpilot names the profile with no figure, and leaves Google out', () => {
  const line = proofLine(
    { trustpilot: null, google: { rating: 4.9, reviewCount: 40 }, bbb: true },
    FIRST
  )
  same(
    sentence(line),
    'P.S. If you want to look me up first, TaylorURL is BBB accredited and has reviews on Trustpilot.',
    'the line'
  )
  ok(!/\d/.test(sentence(line)), 'a figure in a line read from nothing')
})

check('a Trustpilot profile nobody has written on is left out', () => {
  const alone = proofLine(
    { trustpilot: { rating: 0, reviewCount: 0 }, google: null, bbb: true },
    FIRST
  )
  same(
    sentence(alone),
    'P.S. If you want to look me up first, TaylorURL is BBB accredited.',
    'BBB alone'
  )
  const google = proofLine(
    { trustpilot: { rating: 0, reviewCount: 0 }, google: { rating: 5, reviewCount: 3 }, bbb: true },
    FIRST
  )
  same(
    sentence(google),
    'P.S. If you want to look me up first, TaylorURL is BBB accredited and rated 5.0 out of 5 from 3 reviews on Google.',
    'Google over an empty Trustpilot'
  )
  ok(!links(google).some(part => part.href.includes('trustpilot')), 'an empty profile linked')
})

check('one review is one review', () => {
  const line = proofLine({ ...LIVE, trustpilot: { rating: 5, reviewCount: 1 } }, FIRST)
  ok(sentence(line).includes('from 1 review on Trustpilot'), sentence(line))
})

check(
  'without the accreditation the ratings stand alone, and with nothing there is no line',
  () => {
    same(
      sentence(proofLine({ ...LIVE, bbb: false }, FIRST)),
      'P.S. If you want to look me up first, TaylorURL is rated 4.3 out of 5 from 7 reviews on Trustpilot.',
      'Trustpilot alone'
    )
    same(
      sentence(proofLine({ trustpilot: null, google: null, bbb: false }, FIRST)),
      'P.S. If you want to look me up first, TaylorURL has reviews on Trustpilot.',
      'an unread Trustpilot alone'
    )
    same(
      proofLine({ trustpilot: { rating: 0, reviewCount: 0 }, google: null, bbb: false }, FIRST),
      null,
      'nothing to say'
    )
    same(proofLine(null, FIRST), null, 'no reading at all')
  }
)

check('every link is the profile itself, tagged with the letter it came out of', () => {
  const line = proofLine(LIVE, { campaign: 'preview-first-day-8', nth: 1 })
  const hrefs = links(line).map(part => part.href)
  same(hrefs[0], taggedProfile(BBB_PROFILE_URL, 'preview-first-day-8'), 'the BBB link')
  same(
    hrefs[1],
    taggedProfile(TRUSTPILOT_PROFILE_URL, 'preview-first-day-8'),
    'the Trustpilot link'
  )
  for (const href of hrefs) {
    const url = new URL(href)
    same(url.searchParams.get('utm_source'), 'preview', `utm_source on ${href}`)
    same(url.searchParams.get('utm_medium'), 'outreach', `utm_medium on ${href}`)
    same(url.searchParams.get('utm_campaign'), 'preview-first-day-8', `utm_campaign on ${href}`)
  }
})

check('a profile that already carries a query keeps it under the tags', () => {
  const url = new URL(taggedProfile('https://www.facebook.com/profile.php?id=123', 'preview-first'))
  same(url.searchParams.get('id'), '123', 'the profile id')
  same(url.searchParams.get('utm_campaign'), 'preview-first', 'the campaign')
})

check('every letter in the chain is counted under a name of its own', () => {
  const names = [-1, 0, 1, 2].map(nth => previewCampaign(nth, PREVIEW_FIRST_DAYS))
  same(
    names.join(','),
    'preview-first,preview-first-day-3,preview-first-day-8,preview-first-day-18',
    'the preview-first names'
  )
  same(new Set(names).size, names.length, `a name used twice in ${names.join(', ')}`)
  ok(
    names.every(name => /^[a-z0-9-]+$/.test(name)),
    'a campaign name a report would mangle'
  )
})

// ── The letters ─────────────────────────────────────────────────────────

const SLUG = 'sample-roofing'
const SITE = {
  slug: SLUG,
  name: 'Gulf Bend Roofing',
  email: 'owner@example.com',
  rating_count: 12,
  shot_url: `https://example.test/${SLUG}/shot.png`,
  letter: {
    version: 2,
    subject: 'Trenton Taylor - TaylorURL',
    first: ['Hi,', 'A draft for a roofer.', '{image:hero}', '{link}', 'What would you change?'],
    follow_ups: [
      ['Hi,', 'Here it is on a phone:', '{image:phones}', '{link}'],
      ['Hi,', 'The draft is still up: {url}'],
      ['Hi,', 'I am taking the draft down on Friday.'],
    ],
    images: {
      hero: { src: `https://example.test/${SLUG}/hero.png`, width: 560, alt: 'hero' },
      phones: { src: `https://example.test/${SLUG}/phones.png`, width: 560, alt: 'phones' },
    },
  },
}
const READINGS = [
  LIVE,
  { ...LIVE, google: { rating: 4.9, reviewCount: 12 } },
  { trustpilot: null, google: null, bbb: true },
  { trustpilot: { rating: 0, reviewCount: 0 }, google: null, bbb: true },
]

/** Every preview letter there is, drafted with and without a reading. */
function letters(proof) {
  const out = []
  for (let nth = -1; nth < PREVIEW_FIRST_DAYS.length; nth += 1) {
    out.push({
      name: `preview-first ${nth}`,
      personal: true,
      campaign: previewCampaign(nth, PREVIEW_FIRST_DAYS),
      letter: previewFirstLetter(SITE, nth, { track: 'fixture-track', proof }),
    })
  }
  return out
}

const count = (text, pattern) => (text.match(pattern) ?? []).length
const BARE = letters(null)

check('a letter drafted without a reading carries no postscript', () => {
  report(BARE.filter(one => /P\.S\./.test(one.letter.text)).map(one => `${one.name} says P.S.`))
})

check('every letter carries the postscript once in each half, under the signature', () => {
  const faults = []
  for (const proof of READINGS) {
    for (const one of letters(proof)) {
      const { text, html } = one.letter
      if (count(text, /P\.S\./g) !== 1)
        faults.push(`${one.name}: P.S. ${count(text, /P\.S\./g)} times in the text`)
      if (count(html, /P\.S\./g) !== 1)
        faults.push(`${one.name}: P.S. ${count(html, /P\.S\./g)} times in the html`)
      if (html.indexOf('P.S.') < html.indexOf('/images/email/signature.png')) {
        faults.push(`${one.name}: the postscript sits above the signature`)
      }
      const signed = one.personal ? 'Trenton Taylor | CEO' : 'Trenton Taylor\nTaylorURL'
      if (text.indexOf('P.S.') < text.indexOf(signed)) {
        faults.push(`${one.name}: the text postscript sits above the signature`)
      }
      if (!one.personal && html.indexOf('P.S.') > html.indexOf('Unsubscribe')) {
        faults.push(`${one.name}: the postscript sits under the way off the list`)
      }
    }
  }
  report(faults)
})

check('the postscript adds at most two links and nothing else to a letter', () => {
  const faults = []
  for (const proof of READINGS) {
    letters(proof).forEach((one, index) => {
      const bare = BARE[index].letter.html
      const { html } = one.letter
      const added = count(html, /<a\s/g) - count(bare, /<a\s/g)
      if (added < 1 || added > 2) faults.push(`${one.name}: ${added} links added`)
      if (count(html, /<img\s/g) !== count(bare, /<img\s/g))
        faults.push(`${one.name}: a picture added`)
      if (count(html, /api\/outreach\/open/g) !== 1)
        faults.push(`${one.name}: not exactly one open square`)
    })
  }
  report(faults)
})

check('the links in both halves carry the letter they came out of', () => {
  const faults = []
  for (const one of letters(LIVE)) {
    const line = proofLine(LIVE, { campaign: one.campaign, nth: -1 })
    for (const part of links(line)) {
      if (!one.letter.text.includes(part.href))
        faults.push(`${one.name}: the text half lacks ${part.href}`)
      const escaped = part.href.replaceAll('&', '&amp;')
      if (!one.letter.html.includes(`href="${escaped}"`)) {
        faults.push(`${one.name}: the html half lacks ${part.href}`)
      }
    }
  }
  report(faults)
})

check('a note from Trenton still carries no unsubscribe link or trading line', () => {
  const faults = []
  for (const proof of READINGS) {
    for (const one of letters(proof).filter(entry => entry.personal)) {
      const both = `${one.letter.text}\n${one.letter.html}`
      if (/unsubscribe/i.test(both)) faults.push(`${one.name} says unsubscribe`)
      if (/TaylorURL LLC/.test(both)) faults.push(`${one.name} carries the trading line`)
    }
  }
  report(faults)
})

check('no postscript carries a dash, an emoji or an exclamation mark', () => {
  const faults = []
  const readings = [
    ...READINGS,
    { ...LIVE, bbb: false },
    { trustpilot: null, google: null, bbb: false },
  ]
  for (const proof of readings) {
    for (let nth = -1; nth < PREVIEW_FIRST_DAYS.length; nth += 1) {
      const line = proofLine(proof, { campaign: 'preview-first', nth })
      const words = postscriptText(line)
      if (/[‒-―−]|\s-\s|--/.test(words)) faults.push(`a dash in: ${words}`)
      if (/\p{Extended_Pictographic}/u.test(words)) faults.push(`an emoji in: ${words}`)
      if (words.includes('!')) faults.push(`an exclamation mark in: ${words}`)
    }
  }
  report(faults)
})

check('a thread does not open two letters in a row on the same words', () => {
  const opening = nth => sentence(proofLine(LIVE, { campaign: 'preview-first', nth })).split(',')[0]
  for (let nth = -1; nth < PREVIEW_FIRST_DAYS.length - 1; nth += 1) {
    ok(
      opening(nth) !== opening(nth + 1),
      `letters ${nth} and ${nth + 1} both open "${opening(nth)}"`
    )
  }
})

// ── The sender ──────────────────────────────────────────────────────────

check('the sender drafts every letter with a reading', () => {
  const source = readFileSync(new URL('../../../api/outreach/previews.js', import.meta.url), 'utf8')
  ok(
    /previewFirstLetter\([\s\S]*?proof: await proofNow\(\)/.test(source),
    'the letter is drafted without a reading'
  )
})

await finish()

console.log('preview proof line: all cases pass')
