/**
 * Posts whose image is drawn from live data, and the queueing they share.
 *
 * The library in `lib/social/cards.js` is a fixed set: every card is committed
 * to `public/social/`, so a new one costs a release. A review a client left this
 * morning, or the PageSpeed readings taken this morning, cannot wait for one. So
 * these cards are drawn where the data is read and hosted where nothing has to
 * ship for them to exist. A client's launch is the same, and carries a short
 * video of the new site as well as a card (`lib/social/launches.js`).
 *
 * WHERE THEY ARE DRAWN. On the Pi, by `scripts/social/generated-cards.js`, in
 * the same Chromium, on the same sheet and through the same fit and the same
 * guards the library is rendered with (`scripts/social/media-sheet.js` and
 * `media-guard.js`). A card rendered when a site endpoint is asked for it would
 * have to draw the sheet in something other than a browser - Vercel functions
 * here carry no Chromium, and a second drawing of the chassis in another engine
 * is a second set of measures to keep in step with `sheet.css` - and it would
 * be drawn from whatever the data said when Buffer happened to fetch it, which
 * for a post due in nine days is not the data the post was written about.
 *
 * WHERE THEY ARE HOSTED. A public Supabase Storage bucket, `social-cards`, on
 * the project the site already runs on. Buffer is handed a URL rather than a
 * file and fetches it when the post goes out, so the image has to sit somewhere
 * public, unchanged, for as long as the post waits. An object in a public bucket
 * is exactly that: written once, served by the storage CDN with its own type,
 * reachable whatever state the site or the Pi is in by the time the post is due,
 * and needing no release to appear. The bucket takes PNG stills and the MP4 a
 * launch video is cut to, up to eight megabytes, and nothing but the service
 * role writes to it.
 *
 * HOW THEY ARE QUEUED. Every card goes on the Facebook Page, Instagram and the
 * Google Business Profile, each on the next slot its own cadence leaves free -
 * the same `freeSlots` the daily routine promotes drafts onto - and is placed as
 * a scheduled post rather than a draft. A scheduled post holds its day, so the
 * routine's slot search passes over that day and writes nothing for it, and the
 * card counts toward the channel's floor the morning after it is placed.
 *
 * `plan` decides everything and touches no network, which is what lets the whole
 * path be checked without a Buffer account.
 */
import {
  CADENCE,
  HORIZON_DAYS,
  connect,
  freeSlots,
  metadataFor,
  place,
  posts,
  wiring,
} from './buffer.js'
import { MAX_SENTENCES, firstPerson, sentenceCount } from './voice.js'

/** The Supabase project the site runs on, whose storage serves the cards. */
export const PROJECT = 'https://gujgtjqqurildqurpffh.supabase.co'

/** The public bucket every generated card is written to. */
export const BUCKET = 'social-cards'

/** Where a card stored at `path` is served, which is where Buffer fetches it. */
export const cardUrl = path => `${PROJECT}/storage/v1/object/public/${BUCKET}/${path}`

/** The studio's number, as every post written for the Page and Instagram ends on it. */
export const PHONE = '(281) 862-8687'

/** The one next step a Page or Instagram post ends on when no page fits better. */
export const CALL = `Call or text ${PHONE}`

/**
 * The channels every generated card goes out on, in the order they are placed.
 *
 * Named rather than read off the cadence, because a channel added to the cadence
 * later has no copy written for it here and must not start publishing another
 * channel's words.
 */
export const SERVICES = ['facebook', 'instagram', 'googlebusiness']

const PHONE_NUMBER = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/
const ADDRESS = /https?:\/\/\S+/g

/**
 * Everything wrong with one post's words for one channel, or an empty list.
 *
 * The rules in `voice.js` and the cadence, applied at the point of writing
 * because the post is placed unattended and a scheduled post is out of reach the
 * moment it publishes: three sentences at most, "we" and never "I", no emoji, no
 * question a reader would be expected to answer in the comments, and exactly one
 * next step at the end - an address on the Page, the number on Instagram, where
 * a caption carries no link anybody can tap, and nothing on the Business
 * Profile, which refuses a phone number and carries its own Learn more button.
 *
 * A launch the client said yes to names their business, and a business can be
 * called "My Pool Guy". `allow` lifts exactly those names out before the words
 * are read for who is speaking, and nothing else about the post changes.
 *
 * @param {string} service One of `SERVICES`.
 * @param {string} text The post.
 * @param {{allow?: string[]}} [options] Names the post may carry as written.
 * @returns {string[]} What is wrong with it.
 */
