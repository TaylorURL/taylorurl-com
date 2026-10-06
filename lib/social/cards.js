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
import { existsSync, readFileSync } from 'node:fs'
import { SITE, planFor } from './buffer.js'

/** Where the cards are served from, which is where Buffer fetches them. */
const CARD_BASE = `${SITE}/social`

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
    alt: 'Google grades every site, and the report is free. Four things, graded on every site there is. Run it on any site we have built and read the result yourself.',
  },
  {
    key: 'say-watched',
    file: 'say-watched.png',
    to: '/console/status',
    alt: 'When something breaks, we know before you call. Every site we look after reports its uptime and its errors to a page anyone can open.',
  },
  // The key is what `utm_campaign` carries, so it stays as it is even though
  // the card no longer says one person: renaming it would split this card's
  // reading in `analytics_events` at the day of the rename and leave neither
  // half comparable to the other.
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
    alt: 'How it works, in three steps. Get in touch, we build it, and it goes live.',
  },
  {
    key: 'included',
    file: 'included.png',
    to: '/services',
    alt: 'Every site we build is built for the phone first, carries a score you can check yourself, is watched after launch, and puts you with the people building it.',
  },
  {
    key: 'trades',
    file: 'trades.png',
    to: '/industries',
    alt: 'Whatever the sign out front says. A list of the twenty-two trades we build for, including barber shop, plumbing, law firm and marine services.',
  },
  {
    key: 'say-vetted',
    file: 'say-vetted.png',
    to: '/about',
    alt: 'Vetted, not just listed, under the BBB Accredited Business seal. Anybody can end up with a BBB profile. Accreditation is applied for, vetted, and BBB can take it back.',
  },
]

/**
 * The generated library: cards, carousels and vertical videos rendered from the
 * site's own data by `npm run social:render`, served from `public/social/library/`.
 *
 * Read off disk rather than imported, so a checkout that has not rendered yet
 * still answers with the twelve hand-made cards instead of failing to load.
 */
const LIBRARY_FILE = new URL('./library.json', import.meta.url)
const LIBRARY_BASE = `${SITE}/social/library`

const generated = existsSync(LIBRARY_FILE)
  ? JSON.parse(readFileSync(LIBRARY_FILE, 'utf8')).map(entry => ({ ...entry, generated: true }))
  : []

/**
 * Every piece of media a post can carry, in one shape.
 *
 * `kind` is `image`, `carousel` or `video`; `files` the files in order; `alts`
 * one description per file; `channels` the services that take it. The twelve
 * hand-made cards are statements in the brand's type and go anywhere an image
 * does.
 */
export const LIBRARY = [
  ...CARDS.map(entry => ({
    ...entry,
    kind: 'image',
    format: entry.key === 'trades' ? 'trade' : entry.key === 'process' ? 'process' : 'statement',
    files: [entry.file],
    alts: [entry.alt],
    channels: ['facebook', 'instagram', 'googlebusiness'],
    generated: false,
  })),
  ...generated.map(entry => ({
    ...entry,
    alt: entry.alt ?? entry.alts?.[0] ?? entry.headline ?? '',
    alts: entry.alts ?? (entry.files ?? []).map(() => entry.alt ?? entry.headline ?? ''),
  })),
]

const BY_KEY = new Map(LIBRARY.map(entry => [entry.key, entry]))

/** One piece of media by its key, or null where nothing goes by that name. */
export const card = key => BY_KEY.get(key) ?? null

/** Where one file of an entry is served, which is where Buffer fetches it. */
export const urlOf = (entry, file) => `${entry.generated ? LIBRARY_BASE : CARD_BASE}/${file}`

/**
 * One library entry as the `AssetInput` list a post carries.
 *
 * An image is one asset, a carousel one per slide in order, and a video one
 * video asset with its poster as the thumbnail Buffer shows before it plays.
 *
 * @param {object} entry One entry from `LIBRARY`.
 * @returns {object[]} `AssetInput` entries.
 */
export function assetsFor(entry) {
  if (entry.kind === 'video') {
    return [
      {
        video: {
          url: urlOf(entry, entry.files[0]),
          ...(entry.poster ? { thumbnailUrl: urlOf(entry, entry.poster) } : {}),
          metadata: { title: entry.headline ?? entry.key, thumbnailOffset: 0 },
        },
      },
    ]
  }
  return entry.files.map((file, index) => ({
    image: {
      url: urlOf(entry, file),
      metadata: { altText: entry.alts?.[index] ?? entry.alt },
    },
  }))
}

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

