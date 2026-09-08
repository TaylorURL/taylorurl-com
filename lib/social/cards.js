/**
 * The images a post can carry, and which one a channel has not used lately.
 *
 * Instagram refuses a post with no media, so a caption alone is not a post
 * there the way it is on the Page. Buffer will not hold a file either: an asset
 * is a URL it fetches when the post is due, so the image has to be somewhere
 * public and stay there. `public/social/` is that place — the site already
 * serves it, the release that ships a card is the same release that ships
 * everything else, and no second host has to be kept alive for the queue.
 *
 * Which is also why a card is named here rather than read off the directory. A
 * file that stopped being served answers 404 to Buffer hours after anybody
 * would notice, and a list in code is a list `check:social-assets` can hold
 * against what is actually in the folder before the branch merges.
 *
 * Every card is 1080 x 1350. Instagram gives a 4:5 image the tallest frame it
 * gives anything in the feed, so a square of the same card would be read at
 * four fifths the size for nothing.
 */
import { SITE } from './buffer.js'

/** Where the cards are served from, which is where Buffer fetches them. */
export const CARD_BASE = `${SITE}/social`

/**
 * The cards, each with the text a reader who cannot see it would be given, and
 * the page the card is about.
 *
 * `alt` is not optional anywhere: Buffer's `ImageMetadataInput.altText` is
 * non-null, so a card without one cannot be posted at all. Written out per card
 * rather than generated from the key, because a card is a page of type and what
 * it says is the whole of what it is.
 *
 * `to` is not optional either, and it is the more expensive of the two to get
 * wrong. Every card used to be posted with the site's front door under it, so a
 * card about the free Google report and a card about the twenty-two trades sent
 * the reader to the same place: a homepage that says none of what the card they
 * tapped had just said. They arrived, found no continuation of the thing that
 * interested them, and left — which is what a 97% bounce off social reads like
 * from the other end. A card names the page that finishes its own sentence.
 *
 * The set is deliberately narrower than the brand folder. Cards naming a client
 * — the site cards, the score dials, the review quotes — publish that client's
 * business to an audience they did not agree to be shown to, so none of them
 * are here and `check:social-assets` refuses one that arrives later.
 */
export const CARDS = [
  {
    key: 'say-be-the-one',
    file: 'say-be-the-one.png',
    to: '/',
    alt: 'Be the one they call. We build the websites that get the click, for shops around Baytown and clients anywhere.',
  },
  {
    key: 'say-phone-first',
    file: 'say-phone-first.png',
    to: '/portfolio',
    alt: 'Most people find you on a phone. If the site fights them there, they leave. Yours is built for that screen first, then opened up for a desktop.',
  },
  {
    key: 'say-check-yourself',
    file: 'say-check-yourself.png',
    to: '/speed-check',
    alt: 'Google grades every site, and the report is free. Four things, graded on every site there is.',
  },
  {
    key: 'say-watched',
    file: 'say-watched.png',
    to: '/console/status',
    alt: 'When something breaks, we know before you call. Every site we look after reports its uptime and its errors to a page anyone can open.',
  },
  {
    key: 'say-one-person',
    file: 'say-one-person.png',
    to: '/about',
    alt: 'You talk to whoever is building it. No account manager in between, and the same number after launch as before it.',
  },
  {
    key: 'say-picked-up',
    file: 'say-picked-up.png',
    to: '/#testimonials',
    alt: 'Owners who picked up the phone. Local business owners around Baytown and the Houston area, in their own words on Trustpilot.',
  },
  {
    key: 'say-get-started',
    file: 'say-get-started.png',
    to: '/contact',
    alt: 'Ready to get started? Tell us about the business and what you need. Reply within 24 hours, no sales pitch, honest answers.',
  },
  {
    key: 'say-stay-focused',
    file: 'say-stay-focused.png',
    to: '/services',
    alt: 'We keep it online, fast, and safe, so you can stay focused on running the business.',
  },
  {
    key: 'process',
    file: 'process.png',
    to: '/process',
    alt: 'How it works, in three steps. One, get in touch. Two, we build it. Three, go live.',
  },
  {
    key: 'included',
    file: 'included.png',
    to: '/services',
    alt: 'Every site we build is built for the phone first, carries a score you can check yourself, is watched after launch, and is one person start to finish.',
  },
  {
    key: 'trades',
    file: 'trades.png',
    to: '/industries',
    alt: 'Whatever the sign out front says. The twenty-two trades the site builds for, from barber shop and plumbing to law firm and marine services.',
  },
  {
    key: 'say-vetted',
    file: 'say-vetted.png',
    to: '/about',
    alt: 'Vetted, not just listed. The BBB Accredited Business seal. Anybody can end up with a BBB profile. Accreditation is applied for, vetted, and BBB can take it back.',
  },
]

