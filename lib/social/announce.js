/**
 * The posts an article gets on the day it goes live.
 *
 * Publishing an article and stopping leaves the queue to be filled by hand, and
 * a queue filled by hand goes quiet the first week nobody has time. So the
 * article writes its own posts: one per service the cadence covers, composed
 * from the article's own words, each placed on the next slot that service's
 * cadence leaves free.
 *
 * The copy is written per service because the two are read in different places.
 * A Facebook post is met by somebody scrolling a feed who already follows the
 * Page, so it opens on the article. A Business Profile post is met by somebody
 * searching for a web designer who has never heard of the business, it caps at
 * 1,500 characters, and it carries no phone number because Google refuses one,
 * so it opens by saying what the business does and carries nothing that reads
 * as news.
 *
 * Both are held to the ceiling in `voice.js`. A post has three sentences to
 * spend, the frame around the article takes the first of them, and the
 * article's own words get what is left — which is what decides how much of an
 * excerpt a service carries, rather than the character limit doing it alone.
 *
 * `plan` decides everything and touches no network, which is what lets the
 * whole path be checked without a Buffer account: what each post says, which
 * day it lands on, and what becomes of a post whose service has no channel.
 */
import { CADENCE, HORIZON_DAYS, SITE, connect, freeSlots, place, posts, wiring } from './buffer.js'
import { MAX_SENTENCES, sentenceCount, sentences } from './voice.js'

const CONTACT = `${SITE}/contact`

// A post is met by somebody already searching for the trade, and the shortest
// thing they can do about it is press a number. It sits in the same block as
// the contact page so the two survive a trim together.
const REACH = `Call or text (281) 862-8687\n${CONTACT}`

// Google refuses a Business Profile post that carries a phone number, and
// Buffer rejects it on the way through rather than at the slot, so a post
// written with the number on it is a week the profile says nothing. The number
// is on the profile itself, a line above where the post appears, so leaving it
// out of the text costs the reader nothing.
const REACH_WITHOUT_NUMBER = CONTACT

/** Where the article itself answers. */
export const articleUrl = article => `${SITE}/blog/${article.slug}`

/**
 * The blocks each service's post is built from, in the order they are read.
 *
 * A service the cadence covers with nothing written here gets no post, and the
 * post checks refuse the pairing, so a channel added to the cadence cannot
 * start publishing another channel's words.
 */
const TEMPLATES = {
  facebook: article => [
    article.title,
    article.excerpt,
    articleUrl(article),
    'TaylorURL builds and hosts websites for local businesses around Baytown.',
    REACH,
  ],
  // One sentence of frame rather than two. The second used to invite the reader
  // to describe their business, which is the contact page's job and the post's
  // button already goes there; spending a third of the post on it left the
  // article with nothing of its own to say.
  googlebusiness: article => [
    'Web design and development in Baytown, Texas.',
    article.title,
    article.excerpt,
    articleUrl(article),
    'Sites are built, hosted and looked after from Baytown, so a first meeting is a drive ' +
      'across town rather than a call.',
    REACH_WITHOUT_NUMBER,
  ],
}

/** Whether a post can be written for a service at all. */
export const hasCopy = service => Boolean(TEMPLATES[service])

function render(parts, at, excerpt) {
  return parts
    .map((part, index) => (index === at ? excerpt : part))
    .filter(Boolean)
    .join('\n\n')
}

/**
 * One service's post, composed from the article and cut to the service's limit.
 *
 * The excerpt is the part that gives way, a whole sentence at a time and then
 * altogether, because it is the only block written for somewhere else. What
 * stays is the title, the address the article answers at, and the line saying
 * what the business does: a post that has lost any of those has lost its job.
 *
 * @param {string} service A service named in `CADENCE`.
 * @param {object} article A published article.
 * @returns {string} The post, at or under the service's character limit.
 */
export function postText(service, article) {
  const template = TEMPLATES[service]
  if (!template) throw new Error(`no post is written for ${service}`)

  const limit = CADENCE[service]?.maxLength ?? Infinity
  const parts = template(article)
  const at = parts.indexOf(article.excerpt)
  const kept = sentences(article.excerpt ?? '')

  // What the frame costs, measured rather than counted by hand, so a template
  // that grows by a sentence takes it out of the excerpt instead of out of the
  // ceiling. A frame already at the ceiling leaves nothing, and the post goes
  // out as the frame alone rather than overrunning.
  const frame = sentenceCount(render(parts, at, ''))
  const allowance = Math.max(0, MAX_SENTENCES - frame)

  for (let take = Math.min(kept.length, allowance); take >= 0; take -= 1) {
    const text = render(parts, at, kept.slice(0, take).join(' '))
    if (text.length <= limit) return text
  }
  return render(parts, at, '').slice(0, limit).trimEnd()
}

