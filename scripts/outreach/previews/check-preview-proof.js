/**
 * Holds the postscript the first preview letter closes on to what Trustpilot
 * actually said, and to the letter it is added to.
 *
 * The line sends a stranger to look the studio up, so the failures that
 * matter are the quiet ones: a profile nobody has reviewed named as if it
 * were worth a visit, the committed Trustpilot floor read as if it were
 * today's, a rating quoted at all, a follow-up signing off on the same line
 * again, or a link that arrives without the tag that says which letter it
 * came out of. The other half is the letter itself. The postscript may add
 * words and at most two links to the first letter, and nothing else: no
 * picture, no second open square, no unsubscribe line in a note from Trenton,
 * and no dash, emoji or exclamation mark in either half.
 *
 * Trustpilot is a fake here, driven through every answer the line has a
 * different sentence for, and Google is a fake that must never be asked, so
 * this runs anywhere and reaches no network.
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
 * A fetch answering Trustpilot as told, and counting any question put to
 * Google, which the line no longer reads. A network handed a number answers
 * that status with no body; one handed an object answers it as JSON.
 */
function networks({ trustpilot }) {
  const asked = { trustpilot: 0, google: 0 }
  const answer = value =>
    typeof value === 'number'
      ? new Response(null, { status: value })
      : new Response(JSON.stringify(value), { status: 200 })
  const fetcher = async url => {
    if (url === TRUSTPILOT_DATA_URL) {
      asked.trustpilot += 1
      if (trustpilot instanceof Error) throw trustpilot
      return answer(trustpilot)
    }
    if (url.startsWith('https://places.googleapis.com/')) {
      asked.google += 1
      return answer({ rating: 5, userRatingCount: 99 })
    }
    throw new Error(`a check reached ${url}`)
  }
  return { fetcher, asked }
}

const read = async answers => {
  const { fetcher, asked } = networks(answers)
  const proof = await readProof({ fetchImpl: fetcher, now: NOW })
  return { proof, asked }
}

const sentence = line =>
  line.parts.map(part => (typeof part === 'string' ? part : part.text)).join('')
const links = line => line.parts.filter(part => typeof part !== 'string')
const FIRST = { campaign: previewCampaign(-1, PREVIEW_FIRST_DAYS), nth: -1 }

// ── The reading ─────────────────────────────────────────────────────────

check('Trustpilot answering is read, and Google is never asked', async () => {
  process.env.GOOGLE_PLACES_API_KEY = 'a-places-key'
  const { proof, asked } = await read({ trustpilot: trustbox(7) })
  delete process.env.GOOGLE_PLACES_API_KEY
  same(JSON.stringify(proof.trustpilot), '{"rating":4.3,"reviewCount":7}', 'Trustpilot')
  ok(proof.bbb === true, 'the accreditation was not held')
  same(asked.google, 0, 'times Google was asked')
  ok(!('google' in proof), 'the reading still carries a Google part')
})

check('a Trustpilot refusal is no reading, not the committed floor', async () => {
  for (const trustpilot of [403, new Error('unreachable'), { businessUnit: {} }]) {
    const { proof } = await read({ trustpilot })
    same(proof.trustpilot, null, `Trustpilot answering ${trustpilot}`)
  }
})

check('a run takes one reading an hour, and a failed one for five minutes', async () => {
  const whole = networks({ trustpilot: trustbox(7) })
  globalThis.fetch = whole.fetcher
  const start = NOW + 10 * 24 * HOUR_MS
  await proofNow({ now: start })
  await proofNow({ now: start + HOUR_MS - 1 })
  same(whole.asked.trustpilot, 1, 'Trustpilot reads inside the hour')
  await proofNow({ now: start + HOUR_MS })
  same(whole.asked.trustpilot, 2, 'Trustpilot reads once the hour is up')

  const failed = networks({ trustpilot: 403 })
  globalThis.fetch = failed.fetcher
  const later = start + 3 * HOUR_MS
  await proofNow({ now: later })
  await proofNow({ now: later + 4 * 60 * 1000 })
  same(failed.asked.trustpilot, 1, 'Trustpilot reads inside five minutes of a refusal')
  await proofNow({ now: later + 5 * 60 * 1000 })
  same(failed.asked.trustpilot, 2, 'Trustpilot reads five minutes after a refusal')
  same(whole.asked.google + failed.asked.google, 0, 'times Google was asked')
  globalThis.fetch = OFFLINE
})

// ── The line ────────────────────────────────────────────────────────────

const LIVE = { trustpilot: { rating: 4.3, reviewCount: 7 }, bbb: true }
const LINE = "P.S. If you want to look me up first, I'm on the BBB and Trustpilot."

check('a live Trustpilot reading and the accreditation make the line', () => {
  const line = proofLine(LIVE, FIRST)
  same(sentence(line), LINE, 'the line')
  same(
    links(line)
      .map(part => part.text)
      .join(' | '),
    'BBB | Trustpilot',
    'the linked phrases'
  )
})