const BY_KEY = new Map(CARDS.map(card => [card.key, card]))

/** One card by its key, or null where no card goes by that name. */
export const card = key => BY_KEY.get(key) ?? null

/**
 * One card as Buffer's `AssetInput`, ready to hang on a post.
 *
 * @param {object} chosen One entry from `CARDS`.
 * @returns {object} The asset, with the card's own alt text on it.
 */
export const assetFor = chosen => ({
  image: {
    url: `${CARD_BASE}/${chosen.file}`,
    metadata: { altText: chosen.alt },
  },
})

/**
 * What each channel calls itself in a link's tags.
 *
 * The spellings are the ones already in `analytics_events`, so a reading taken
 * over the change is one series rather than two: a post tagged `fb` last month
 * and a post tagged `fb` next month are the same channel, and renaming it here
 * would split the history at the day of the rename for nothing.
 */
const TAGS = { facebook: 'fb', instagram: 'ig', googlebusiness: 'gbp' }

/**
 * Where a card's post sends the reader, tagged so the answer can be read back.
 *
 * The card names the page; this puts the channel and the card's own key on it.
 * Without the key, a quarter of social traffic is one undifferentiated number
 * and there is no way to tell the card that earns a visit from the eleven that
 * do not — which is the only question worth asking of a queue that publishes
 * on its own five days a week.
 *
 * @param {object} chosen One entry from `CARDS`.
 * @param {string} service The Buffer channel the post is going out on.
 * @returns {string} The address the post carries.
 */
export function landingFor(chosen, service) {
  // The hash belongs to the browser and never to the query, so it comes off
  // before the tags go on and is put back at the end. A link built the other
  // way round hands the whole tag block to the fragment, and the page is
  // filed as untagged.
  const [path, fragment] = chosen.to.split('#')
  const url = new URL(path, SITE)
  url.searchParams.set('utm_source', TAGS[service] ?? service)
  url.searchParams.set('utm_medium', 'social')
  url.searchParams.set('utm_campaign', chosen.key)
  return `${url.toString()}${fragment ? `#${fragment}` : ''}`
}

/** The card a post is carrying, read back off the asset URL it was given. */
export function cardOf(post) {
  for (const asset of post.assets ?? []) {
    const file = asset.source?.split('/').pop()
    const found = CARDS.find(candidate => candidate.file === file)
    if (found) return found
  }
  return null
}

/**
 * The cards a channel has gone longest without, longest first.
 *
 * A queue that picks at random repeats inside a fortnight often enough that a
 * reader scrolling the grid sees the same page of type twice, and a queue that
 * walks the list in order is a loop anybody can predict by the third week.
 * Least recently used is neither: a card that has never run outranks every card
 * that has, and among the ones that have, the oldest goes first.
 *
 * A post with no due date sorts as though it were due now. A draft is written
 * and waiting rather than spent, so it holds its card out of the rotation until
 * it publishes — which is the point, since promoting it is what gives it a day.
 *
 * @param {object[]} posts The channel's own posts, whatever their state.
 * @param {Date} [now] The moment an undated post is treated as sitting at.
 * @returns {object[]} Cards, each with the `lastUsed` that ordered it.
 */
export function leastRecentlyUsed(posts, now = new Date()) {
  const used = new Map()
  for (const post of posts) {
    const found = cardOf(post)
    if (!found) continue
    const at = post.dueAt ? new Date(post.dueAt).getTime() : now.getTime()
    used.set(found.key, Math.max(used.get(found.key) ?? -Infinity, at))
  }

  return CARDS.map(candidate => ({ ...candidate, lastUsed: used.get(candidate.key) ?? null })).sort(
    (a, b) => {
      if (a.lastUsed === b.lastUsed) return 0
      if (a.lastUsed === null) return -1
      if (b.lastUsed === null) return 1
      return a.lastUsed - b.lastUsed
    }
  )
}