/**
 * The media a post is carrying, read back off the asset URL it was given or,
 * where Buffer has rehosted a video and the URL no longer says, off the
 * campaign tag its link carries.
 */
export function cardOf(post) {
  for (const asset of post.assets ?? []) {
    const file = asset.source?.split('?')[0].split('/').pop()
    const found = LIBRARY.find(candidate => candidate.files.includes(file))
    if (found) return found
  }
  const tagged = /utm_campaign=([a-z0-9-]+)/.exec(post.text ?? '')
  return tagged ? (BY_KEY.get(tagged[1]) ?? null) : null
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
export function leastRecentlyUsed(
  posts,
  now = new Date(),
  { service = null, kind = null, formats = null } = {}
) {
  const used = new Map()
  for (const post of posts) {
    const found = cardOf(post)
    if (!found) continue
    const at = post.dueAt ? new Date(post.dueAt).getTime() : now.getTime()
    used.set(found.key, Math.max(used.get(found.key) ?? -Infinity, at))
  }

  const pool = LIBRARY.filter(
    candidate =>
      (!service || candidate.channels.includes(service)) &&
      (!kind || candidate.kind === kind) &&
      (!formats || formats.includes(candidate.format))
  )
  return pool
    .map(candidate => ({ ...candidate, lastUsed: used.get(candidate.key) ?? null }))
    .sort((a, b) => {
      if (a.lastUsed === b.lastUsed) return 0
      if (a.lastUsed === null) return -1
      if (b.lastUsed === null) return 1
      return a.lastUsed - b.lastUsed
    })
}

/**
 * What the next posts on a channel should be, slot by slot.
 *
 * Each free slot is read against the channel's plan for that weekday, and the
 * media the channel has gone longest without, of the kind and format the day
 * asks for, is put against it. A day whose formats have nothing left unused
 * falls back to any media of the right kind, and then to any media the channel
 * takes, so a thin library narrows the variety rather than stopping the queue.
 * Nothing is offered twice in one answer.
 *
 * @param {object} cadence The channel's entry from `CADENCE`.
 * @param {string} service The channel's service.
 * @param {object[]} mine The channel's own posts.
 * @param {string[]} slots Free slots, from `freeSlots`.
 * @param {Date} [now]
 * @param {Set<string>} [taken] Keys already spoken for, shared across calls.
 * @returns {object[]} One `{ dueAt, kind, formats, long, media }` per slot.
 */
export function upcoming(cadence, service, mine, slots, now = new Date(), taken = new Set()) {
  // How often each format has been offered in this answer. Among media nobody
  // has used, every candidate ties on its date, and without this the day
  // would take the first format it names every time and the rest would wait
  // until the first ran dry.
  const offered = new Map()
  const rank = entry => (entry.lastUsed === null ? -Infinity : entry.lastUsed)
  const pick = options => {
    const ranked = leastRecentlyUsed(mine, now, { service, ...options }).filter(
      entry => !taken.has(entry.key)
    )
    if (!options.formats) return ranked[0] ?? null
    const heads = options.formats
      .map((format, order) => ({ order, entry: ranked.find(one => one.format === format) }))
      .filter(head => head.entry)
    heads.sort(
      (a, b) =>
        rank(a.entry) - rank(b.entry) ||
        (offered.get(a.entry.format) ?? 0) - (offered.get(b.entry.format) ?? 0) ||
        a.order - b.order
    )
    return heads[0]?.entry ?? null
  }
  return slots.map(dueAt => {
    const day = planFor(cadence, dueAt) ?? { kind: 'image', formats: null }
    const media =
      (day.formats && pick({ kind: day.kind, formats: day.formats })) ??
      pick({ kind: day.kind }) ??
      pick({}) ??
      null
    if (media) {
      taken.add(media.key)
      offered.set(media.format, (offered.get(media.format) ?? 0) + 1)
    }
    return {
      dueAt,
      kind: day.kind,
      formats: day.formats,
      long: Boolean(day.long),
      media,
    }
  })
}