check('the line quotes no rating and no count', () => {
  for (const proof of [LIVE, { ...LIVE, trustpilot: { rating: 5, reviewCount: 1 } }]) {
    ok(!/\d/.test(sentence(proofLine(proof, FIRST))), sentence(proofLine(proof, FIRST)))
  }
})

check('an unread Trustpilot is still named, since the profile is there', () =>
  same(sentence(proofLine({ trustpilot: null, bbb: true }, FIRST)), LINE, 'the line')
)

check('a Trustpilot profile nobody has written on is left out', () =>
  same(
    sentence(proofLine({ trustpilot: { rating: 0, reviewCount: 0 }, bbb: true }, FIRST)),
    "P.S. If you want to look me up first, I'm on the BBB.",
    'BBB alone'
  )
)

check(
  'without the accreditation Trustpilot stands alone, and with nothing there is no line',
  () => {
    const alone = "P.S. If you want to look me up first, I'm on Trustpilot."
    same(sentence(proofLine({ ...LIVE, bbb: false }, FIRST)), alone, 'Trustpilot alone')
    same(sentence(proofLine({ trustpilot: null, bbb: false }, FIRST)), alone, 'an unread one alone')
    same(
      proofLine({ trustpilot: { rating: 0, reviewCount: 0 }, bbb: false }, FIRST),
      null,
      'nothing to say'
    )
    same(proofLine(null, FIRST), null, 'no reading at all')
  }
)

check('a follow-up carries no postscript', () => {
  for (let nth = 0; nth < PREVIEW_FIRST_DAYS.length; nth += 1) {
    const campaign = previewCampaign(nth, PREVIEW_FIRST_DAYS)
    same(proofLine(LIVE, { campaign, nth }), null, `follow-up ${nth + 1}`)
  }
})

check('every link is the profile itself, tagged with the letter it came out of', () => {
  const hrefs = links(proofLine(LIVE, FIRST)).map(part => part.href)
  same(hrefs[0], taggedProfile(BBB_PROFILE_URL, 'preview-first'), 'the BBB link')
  same(hrefs[1], taggedProfile(TRUSTPILOT_PROFILE_URL, 'preview-first'), 'the Trustpilot link')
  for (const href of hrefs) {
    const url = new URL(href)
    same(url.searchParams.get('utm_source'), 'preview', `utm_source on ${href}`)
    same(url.searchParams.get('utm_medium'), 'outreach', `utm_medium on ${href}`)
    same(url.searchParams.get('utm_campaign'), 'preview-first', `utm_campaign on ${href}`)
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
  { trustpilot: null, bbb: true },
  { trustpilot: { rating: 0, reviewCount: 0 }, bbb: true },
  { ...LIVE, bbb: false },
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

check(
  'only the first letter carries the postscript, once in each half, under the signature',
  () => {
    const faults = []
    for (const proof of READINGS) {
      for (const one of letters(proof)) {
        const { text, html } = one.letter
        const owed = one.campaign === 'preview-first' ? 1 : 0
        if (count(text, /P\.S\./g) !== owed)
          faults.push(`${one.name}: P.S. ${count(text, /P\.S\./g)} times in the text`)
        if (count(html, /P\.S\./g) !== owed)
          faults.push(`${one.name}: P.S. ${count(html, /P\.S\./g)} times in the html`)
        if (!owed) continue
        if (html.indexOf('P.S.') < html.indexOf('/images/email/signature.png')) {
          faults.push(`${one.name}: the postscript sits above the signature`)
        }
        if (text.indexOf('P.S.') < text.indexOf('Trenton Taylor | Owner')) {
          faults.push(`${one.name}: the text postscript sits above the signature`)
        }
      }
    }
    report(faults)
  }
)

check('the postscript adds at most two links and nothing else to a letter', () => {
  const faults = []
  for (const proof of READINGS) {
    letters(proof).forEach((one, index) => {
      const bare = BARE[index].letter.html
      const { html } = one.letter
      const added = count(html, /<a\s/g) - count(bare, /<a\s/g)
      const [least, most] = one.campaign === 'preview-first' ? [1, 2] : [0, 0]
      if (added < least || added > most) faults.push(`${one.name}: ${added} links added`)
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
  const one = letters(LIVE)[0]
  for (const part of links(proofLine(LIVE, FIRST))) {
    if (!one.letter.text.includes(part.href))
      faults.push(`${one.name}: the text half lacks ${part.href}`)
    const escaped = part.href.replaceAll('&', '&amp;')
    if (!one.letter.html.includes(`href="${escaped}"`)) {
      faults.push(`${one.name}: the html half lacks ${part.href}`)
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
  for (const proof of [...READINGS, { trustpilot: null, bbb: false }]) {
    const line = proofLine(proof, FIRST)
    if (!line) continue
    const words = postscriptText(line)
    if (/[‒-―−]|\s-\s|--/.test(words)) faults.push(`a dash in: ${words}`)
    if (/\p{Extended_Pictographic}/u.test(words)) faults.push(`an emoji in: ${words}`)
    if (words.includes('!')) faults.push(`an exclamation mark in: ${words}`)
  }
  report(faults)
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
