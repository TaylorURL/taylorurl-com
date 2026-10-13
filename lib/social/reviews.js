/**
 * Review cards: a client's own words from the Google listing, drawn once each.
 *
 * Once a day the Pi reads the studio's listing through the Places API (New), and
 * a review of four or five stars that has never been drawn becomes a card - the
 * reviewer's words, trimmed at a sentence to fit, and the stars they gave -
 * queued on the Page, Instagram and the Business Profile. Everything that
 * decides what the card says is here and touches no network but the one read of
 * the listing, so the decisions can be checked against a fixture.
 *
 * THE LISTING. `PLACE_ID` was found with a Text Search for "TaylorURL" and
 * confirmed against https://g.page/r/CTlYcg1CXgG7EAI, the review link the
 * profile hands out: that link decodes to, and redirects to, the listing whose
 * customer id is `PLACE_CID`, and the Place Details answer for `PLACE_ID` names
 * the same one in its Maps link. The listing is a service-area business with no
 * public address, which is why a search finds it only with
 * `includePureServiceAreaBusinesses` set. Every read checks the customer id
 * again, so a place id Google reassigns is a run that stops rather than a run
 * that cards somebody else's reviews.
 *
 * WHAT IS NEVER CARDED. A review under four stars. A review written by somebody
 * who works here: the team is read from the database (`profiles` with a staff
 * or admin role) rather than named in this file, and a review predating its
 * author joining is barred the same, because Google's rules on conflicts of
 * interest are about who wrote it, not when. A review whose words cannot pass
 * the sheet's guards once trimmed, because the card would have to put words in
 * the reviewer's mouth to exist.
 *
 * WHAT THE CARD NAMES. Never the reviewer. Their trade and their town, only
 * where the review itself says so in a way that is unmistakably about the
 * reviewer - "our roofing company in Crosby", "as a barber in Liberty" - and
 * otherwise "a client". A town mentioned any other way is more often the
 * studio's than the reviewer's ("a great web designer in Baytown"), so the
 * patterns below are deliberately narrow: a description left off costs the card
 * nothing, and a wrong one puts a claim in a client's mouth.
 */
import { formatInstant } from '../time/zone.js'
import { CALL } from './generated.js'

/** The studio's listing, as the Places API names it. */
export const PLACE_ID = 'ChIJsVuuSjvcFWEROVhyDUJeAbs'

/** The listing's customer id, which the profile's review link resolves to. */
export const PLACE_CID = '13475155197855684665'

const DETAILS = `https://places.googleapis.com/v1/places/${PLACE_ID}`

/** Place Details carries up to five reviews; this is the whole of what is asked for. */
const FIELDS = 'id,googleMapsUri,rating,userRatingCount,reviews'

/** The lowest rating a card is drawn for. */
export const MIN_STARS = 4

/** The longest a quote may run, in characters, before the fit is even tried. */
export const QUOTE_MAX = 300

/** The fewest words a quote may carry and still say something. */
const QUOTE_MIN_WORDS = 4

const NUMBERS = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' }
export const starsInWords = stars => NUMBERS[stars] ?? String(stars)
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * The listing as Place Details answers it, in the shape the rest of this reads.
 *
 * Refused outright when the place answering is not the one the profile names,
 * when the request fails, or when the answer is not JSON: a review run that
 * cannot read the listing has learned nothing, and saying "no new reviews" over
 * that would be the quiet failure the routine exists to avoid.
 *
 * @param {string} key A Places API key.
 * @param {{get?: typeof fetch}} [options]
 * @returns {Promise<{rating: number|null, count: number, reviews: object[]}>}
 */