export function voiceFaults(service, text, { allow = [] } = {}) {
  const found = []
  const cadence = CADENCE[service]
  if (!cadence) return [`${service} is not a channel the queue schedules`]
  if (cadence.maxLength && text.length > cadence.maxLength)
    found.push(`${text.length} characters, past ${service}'s ${cadence.maxLength}`)
  const counted = sentenceCount(text)
  if (counted > MAX_SENTENCES) found.push(`${counted} sentences, past ${MAX_SENTENCES}`)
  const spoken = allow.filter(Boolean).reduce((rest, name) => rest.split(name).join(' '), text)
  const singular = firstPerson(spoken)
  if (singular.length) found.push(`first person (${singular.join(', ')})`)
  if (/\p{Extended_Pictographic}/u.test(text)) found.push('an emoji')
  if (/\?/.test(text.replace(ADDRESS, ''))) found.push('a question')
  if (/\bcomments?\b|\blet us know\b|\btell us\b/i.test(text))
    found.push('an invitation to comment')

  const last = text.trim().split('\n').pop().trim()
  if (service === 'googlebusiness') {
    if (PHONE_NUMBER.test(text)) found.push('a phone number, which the Business Profile refuses')
    if (last === CALL) found.push('a call line, which the profile button already is')
  } else {
    const steps = text
      .split('\n')
      .filter(line => line.trim() === CALL || /^https?:\/\//.test(line.trim()))
    if (steps.length !== 1) found.push(`${steps.length} next steps where one belongs`)
    if (last !== CALL && !/^https:\/\/www\.taylorurl\.com\//.test(last))
      found.push('no next step on its last line')
    if (service === 'instagram' && /https?:\/\//.test(text))
      found.push('an address in a caption, which nobody can tap')
  }
  return found
}

/** Why a channel ended a run without the card on it. */
export const HELD = {
  noCopy: 'no-copy',
  noChannel: 'no-channel',
  disconnected: 'disconnected',
  alreadyQueued: 'already-queued',
  noSlot: 'no-slot',
}

/** Whether a held channel is a state somebody has to do something about. */
export const wanted = entry => entry.code !== HELD.alreadyQueued

/**
 * Whether a post already carries the card, read off its image.
 *
 * Buffer answers an image with the URL it was given, so the stored file's path
 * identifies the card in a post the way an article's address identifies an
 * article. The file name alone is compared, because Buffer may answer with the
 * address it fetched from or a copy of the same file under its own host.
 */
export function carries(post, image) {
  const file = image.split('/').pop()
  return (post.assets ?? []).some(asset => asset.source?.split('?')[0].split('/').pop() === file)
}

/**
 * Where the card lands on each channel, and what becomes of the ones it cannot.
 *
 * Every channel in `SERVICES` ends in exactly one of the two lists, the same
 * contract `announce.js` keeps.
 *
 * A card goes out as one image on every channel. A launch that carries a video
 * names its media per channel in `media` instead - the video where a reel can
 * publish, the still where one cannot - and each channel is then recognised as
 * already carrying it by its own file. A channel the card is already on - found on a
 * post Buffer holds, or named in `placed` from the record a previous run left -
 * is held as already queued, which is what a second run over the same card looks
 * like and is not a fault.
 *
 * @param {object} options
 * @param {string} options.image The card's public URL.
 * @param {string} options.alt What the card says, for a reader who cannot see it.
 * @param {Record<string, string>} options.texts Each channel's post.
 * @param {object[]} options.channels Connected channels, as `wiring` returns them.
 * @param {object[]} [options.existing] Every post Buffer holds for the organization.
 * @param {string[]} [options.placed] Channels a previous run already put the card on.
 * @param {Date} [options.now] The moment the slot search starts from.
 * @param {Record<string, object[]>} [options.media] Each channel's own `AssetInput`
 *   list, where the channels do not all carry the one image.
 * @param {string[]} [options.allow] Names the posts may carry, as `voiceFaults` takes them.
 * @returns {{queued: object[], held: object[]}}
 */
export function plan({
  image,
  alt,
  texts,
  channels,
  existing = [],
  placed = [],
  now = new Date(),
  media = null,
  allow = [],
}) {
  const queued = []
  const held = []
  const card = [{ image: { url: image, metadata: { altText: alt } } }]

  for (const service of SERVICES) {
    const assets = media?.[service] ?? card
    const file = assets[0]?.image?.url ?? assets[0]?.video?.url ?? image
    const text = texts[service]
    if (!text) {
      held.push({ service, code: HELD.noCopy, reason: `no post is written for ${service}` })
      continue
    }
    const faults = voiceFaults(service, text, { allow })
    if (faults.length) {
      throw new Error(`the ${service} post breaks the voice: ${faults.join('; ')}`)
    }

    const channel = channels.find(candidate => candidate.service === service)
    if (!channel) {
      held.push({
        service,
        text,
        code: HELD.noChannel,
        reason: `Buffer has no ${service} channel connected, so this post has nowhere to go`,
      })
      continue
    }
    if (channel.isDisconnected || channel.isLocked) {
      held.push({
        service,
        text,
        code: HELD.disconnected,
        reason: `the ${service} channel has lost its authorisation and publishes nothing`,
      })
      continue
    }

    const mine = existing.filter(candidate => candidate.channelId === channel.id)
    if (placed.includes(service) || mine.some(candidate => carries(candidate, file))) {
      held.push({
        service,
        text,
        code: HELD.alreadyQueued,
        reason: `the ${service} queue already carries this card`,
      })
      continue
    }

    const scheduled = mine.filter(candidate => candidate.status === 'scheduled')
    const [dueAt] = freeSlots(channel.cadence, scheduled, 1, now)
    if (!dueAt) {
      held.push({
        service,
        text,
        code: HELD.noSlot,
        reason: `the ${service} queue has no free slot inside ${HORIZON_DAYS} days`,
      })
      continue
    }

    queued.push({
      service,
      channelId: channel.id,
      metadata: metadataFor(channel.cadence, assets),
      assets,
      text,
      dueAt,
    })
  }

  return { queued, held }
}

/**
 * Puts one card on every channel's next free slot.
 *
 * Each post is handed to `onPlaced` the moment Buffer takes it, before the next
 * is asked for. A run that dies between the second post and the third has then
 * already recorded the first two, and the run after it places the third alone
 * rather than publishing the card twice on the channels that took it.
 *
 * A dry run reads the same wiring and the same queue and answers the same shape
 * without writing anything.
 *
 * @param {string|object} key A Buffer public API key, or a run from `connect`.
 * @param {object} options What `plan` takes, less the wiring and the queue.
 * @param {boolean} [options.dryRun] Plan and place nothing.
 * @param {(entry: object) => Promise<void>} [options.onPlaced] Called after each post lands.
 */
export async function queueCard(
  key,
  {
    image,
    alt,
    texts,
    placed = [],
    now = new Date(),
    media = null,
    allow = [],
    dryRun = false,
    onPlaced = async () => {},
  }
) {
  const run = connect(key)
  const { organizationId, channels, absent } = await wiring(run)
  const existing = await posts(run, organizationId)
  const { queued, held } = plan({
    image,
    alt,
    texts,
    channels,
    existing,
    placed,
    now,
    media,
    allow,
  })

  const landed = []
  for (const item of queued) {
    const written = dryRun
      ? { id: null, status: 'not written' }
      : await place(run, {
          channelId: item.channelId,
          text: item.text,
          metadata: item.metadata,
          assets: item.assets,
          at: item.dueAt,
        })
    const entry = {
      id: written.id,
      status: written.status,
      service: item.service,
      dueAt: item.dueAt,
    }
    landed.push({ ...entry, text: item.text })
    if (!dryRun) await onPlaced(entry)
  }

  return {
    image,
    dryRun,
    queued: landed,
    held,
    absent,
    settled: landed.length + held.filter(entry => !wanted(entry)).length === SERVICES.length,
    needsAttention: held.some(wanted),
  }
}
