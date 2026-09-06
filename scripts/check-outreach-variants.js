/**
 * Holds the variant registry to the shape the sender and the console both
 * read it in.
 *
 * Nothing about a bad registry throws at import. An id given to two variants
 * files two messages as one; a variant written for a segment no row can be in
 * is a message nobody gets; a template naming a column the candidate read does
 * not carry meets an undefined where its figure should be; a segment whose
 * every variant is paused is a queue that quietly empties; and an opener whose
 * figure is missing a field breaks the sheet for whoever opens it. Each of
 * those is silent until a message has gone, which is what earns them a check.
 *
 * The openers are also driven through the real composer against a business of
 * each shape, so what the registry says a business gets is what `compose`
 * actually writes, and both halves of every message still carry the way off
 * the list and the way in.
 *
 *   npm run check:outreach-variants
 */
import { BIO_NAME } from '../lib/mail/bio.js'
import { SEGMENTS, segmentOf } from '../lib/outreach/segments.js'
import {
  HOLDOUTS,
  VARIANTS,
  VARIANT_STATUSES,
  fits,
  holdoutId,
  isHoldoutId,
  siteOpener,
  speedOpener,
  sendsAt,
  stepOf,
  stepRegistered,
  variantById,
} from '../lib/outreach/variants.js'
import { CANDIDATE_COLUMNS } from '../lib/outreach/queue.js'

const { compose, unsubscribeUrl } = await import('../api/outreach/send.js')

const cases = []
const check = (name, run) => cases.push([name, run])