export async function readListing(key, { get = fetch } = {}) {
  if (!key) throw new Error('no Places API key was supplied')
  const response = await get(DETAILS, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
    signal: AbortSignal.timeout(20_000),
  })
  let body
  try {
    body = await response.json()
  } catch {
    throw new Error(`the Places API answered ${response.status} with no JSON`)
  }
  if (!response.ok) {
    throw new Error(
      `the Places API answered ${response.status}: ${body?.error?.message ?? 'no reason given'}`
    )
  }
  const cid = /[?&]cid=(\d+)/.exec(body.googleMapsUri ?? '')?.[1] ?? null
  if (body.id !== PLACE_ID || cid !== PLACE_CID) {
    throw new Error(
      `the Places API answered for ${body.id ?? 'no place'} (cid ${cid ?? 'none'}), ` +
        `not the listing the profile names (cid ${PLACE_CID})`
    )
  }
  return {
    rating: body.rating ?? null,
    count: body.userRatingCount ?? 0,
    reviews: (body.reviews ?? []).map(review => ({
      name: review.name,
      id: String(review.name ?? '')
        .split('/')
        .pop(),
      stars: review.rating ?? 0,
      text: review.originalText?.text ?? review.text?.text ?? '',
      language: review.originalText?.languageCode ?? review.text?.languageCode ?? null,
      author: review.authorAttribution?.displayName ?? '',
      publishedAt: review.publishTime ?? null,
    })),
  }
}

/**
 * Whether the listing was read but its reviews came back without their words.
 *
 * Place Details answers a listing's rating and rating count whatever it does
 * with the reviews behind them, and for some keys it leaves `reviews` empty on
 * every place asked about, however many reviews the place holds. That is a
 * limit on what the API hands the key, not a fault in the run, and nobody on
 * this end can make it return the words. So it ends the run quietly rather than
 * asking a person to look, and the read stays daily: the first morning the
 * reviews come back with their words, the card is drawn as any other would be.
 *
 * It is a different thing from a failed read. A refused key, a network that is
 * down and a place id answering as another listing all throw in `readListing`,
 * and stay loud.
 *
 * @param {{count: number, reviews: object[]}} listing What `readListing` answered.
 * @returns {boolean}
 */
export const textUnavailable = listing => listing.count > 0 && !listing.reviews.length

/** A name as the comparison reads it: lowercase words, letters only. */
const words = name =>
  String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z]+/)
    .filter(Boolean)

/**
 * Whether a reviewer is somebody on the team.
 *
 * A Google display name and a profile name are rarely written the same way - a
 * profile carries a middle name and a second surname that the review does not -
 * so the two are compared by their words rather than as strings. A reviewer
 * whose first and last words are both in a team name is the team. A one-word
 * name on either side is matched on that word, which errs toward leaving a
 * stranger's review uncarded rather than publishing a colleague's as a client's.
 *
 * @param {string} author The reviewer's display name.
 * @param {string[]} team Every team member's full name.
 */
export function isTeam(author, team) {
  const them = words(author)
  if (!them.length) return false
  return team.some(name => {
    const ours = words(name)
    if (!ours.length) return false
    if (ours.length === 1) return them[0] === ours[0]
    if (them.length === 1) return ours.includes(them[0])
    return ours.includes(them[0]) && ours.includes(them.at(-1))
  })
}

/**
 * A review's text, split into sentences with the punctuation kept on each.
 *
 * Unlike `voice.sentences`, a closing fragment with no stop is kept: reviews are
 * typed on phones and often end without one, and dropping it would drop words
 * the reviewer wrote.
 */