/** Why a service ended the run with nothing queued. */
export const HELD = {
  noCopy: 'no-copy',
  noChannel: 'no-channel',
  disconnected: 'disconnected',
  alreadyQueued: 'already-queued',
  noSlot: 'no-slot',
}

/**
 * Where each service's post lands, and what becomes of the ones that cannot.
 *
 * Every service the cadence covers ends the run in exactly one of two lists.
 * `queued` carries a post and the instant it is due; `held` carries the post
 * that was written anyway, the service it was written for, and why nothing took
 * it. Nothing is dropped and nothing throws, because the states this reaches
 * are ordinary - a channel nobody has bought a slot for yet, an authorisation
 * that lapsed overnight, a second run over an article the queue already holds -
 * and a step that fails outright on any of them is a step that stops publishing
 * to the channels that are working.
 *
 * @param {object} options
 * @param {object} options.article The article that has gone live.
 * @param {object[]} options.channels Connected channels, as `wiring` returns them.
 * @param {object[]} [options.existing] Every post Buffer holds for the organization.
 * @param {Date} [options.now] The moment the slot search starts from.
 * @returns {{queued: object[], held: object[]}}
 */
export function plan({ article, channels, existing = [], now = new Date() }) {
  const queued = []
  const held = []
  const url = articleUrl(article)

  for (const service of Object.keys(CADENCE)) {
    if (!hasCopy(service)) {
      held.push({
        service,
        text: null,
        code: HELD.noCopy,
        reason: `no post is written for ${service}`,
      })
      continue
    }

    const text = postText(service, article)
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
    // The routine can run twice over one article - a retry, a run that stopped
    // after the merge and picked itself up - and the address is what identifies
    // the article in a post rather than the wording, which is composed fresh
    // every time.
    if (mine.some(candidate => (candidate.text ?? '').includes(url))) {
      held.push({
        service,
        text,
        code: HELD.alreadyQueued,
        reason: `the ${service} queue already carries this article`,
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
      metadata: channel.cadence.metadata,
      text,
      dueAt,
    })
  }

  return { queued, held }
}

/** Whether a held service is a state somebody has to do something about. */
const wanted = entry => entry.code !== HELD.alreadyQueued

/**
 * Composes the article's posts and puts them in the queue.
 *
 * A dry run reads the same wiring and answers the same shape without writing
 * anything, which is how the copy and the dates are read before a routine runs
 * unattended.
 *
 * Every request goes through one run, so the wiring is read once and the two
 * posts share one budget for waiting out a rate limit rather than each being
 * allowed the whole of it.
 *
 * @param {string|object} key A Buffer public API key, or a run from `connect`.
 * @param {object} options
 * @param {object} options.article The article that has gone live.
 * @param {Date} [options.now] The moment the slot search starts from.
 * @param {boolean} [options.dryRun] Compose and place nothing.
 */
export async function announce(key, { article, now = new Date(), dryRun = false }) {
  const run = connect(key)
  const { organizationId, channels, absent } = await wiring(run)
  const existing = await posts(run, organizationId)
  const { queued, held } = plan({ article, channels, existing, now })

  const placed = []
  for (const item of queued) {
    const written = dryRun
      ? { id: null, status: 'not written' }
      : await place(run, {
          channelId: item.channelId,
          text: item.text,
          metadata: item.metadata,
          at: item.dueAt,
        })
    placed.push({ ...written, service: item.service, dueAt: item.dueAt, text: item.text })
  }

  return {
    article: article.slug,
    url: articleUrl(article),
    dryRun,
    queued: placed,
    held,
    // A service the cadence covers that Buffer has nothing connected for. Named
    // here as well as in `held` because it is the one state that stays true
    // between runs and is answered by buying a channel rather than by retrying.
    absent,
    // What the queue took, whichever run took it. A second run over an article
    // already in the queue has done its job and says so.
    settled: placed.length + held.filter(entry => !wanted(entry)).length,
    needsAttention: held.some(wanted),
  }
}