const same = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: got ${got}, wanted ${want}`)
}

const ok = (condition, what) => {
  if (!condition) throw new Error(what)
}

const UNSUB = '11111111-1111-4111-8111-111111111111'
const TRACK = '5f3a1c9e-2b44-4a0d-9f11-8c2b7de6a301'
const SHOT = 'https://shots.example.com/harbourplumbing.png'
const WHERE = 'in Baytown and the surrounding area'

/** What every candidate carries, whichever segment it is in. */
const BASE = {
  id: 'p1',
  name: 'Baytown Plumbing',
  town: 'Baytown',
  trade: 'plumber',
  email: 'owner@example.com',
  unsub_token: UNSUB,
}

/** A business of each shape the registry writes to, as the candidate read hands it over. */
const FITTING = {
  'no-site': {
    ...BASE,
    website: 'https://www.facebook.com/harbourplumbing',
    site_kind: 'social',
    audit_score: null,
  },
  'slow-site': {
    ...BASE,
    website: 'https://harbourplumbing.com',
    site_kind: 'own',
    audit_score: 31,
    accessibility_score: 88,
    best_practices_score: 96,
    seo_score: 78,
  },
  'fair-site': {
    ...BASE,
    website: 'https://harbourplumbing.com',
    site_kind: 'own',
    audit_score: 67,
    accessibility_score: 100,
    best_practices_score: 100,
    seo_score: 84,
  },
  'sound-site': {
    ...BASE,
    website: 'https://harbourplumbing.com',
    site_kind: 'own',
    audit_score: 96,
    accessibility_score: 100,
    best_practices_score: 100,
    seo_score: 100,
  },
  // A business with a site of its own that nothing has managed to measure.
  // Its letter is the same letter, since the letter says nothing that would
  // need a reading behind it.
  unmeasured: {
    ...BASE,
    website: 'https://harbourplumbing.com',
    site_kind: 'own',
    audit_score: null,
    accessibility_score: null,
    best_practices_score: null,
    seo_score: null,
  },
}

/**
 * A business each letter is written for. The segment's own fixture where the
 * letter takes it, and otherwise that fixture with the one figure a condition
 * turns on moved under the band, which is the only condition there is.
 */
function suited(entry) {
  const base = FITTING[entry.segment]
  return fits(entry, base) ? base : { ...base, seo_score: 60 }
}

/** The segments the registry writes for, which is every one there is. */
const SENDING = SEGMENTS

/** What a letter after the first is handed: the letter before it, and the work the message shows. */
const CONTEXT = {
  prior: { subject: 'Baytown Plumbing scores 31 out of 100 on mobile' },
  work: [
    {
      name: 'Riverbend Karting',
      place: 'Baytown, Texas',
      url: 'https://baytowngokarts.com',
      review: { quote: 'Very professional and on time.', name: 'Bryan Venegas' },
    },
  ],
}

/** The columns a candidate arrives with, as the queue names them. */
const COLUMNS = CANDIDATE_COLUMNS.split(',').map(column => column.trim())

const BANDS = ['poor', 'fair', 'good', 'plain']

// ── The registry's own shape ─────────────────────────────────────────────

check('every id is one word in kebab case, and none is used twice', () => {
  const ids = VARIANTS.map(entry => entry.id)
  same(new Set(ids).size, ids.length, 'distinct ids')
  for (const id of ids) ok(/^[a-z][a-z0-9-]*[a-z0-9]$/.test(id), `an id that is not a slug: ${id}`)
})

check('every variant is filed under a segment a row can be in', () => {
  for (const entry of VARIANTS) {
    ok(SEGMENTS.includes(entry.segment), `${entry.id} is filed under ${entry.segment}`)
  }
})

check('every variant carries a name, a status the console knows and a weight', () => {
  for (const entry of VARIANTS) {
    ok(typeof entry.name === 'string' && entry.name.trim(), `${entry.id} has no name`)
    ok(
      typeof entry.about === 'string' && /^[A-Z].*\.$/.test(entry.about.trim()),
      `${entry.id} does not say in a sentence what it opens on`
    )
    ok(VARIANT_STATUSES.includes(entry.status), `${entry.id} is ${entry.status}`)
    ok(Number.isFinite(entry.weight) && entry.weight >= 0, `${entry.id} weighs ${entry.weight}`)
    ok(Array.isArray(entry.needs), `${entry.id} needs is not a list`)
    ok(typeof entry.open === 'function', `${entry.id} cannot be opened`)
  }
})

check('every segment has a live letter, the unmeasured among them', () => {
  const live = new Set(
    VARIANTS.filter(entry => entry.status === 'live').map(entry => entry.segment)
  )
  const covered = new Set(VARIANTS.map(entry => entry.segment))
  for (const segment of covered) ok(live.has(segment), `every variant for ${segment} is paused`)
  // The unmeasured used to have no letter, because every letter opened on a
  // reading and there was none to open on. The introduction makes no claim
  // about the reader's site, so a business nothing has measured is written to
  // like any other.
  for (const segment of SEGMENTS) ok(covered.has(segment), `no variant is written for ${segment}`)
})

check('nothing a variant needs is missing from what a candidate carries', () => {
  for (const entry of VARIANTS) {
    for (const column of entry.needs) {
      ok(
        COLUMNS.includes(column),
        `${entry.id} needs ${column}, which the candidate read does not carry`
      )
    }
  }
})

check('a variant that quotes a score says so', () => {
  const quotes = { audit_score: 'audit_score', seo_score: 'seo_score' }
  for (const entry of VARIANTS) {
    const prospect = suited(entry)
    const { figure } = entry.open(prospect, WHERE, SHOT, CONTEXT)
    if (!figure) continue
    for (const column of Object.keys(quotes)) {
      if (figure.value !== String(prospect[column])) continue
      ok(entry.needs.includes(column), `${entry.id} quotes ${column} without needing it`)
    }
  }
})

// A segment used to be held to more than one live first letter, on the reading
// that a registry with one has stopped testing. It is held to one now, because
// the sender deliberately opens every chain on the same introduction: the
// letters differ at step 2, where the finding is, and the thing worth guarding
// was never the count but the floor. A segment with no live first letter is a
// queue that skips its businesses every run and says nothing, which is the
// failure this has always been about.
check('every segment that sends has a first letter to open on', () => {
  for (const segment of SENDING) {
    const live = VARIANTS.filter(
      entry => entry.segment === segment && stepOf(entry) === 1 && entry.status === 'live'
    )
    ok(live.length > 0, `${segment} has no live first letter`)
  }
})

// A chain used to be four different letters and had to have no gap in it and
// an end. There is one letter now and it repeats, so what has to hold instead
// is that it stands at every step: a business is owed the same introduction
// next month and the month after, and a step it did not stand at would be the
// month the sender quietly stopped writing.
check('the letter that sends stands at every step, so a chain never runs out', () => {
  for (const segment of SENDING) {
    for (const step of [1, 2, 3, 12, 60]) {
      ok(stepRegistered(VARIANTS, segment, step), `${segment} has nothing at step ${step}`)
      const live = VARIANTS.filter(
        entry => entry.segment === segment && entry.status === 'live' && sendsAt(entry, step)
      )
      same(live.length, 1, `${segment} letters live at step ${step}`)
    }
  }
})

check('a step is a whole number from one, and a holdout stands at the first', () => {
  for (const entry of VARIANTS) {
    ok(
      Number.isInteger(stepOf(entry)) && stepOf(entry) >= 1,
      `${entry.id} is at step ${entry.step}`
    )
  }
  for (const entry of HOLDOUTS) same(stepOf(entry), 1, `${entry.id} step`)
})

check('a letter with a test on the row says the same thing in words', () => {
  for (const entry of VARIANTS) {
    const tested = typeof entry.when === 'function'
    same(typeof entry.condition === 'string', tested, `${entry.id} condition and test disagree`)
    if (tested) ok(entry.condition.trim(), `${entry.id} has an empty condition`)
  }
})

check('a letter with a test is written for the businesses that pass it and no other', () => {
  const short = { ...FITTING['fair-site'], seo_score: 60 }
  const clean = { ...FITTING['fair-site'], seo_score: 100 }
  const search = variantById('fair-site-search')
  ok(search && typeof search.when === 'function', 'the search reading has no test')
  same(fits(search, short), true, 'a site short on SEO')
  same(fits(search, clean), false, 'a site sound on SEO')
  same(fits(search, { ...short, seo_score: null }), false, 'a site with no SEO reading')
  same(fits(variantById('fair-site-audit'), clean), true, 'the speed reading on the same site')
})

check('a letter is written for its own segment and no other', () => {
  for (const entry of VARIANTS) {
    for (const segment of SENDING) {
      if (segment === entry.segment) continue
      same(fits(entry, FITTING[segment]), false, `${entry.id} fits a ${segment} business`)
    }
  }
})

check('the registry cannot be changed once loaded', () => {
  ok(Object.isFrozen(VARIANTS), 'the list can be added to')
  for (const entry of VARIANTS) {
    ok(Object.isFrozen(entry), `${entry.id} can be edited`)
    ok(Object.isFrozen(entry.needs), `${entry.id} needs can be added to`)
  }
})

check('a variant is found by its id and an unknown id finds nothing', () => {
  for (const entry of VARIANTS) same(variantById(entry.id), entry, `looking up ${entry.id}`)
  same(variantById('nothing-of-the-kind'), null, 'an unknown id')
  same(variantById(undefined), null, 'no id')
})

check('the two openers the sender has always used are the ones registered', () => {
  const listing = variantById('no-site-listing')
  const speed = variantById('slow-site-audit')
  ok(listing && speed, 'the two original variants are not both registered')
  same(
    JSON.stringify(listing.open(FITTING['no-site'], WHERE)),
    JSON.stringify(siteOpener(FITTING['no-site'], WHERE)),
    'the listing opener'
  )
  same(speed.open, speedOpener, 'the speed opener')
})

// ── The holdouts ─────────────────────────────────────────────────────────

check('there is one holdout for every segment a variant is written for, and no other', () => {
  const covered = [...new Set(VARIANTS.map(entry => entry.segment))]
  same(HOLDOUTS.length, covered.length, 'holdouts')
  for (const segment of covered) {
    const held = HOLDOUTS.filter(entry => entry.segment === segment)
    same(held.length, 1, `holdouts for ${segment}`)
    same(held[0].id, holdoutId(segment), `the id of the ${segment} holdout`)
  }
})

check('a holdout ships weighing nothing, paused, with nothing to open and nothing it needs', () => {
  for (const entry of HOLDOUTS) {
    // Nothing is held out any more, and a holdout that could be brought live
    // in the console would be a switch that reads as withholding letters and
    // does nothing at all. It weighs nought and is paused, and both the picker
    // and the console's own write refuse to move it.
    same(entry.weight, 0, `${entry.id} weighs`)
    same(entry.status, 'paused', `${entry.id} is`)
    same(entry.open, null, `${entry.id} opens with`)
    same(entry.holdout, true, `${entry.id} says it is a holdout`)
    same(entry.needs.length, 0, `${entry.id} needs`)
    same(entry.name, 'Holdout', `${entry.id} is called`)
    ok(Object.isFrozen(entry), `${entry.id} can be edited`)
  }
  ok(Object.isFrozen(HOLDOUTS), 'the holdouts can be edited')
})

check('a holdout id is told from a variant id by its suffix alone', () => {
  for (const entry of HOLDOUTS) ok(isHoldoutId(entry.id), `${entry.id} is not read as a holdout`)
  for (const entry of VARIANTS) ok(!isHoldoutId(entry.id), `${entry.id} is read as a holdout`)
  ok(!isHoldoutId(null) && !isHoldoutId(undefined) && !isHoldoutId(''), 'nothing is read as one')
  ok(isHoldoutId('retired-holdout'), 'a holdout the registry has forgotten is not read as one')
})

// ── What each opener answers with ────────────────────────────────────────

const words = value => typeof value === 'string' && value.trim().length > 0

for (const entry of VARIANTS) {
  check(`${entry.id} opens on the six fields the renderers read`, () => {
    const prospect = suited(entry)
    ok(prospect, `no fitting business for ${entry.segment}`)
    same(segmentOf(prospect), entry.segment, 'the fitting business reads as its own segment')
    ok(fits(entry, prospect), 'the fitting business is not one the letter is written for')
    for (const column of entry.needs) {
      ok(
        prospect[column] !== null && prospect[column] !== undefined,
        `the fitting business lacks ${column}`
      )
    }

    const opened = entry.open(prospect, WHERE, SHOT, CONTEXT)
    ok(words(opened.subject), 'no subject')
    ok(!/undefined|null/.test(opened.subject), `the subject reads: ${opened.subject}`)

    // A plain letter is paragraphs and nothing else: no marker, no figure, no
    // closing line, because none of those are drawn for it. What it owes is
    // that every paragraph says something, and that the subject reads like one
    // a person typed rather than one a campaign generated.
    if (entry.plain) {
      // `plain` says how the letter is rendered; `family` says which chain it
      // belongs to. Two families render bare, so the rule is that no letter in
      // the designed family ever does.
      ok(entry.family !== 'designed', 'a designed letter renders bare')
      ok(
        Array.isArray(opened.paragraphs) &&
          opened.paragraphs.length &&
          opened.paragraphs.every(words),
        'the paragraphs'
      )
      ok(opened.marker === undefined, 'a plain letter carries a marker')
      ok(opened.figure === undefined, 'a plain letter carries a figure')
      same(opened.plain, true, 'a plain letter does not say it is plain')
      ok(!/undefined|null|NaN/.test(opened.paragraphs.join(' ')), 'a paragraph reads as a gap')
      // The subject the letter writes for itself, rather than the one it
      // threads under, since a follow-up wears the first letter's subject and
      // that is the first letter's to answer for. Lowercase, no figure in it,
      // and short enough that a phone shows the whole of it: the three things
      // that keep a subject looking like one a colleague sent.
      const own = entry.open(prospect, WHERE, SHOT, { ...CONTEXT, prior: null }).subject
      // Every word lowercase but the proper nouns, which are the ones the row
      // supplied and the studio's own name. A town lowercased reads as the
      // mistake instead, and so does the name on the from line: the rule is
      // that a letter capitalises nothing it made up, not that it never
      // capitalises. Everything a letter writes about itself or about the
      // reader's site is still held to lowercase.
      const supplied = [
        prospect.town ?? '',
        prospect.name ?? '',
        prospect.website ?? '',
        BIO_NAME,
        'TaylorURL',
      ].join(' ')
      for (const word of own.split(/[^A-Za-z]+/).filter(Boolean)) {
        if (word === word.toLowerCase()) continue
        ok(supplied.includes(word), `the subject capitalises a word of its own: ${own}`)
      }
      ok(!/\d/.test(own), `the subject quotes a figure: ${own}`)
      ok(own.length <= 40, `the subject is ${own.length} characters: ${own}`)
      return
    }

    ok(
      words(opened.marker) && opened.marker.startsWith('// '),
      `the marker reads: ${opened.marker}`
    )
    ok(Array.isArray(opened.lines) && opened.lines.length && opened.lines.every(words), 'the lines')
    ok(Array.isArray(opened.after) && opened.after.length && opened.after.every(words), 'the after')
    ok(words(opened.close), 'no closing line')

    const { figure } = opened
    // A follow-up may go without a figure; a first letter always carries one.
    if (stepOf(entry) > 1 && figure === null) return
    ok(figure && typeof figure === 'object', 'no figure')
    for (const field of ['label', 'meta', 'value', 'meaning']) {
      ok(words(figure[field]), `the figure has no ${field}`)
    }
    ok(typeof figure.unit === 'string', 'the figure unit is not a string')
    ok(BANDS.includes(figure.band), `the figure band is ${figure.band}`)
    if (figure.site) {
      ok(
        words(figure.site.url) && words(figure.site.name),
        'the site behind the figure is incomplete'
      )
    }
    if (figure.also) ok(Array.isArray(figure.also), 'the supporting readings are not a list')
    // A letter quoting a score hands over the way to check it, and the check
    // runs on the address the score was read from.
    if (figure.unit === 'out of 100' && figure.site) {
      ok(figure.note && typeof figure.note === 'object', 'a scored reading carries no check')
      ok(
        figure.note.href.startsWith('https://pagespeed.web.dev/analysis?url=') &&
          figure.note.href.includes(encodeURIComponent(figure.site.url)),
        'the check does not run on the address the score was read from'
      )
      same(figure.note.link, 'pagespeed.web.dev', 'the link text')
    }
  })

  check(`${entry.id} opens the same way twice and leaves the row as it found it`, () => {
    const prospect = suited(entry)
    const before = JSON.stringify(prospect)
    const first = JSON.stringify(entry.open(prospect, WHERE, SHOT, CONTEXT))
    const second = JSON.stringify(entry.open(prospect, WHERE, SHOT, CONTEXT))
    same(second, first, 'two openings of one business')
    same(JSON.stringify(prospect), before, 'the row after opening')
  })

  check(
    `${entry.id} is what the composer writes for its business, with both doors in both halves`,
    () => {
      const prospect = suited(entry)
      const shot = entry.segment === 'no-site' ? null : SHOT
      const message = compose(prospect, shot, TRACK, entry, CONTEXT)

      same(message.subject, entry.open(prospect, WHERE, shot, CONTEXT).subject, 'the subject')
      if (stepOf(entry) > 1) {
        ok(message.subject.startsWith('Re: '), `a follow-up does not thread: ${message.subject}`)
      }

      const unsubscribe = unsubscribeUrl(UNSUB)
      ok(
        message.html.includes(`href="${unsubscribe}"`),
        'the laid-out half has no unsubscribe link'
      )
      ok(
        message.text.includes(`Unsubscribe: ${unsubscribe}`),
        'the plain half has no unsubscribe link'
      )

      // A plain letter carries the way off the list and one square that says
      // whether it was opened, and nothing else. No button, no cards, no
      // capture, no bio, and no picture but that square: the whole point of
      // the family is a message that looks like one a person typed, and every
      // one of those would give it away.
      if (entry.plain) {
        same(
          (message.html.match(/<img/g) || []).length,
          1,
          'a plain letter carries a picture besides the open square'
        )
        ok(message.html.includes(`/api/outreach/open?t=${TRACK}`), 'no open square')
        ok(!message.html.includes('/start?'), 'a plain letter carries the button')
        ok(!message.text.includes('/start?'), 'the plain half carries the button')
        ok(!message.html.includes('Trustpilot'), 'a plain letter carries the badge')
        ok(!message.text.includes('LIVE WORK'), 'a plain letter carries the cards')
        ok(!message.html.includes('wordmark'), 'a plain letter carries the masthead')
        return
      }

      for (const half of [message.html, message.text]) {
        ok(half.includes('/start?utm_source=outreach'), 'a half has no way in')
        ok(half.includes(`utm_content=${TRACK}`), 'a half does not carry the message token')
      }
    }
  )
}

// ── Run them ────────────────────────────────────────────────────────────

const failures = []
for (const [name, run] of cases) {
  try {
    await run()
  } catch (cause) {
    failures.push(`${name}: ${cause.message}`)
  }
}

if (failures.length) {
  for (const failure of failures) console.error(failure)
  console.error(`\n${failures.length} of ${cases.length} outreach variant checks failed`)
  process.exit(1)
}

console.log(`outreach variants: ${cases.length} checks passed`)