export function splitSentences(text) {
  return (String(text ?? '').match(/[^.!?]+(?:[.!?]+["'”’)]*|$)/g) ?? [])
    .map(sentence => sentence.trim())
    .filter(Boolean)
}

/**
 * The text as the card sets it: the reviewer's words with what is not words
 * taken out.
 *
 * Emoji come off rather than refusing the sentence they sit in, and an em dash
 * is set as a spaced en dash, which is how the sheet sets one. Nothing else is
 * changed: no word is corrected and none is added.
 */
export function cleaned(text) {
  return String(text ?? '')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s*—\s*/g, ' – ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A sentence carrying a way to reach somebody, which is not ours to publish. */
const CONTACT =
  /https?:\/\/|www\.|[\w.-]+@[\w-]+\.|\b[\w-]+\.(?:com|net|org|co|us|biz|info|website|app)\b|\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/i

/**
 * The quotes a review can give, best first.
 *
 * A sentence is usable when it passes the sheet's guards (`passes`), names
 * nothing of the reviewer's own, and carries no address or number. The quote is
 * the first run of usable sentences in the order the reviewer wrote them,
 * trimmed at a sentence boundary: the whole run first, then one sentence fewer,
 * down to the first sentence alone. Several are offered because only the
 * renderer knows what fits the card, and it takes the longest that does.
 *
 * Sentences are never stitched together across one that was left out. A quote
 * is the reviewer's words in their order, and joining two sentences that were
 * not side by side would say something they did not.
 *
 * @param {string} text The review.
 * @param {object} options
 * @param {(sentence: string) => boolean} options.passes The sheet's guards.
 * @param {string} [options.author] The reviewer's name, kept off the card.
 * @returns {string[]} Candidate quotes, longest first, each within `QUOTE_MAX`.
 */
export function quoteOptions(text, { passes, author = '' }) {
  const own = words(author).filter(word => word.length > 2)
  const usable = sentence =>
    passes(sentence) && !CONTACT.test(sentence) && !own.some(word => words(sentence).includes(word))

  const sentences = splitSentences(cleaned(text))
  for (let start = 0; start < sentences.length; start += 1) {
    if (!usable(sentences[start])) continue
    let end = start
    while (end + 1 < sentences.length && usable(sentences[end + 1])) end += 1

    const options = []
    for (let last = end; last >= start; last -= 1) {
      const quote = sentences.slice(start, last + 1).join(' ')
      if (quote.length <= QUOTE_MAX && words(quote).length >= QUOTE_MIN_WORDS) options.push(quote)
    }
    if (options.length) return options
    start = end
  }
  return []
}

/**
 * The trades a review can name its writer as, with the noun the card uses.
 *
 * Keyed by the trade ids in `src/app/data/towns-and-trades/trades.js`, so a
 * card's description and the site's own trade pages speak about the same
 * trades. The words are the ones an owner would write about their own
 * business, matched whole.
 */
export const TRADE_WORDS = [
  { id: 'barber-shop', words: 'barber ?shop|barbershop|barber', noun: 'a barber shop' },
  { id: 'hair-salon', words: 'hair salon|salon|stylist', noun: 'a hair salon' },
  { id: 'restaurant', words: 'restaurant|cafe|diner|food truck', noun: 'a restaurant' },
  { id: 'plumbing', words: 'plumbing|plumber', noun: 'a plumbing company' },
  { id: 'hvac', words: 'hvac|air conditioning|heating and air', noun: 'an HVAC company' },
  { id: 'electrical', words: 'electrical|electrician', noun: 'an electrical contractor' },
  { id: 'roofing', words: 'roofing|roofer', noun: 'a roofing company' },
  { id: 'fencing', words: 'fencing|fence', noun: 'a fence company' },
  { id: 'concrete', words: 'concrete', noun: 'a concrete contractor' },
  { id: 'landscaping', words: 'landscaping|landscaper|lawn care', noun: 'a landscaping company' },
  { id: 'pest-control', words: 'pest control|exterminator', noun: 'a pest control company' },
  {
    id: 'auto-repair',
    words: 'auto repair|auto shop|mechanic|body shop',
    noun: 'an auto repair shop',
  },
  { id: 'towing', words: 'towing|tow truck|wrecker', noun: 'a towing company' },
  { id: 'dentist', words: 'dental|dentist', noun: 'a dental practice' },
  { id: 'chiropractor', words: 'chiropractic|chiropractor', noun: 'a chiropractic office' },
  { id: 'law-firm', words: 'law firm|law office|attorney|lawyer', noun: 'a law firm' },
  {
    id: 'accounting',
    words: 'accounting|accountant|bookkeeping|bookkeeper|cpa',
    noun: 'an accounting firm',
  },
  {
    id: 'fitness',
    words: 'gym|fitness|personal trainer|personal training',
    noun: 'a fitness business',
  },
  {
    id: 'real-estate',
    words: 'real estate|realtor|realty|brokerage',
    noun: 'a real estate business',
  },
  { id: 'storage', words: 'self[- ]storage|storage facility', noun: 'a storage facility' },
  { id: 'printing', words: 'print shop|printing', noun: 'a print shop' },
  {
    id: 'marine-services',
    words: 'marine|towboat|barge|fleeting',
    noun: 'a marine services company',
  },
]

/** What an owner calls the business itself, standing after the trade or instead of it. */
const BUSINESS =
  'business|shop|company|firm|practice|office|salon|restaurant|store|studio|gym|clinic|agency|owner'

/** Who is speaking about their own business. */
const OWNER = String.raw`(?:my|our|we are|we're|i am|i'm|as|i own|we own|i run|we run|i operate|we operate)`

/**
 * Up to three words between the owner and the business: "our *small family*
 * roofing company". A word carrying a possessive cannot stand here, and nor can
 * a relation, because "my brother's shop" and "my friend's salon" are somebody
 * else's business and the card would be describing the wrong person.
 */
const BETWEEN = String.raw`(?:(?!(?:friend|brother|sister|mom|mother|dad|father|wife|husband|son|daughter|cousin|uncle|aunt|boss|neighbou?r|partner|client|customer)s?\b)[\w-]+\s+){0,3}?`

const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The reviewer's trade and town, where the review says them about the reviewer.
 *
 * A trade is read from an owner speaking of it as theirs: "my roofing company",
 * "as a realtor", "we run a small plumbing business". A town is read only where
 * it follows the business it belongs to - "our shop in Liberty", "as a barber in
 * Crosby" - and only from the towns named in `towns`, which is the service area
 * the site already publishes plus its neighbours. "Best web designer in Baytown"
 * names nobody's town but the studio's, and is read as nothing.
 *
 * @param {string} text The review.
 * @param {{towns: string[]}} options
 * @returns {{trade: object|null, town: string|null, subject: string}}
 */
export function describe(text, { towns }) {
  const passage = cleaned(text).replace(/[‘’]/g, "'")
  let trade = null
  for (const candidate of TRADE_WORDS) {
    const said = new RegExp(
      String.raw`\b${OWNER}\s+(?:an?\s+)?${BETWEEN}(?:${candidate.words})\b`,
      'i'
    )
    if (said.test(passage)) {
      trade = candidate
      break
    }
  }

  let town = null
  const nouns = [BUSINESS, ...TRADE_WORDS.map(candidate => candidate.words)].join('|')
  for (const name of towns) {
    const said = new RegExp(
      String.raw`\b${OWNER}\s+(?:an?\s+)?${BETWEEN}(?:${nouns})(?:\s+(?:here|based|located|right here))?\s+(?:in|out of|from)\s+${escapeRe(name)}\b`,
      'i'
    )
    if (said.test(passage)) {
      town = name
      break
    }
  }

  const who = trade?.noun ?? 'a client'
  return { trade, town, subject: town ? `${who} in ${town}` : who }
}

/**
 * Which review to draw today, and why each of the others is not drawn.
 *
 * Oldest first, so the cards go out in the order the reviews were written, and
 * one a run: a morning that finds three new reviews draws one and leaves two for
 * the mornings after, so three days on the Page are not the same card three
 * times over. A review already drawn is passed over; one a run left half done -
 * drawn and stored but not on every channel - is the one taken first, so it is
 * finished before anything new is started.
 *
 * @param {object} options
 * @param {object[]} options.reviews From `readListing`.
 * @param {string[]} options.team Every team member's full name.
 * @param {Map<string, object>} options.recorded Rows already written, by review id.
 * @param {(sentence: string) => boolean} options.passes The sheet's guards.
 * @param {string[]} options.towns The towns a review may name.
 * @returns {{card: object|null, skipped: object[], done: string[]}}
 */
export function choose({ reviews, team, recorded, passes, towns }) {
  const skipped = []
  const done = []
  const ready = []
  const ordered = [...reviews].sort((a, b) =>
    String(a.publishedAt ?? '').localeCompare(String(b.publishedAt ?? ''))
  )

  for (const review of ordered) {
    const row = recorded.get(review.id)
    if (row?.state === 'queued') {
      done.push(review.id)
      continue
    }
    const skip = reason => skipped.push({ id: review.id, stars: review.stars, reason })
    if (review.stars < MIN_STARS) {
      skip('rating')
      continue
    }
    if (isTeam(review.author, team)) {
      skip('team')
      continue
    }
    if (!review.text.trim()) {
      skip('no-words')
      continue
    }
    if (review.language && !/^en\b/i.test(review.language)) {
      skip('language')
      continue
    }
    const quotes = quoteOptions(review.text, { passes, author: review.author })
    if (!quotes.length) {
      skip('no-quotable-words')
      continue
    }
    // The description is held to the same guards as the quote. A town that
    // shares its name with a client's business is one the card cannot print,
    // so it comes off first, then the trade, down to "a client".
    const said = describe(review.text, { towns })
    const subject =
      [said.subject, said.trade?.noun, 'a client'].find(
        candidate => candidate && passes(capital(candidate))
      ) ?? 'a client'
    ready.push({ review, quotes, subject, resume: row?.state === 'drawn' })
  }

  const card = ready.find(entry => entry.resume) ?? ready[0] ?? null
  return { card, skipped, done }
}

/** Where a review's card is stored in the bucket. */
export const reviewPath = review => `reviews/${review.id.replace(/[^A-Za-z0-9_-]/g, '')}.png`

/**
 * What the card shows, as the `review` template takes it.
 *
 * @param {{stars: number, quote: string, subject: string, publishedAt: string|null}} card
 */
export function reviewCardItem({ stars, quote, subject, publishedAt }) {
  const when = formatInstant(publishedAt, { month: 'long', year: 'numeric' }, '')
  return {
    eyebrow: `${capital(starsInWords(stars))} Stars on Google`,
    counter: 'In Their Words',
    stars,
    quote,
    attribution: capital(subject),
    source: when ? `Left on our Google listing, ${when}` : 'Left on our Google listing',
  }
}

/** What a reader who cannot see the card is given: all of it, in reading order. */
export function reviewAlt({ stars, quote, subject }) {
  const stop = /[.!?]["'”’)]*$/.test(quote) ? '' : '.'
  return `${capital(starsInWords(stars))} stars out of five on Google. "${quote}${stop}" ${capital(subject)}.`
}

/**
 * Each channel's post for a review card.
 *
 * Two sentences and a next step. The first says what the card is, and the
 * second says what an owner reading it gets: the same small team the reviewer
 * worked with. Neither repeats the quote, which is on the card in the reviewer's
 * own words and reads better there than paraphrased under it. The Page and
 * Instagram end on the number; the Business Profile leaves the asking to its
 * Learn more button, and Google refuses a number in the post anyway.
 *
 * @param {{stars: number, subject: string}} card
 * @returns {Record<string, string>}
 */
export function reviewTexts({ stars, subject }) {
  const said = `${capital(subject)} gave us ${starsInWords(stars)} stars on Google, in their own words on the card.`
  const gets =
    'Your business gets the same small team they worked with, from the first call to launch day and after.'
  return {
    facebook: `${said}\n${gets}\n\n${CALL}`,
    instagram: `${said}\n${gets}\n\n${CALL}`,
    googlebusiness: `${capital(subject)} gave TaylorURL ${starsInWords(stars)} stars on Google, in their own words on the card.\nYour business gets the same small team in Baytown they worked with, from the first call to launch day and after.`,
  }
}
