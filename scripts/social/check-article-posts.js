/**
 * Checks the posts an article writes for itself, and where each one lands.
 *
 * The step runs unattended, in a routine nobody watches, against an account
 * that has one of the two channels it schedules. So the states worth checking
 * are the ordinary ones rather than the exceptional ones: a service with no
 * channel, a channel whose authorisation lapsed, a second run over an article
 * the queue already holds, a queue with no room left. Each has to end with the
 * post written and the reason named, because a post that quietly does not exist
 * looks exactly like a post that published.
 *
 * The other half is the copy. A Business Profile post is refused when it is due
 * rather than when it is written, so its limit is arithmetic and is checked
 * here, and it expires after seven days, so nothing in the wording it does not
 * take from the article may read as news.
 *
 *   npm run check:article-posts
 */
import { CADENCE } from '../../lib/social/buffer.js'
import { HELD, articleUrl, hasCopy, plan, postText } from '../../lib/social/announce.js'
import { ZONE } from '../../lib/outreach/sending/schedule.js'

const ARTICLE = {
  slug: 'what-a-plumbers-website-has-to-do',
  title: "What a Plumber's Website Actually Has to Do",
  excerpt:
    'A plumber wins work in the hour after somebody finds water where it should not be. ' +
    'The site either answers that call or it loses it to the next one down the page.',
  category: 'Tips for Owners',
  date: 'August 28, 2026',
}

const URL = articleUrl(ARTICLE)

// Wording that dates a post. A Business Profile keeps a post up for seven days
// and shows it to somebody searching rather than to somebody following, so the
// half of the post that is not the article's own words has to read the same in
// its seventh day as in its first.
const TIME_BOUND = [
  'today',
  'this week',
  'this morning',
  'yesterday',
  'tomorrow',
  'just published',
  'new post',
  'latest',
  'now live',
  'this month',
]

// Every pictographic run, however it is composed. Nothing the studio publishes
// carries one, and a post is the one string here that is written by a machine.
const EMOJI = /\p{Extended_Pictographic}/u

// Ten digits in the shape a person writes a number in. Loose on purpose: what
// is being caught is copy that reads as a phone number, and Google's refusal is
// no more precise than that.
const PHONE = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/

const channel = (service, extra = {}) => ({
  id: `${service}-channel`,
  name: service,
  service,
  cadence: CADENCE[service],
  isDisconnected: false,
  isLocked: false,
  ...extra,
})

const NOW = new Date('2026-08-29T18:00:00Z')

let failed = 0
const fail = message => {
  console.error(`FAIL ${message}`)
  failed += 1
}
const check = (condition, message) => {
  if (!condition) fail(message)
}

/** The hour, weekday and date an instant falls on, on the clock in Baytown. */
function localReading(iso) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const at = type => parts.find(part => part.type === type)?.value ?? ''
  return {
    hour: Number(at('hour')) % 24,
    weekday: at('weekday').toLowerCase(),
    date: `${at('year')}-${at('month')}-${at('day')}`,
  }
}

// Every service the queue schedules either has copy written for it or says it
// takes no announcement, and every post fits the service it is written for. A
// service added to the cadence with no copy and no such declaration would
// otherwise publish nothing and say nothing about why.
for (const [service, cadence] of Object.entries(CADENCE)) {
  if (cadence.announces === false) {
    check(!hasCopy(service), `${service}: takes no announcement and carries copy anyway`)
    continue
  }
  if (!hasCopy(service)) {
    fail(`${service}: the cadence covers it and no post is written for it`)
    continue
  }
  check(
    Number.isInteger(cadence.maxLength) && cadence.maxLength > 0,
    `${service}: declares no character limit for a post`
  )

  const text = postText(service, ARTICLE)
  check(text.length <= cadence.maxLength, `${service}: post is ${text.length} characters`)
  check(text.includes(URL), `${service}: post does not carry the article's address`)
  check(text.includes(ARTICLE.title), `${service}: post does not name the article`)
  check(
    text.includes('https://www.taylorurl.com/contact'),
    `${service}: post gives the reader nowhere to make contact`
  )
  check(!EMOJI.test(text), `${service}: post carries an emoji`)

  // Google refuses a Business Profile post that carries a phone number, and
  // Buffer refuses it on the way through rather than at the slot, so a number
  // in this copy is a week the profile says nothing. The number is on the
  // profile itself, a line above where the post appears.
  if (service === 'googlebusiness') {
    check(!PHONE.test(text), `${service}: post carries a phone number, which Google refuses`)
  }

  // Measured against the post's own wording rather than the whole of it: an
  // article is free to be about this month, and the frame around it is not.
  const frame = text.replace(ARTICLE.title, '').replace(ARTICLE.excerpt, '').toLowerCase()
  for (const phrase of TIME_BOUND) {
    check(!frame.includes(phrase), `${service}: post reads as news, on "${phrase}"`)
  }
}

// A long excerpt gives way a sentence at a time rather than overrunning the
// limit or arriving cut off mid-word.
{
  const long = {
    ...ARTICLE,
    excerpt: Array.from(
      { length: 40 },
      (unused, index) =>
        `A plumber wins the job in the hour after the call, and that is sentence ${index}.`
    ).join(' '),
  }
  for (const [service, cadence] of Object.entries(CADENCE)) {
    if (cadence.announces === false) continue
    const text = postText(service, long)
    check(
      text.length <= cadence.maxLength,
      `${service}: a long excerpt makes a ${text.length} character post`
    )
    check(text.includes(URL), `${service}: a trimmed post lost the article's address`)
    check(
      text.includes('https://www.taylorurl.com/contact'),
      `${service}: a trimmed post lost the contact link`
    )
  }
}

// Both announcing channels connected: one post each, on the slot each cadence
// names. Instagram is connected too and is held, because an article does not
// announce there.
{
  const channels = [channel('facebook'), channel('instagram'), channel('googlebusiness')]
  const { queued, held } = plan({ article: ARTICLE, channels, existing: [], now: NOW })

  check(queued.length === 2, `both channels connected: queued ${queued.length} posts, wanted 2`)
  check(held.length === 1, `both channels connected: held ${held.length} posts, wanted one`)
  check(
    held.every(item => item.service === 'instagram' && item.code === HELD.noCopy),
    'the held post is the one an article does not announce'
  )

  for (const item of queued) {
    const reading = localReading(item.dueAt)
    check(new Date(item.dueAt) > NOW, `${item.service}: due ${item.dueAt} is not ahead of the run`)
    check(reading.hour === 9, `${item.service}: due at ${reading.hour}:00, not 9:00`)
    check(
      item.metadata === CADENCE[item.service].metadata,
      `${item.service}: queued without the metadata its service needs`
    )
    check(item.text.includes(URL), `${item.service}: queued a post with no article address`)
  }

  const facebook = queued.find(item => item.service === 'facebook')
  const google = queued.find(item => item.service === 'googlebusiness')
  check(
    localReading(facebook.dueAt).date === '2026-08-30',
    `facebook: due ${facebook.dueAt}, wanted the next day`
  )
  // NOW is a Saturday, so the next day the Business Profile publishes on is the
  // Tuesday. The article takes whichever of its days comes round first rather
  // than a day of its own.
  check(
    localReading(google.dueAt).weekday === 'tue',
    `googlebusiness: due on a ${localReading(google.dueAt).weekday}, wanted a tue`
  )
}

// A service the cadence covers that Buffer holds no channel for. Both are
// connected today, so this is the state a removed channel or an unpaid slot
// puts the account back into: the post for it is written, named, and given a
// reason - never dropped, and never allowed to fail the whole step.
{
  const { queued, held } = plan({
    article: ARTICLE,
    channels: [channel('facebook')],
    existing: [],
    now: NOW,
  })

  check(queued.length === 1, `one channel: queued ${queued.length} posts, wanted 1`)
  check(queued[0]?.service === 'facebook', 'one channel: queued something other than Facebook')

  const google = held.find(entry => entry.service === 'googlebusiness')
  check(Boolean(google), 'one channel: the Business Profile post is not accounted for')
  check(google?.code === HELD.noChannel, `one channel: held as ${google?.code}`)
  check(Boolean(google?.text?.length), 'one channel: the held post carries no text to recover')
  check(google?.text?.includes(URL), 'one channel: the held post lost the article address')
  check(Boolean(google?.reason), 'one channel: the held post carries no reason')
}

// A channel whose authorisation lapsed reads as connected to anything counting
// channels, and publishes nothing.
{
  const { queued, held } = plan({
    article: ARTICLE,
    channels: [channel('facebook', { isDisconnected: true }), channel('googlebusiness')],
    existing: [],
    now: NOW,
  })
  check(queued.length === 1, `lapsed channel: queued ${queued.length} posts, wanted 1`)
  const facebook = held.find(entry => entry.service === 'facebook')
  check(facebook?.code === HELD.disconnected, `lapsed channel: held as ${facebook?.code}`)
}

// A second run over the same article adds nothing. The routine retries, and a
// retry that posts again puts the same article in front of a reader twice.
{
  const channels = [channel('facebook'), channel('googlebusiness')]
  const first = plan({ article: ARTICLE, channels, existing: [], now: NOW })
  const written = first.queued.map(item => ({
    id: `${item.service}-post`,
    channelId: item.channelId,
    status: 'scheduled',
    dueAt: item.dueAt,
    text: item.text,
  }))

  const again = plan({ article: ARTICLE, channels, existing: written, now: NOW })
  check(again.queued.length === 0, `second run: queued ${again.queued.length} posts, wanted none`)
  check(
    again.held
      .filter(entry => CADENCE[entry.service].announces !== false)
      .every(entry => entry.code === HELD.alreadyQueued),
    'second run: held an announcing service for something other than already carrying the article'
  )
}

// A queue with every day inside the horizon taken has nowhere to put the post,
// which is a state to report rather than one to fall over on.
{
  const facebook = channel('facebook')
  const full = Array.from({ length: 40 }, (unused, index) => ({
    id: `held-${index}`,
    channelId: facebook.id,
    status: 'scheduled',
    dueAt: new Date(NOW.getTime() + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
    text: 'a post already in the queue',
  }))

  const { queued, held } = plan({
    article: ARTICLE,
    channels: [facebook],
    existing: full,
    now: NOW,
  })
  check(queued.length === 0, `full queue: queued ${queued.length} posts, wanted none`)
  check(
    held.find(entry => entry.service === 'facebook')?.code === HELD.noSlot,
    'full queue: Facebook was not held for want of a slot'
  )
}

if (failed) {
  console.error(`\n${failed} article post ${failed === 1 ? 'check' : 'checks'} failed`)
  process.exit(1)
}

const written = Object.entries(CADENCE)
  .map(([service, cadence]) =>
    cadence.announces === false
      ? `${service} takes no announcement`
      : `${service} ${postText(service, ARTICLE).length} characters`
  )
  .join(', ')
console.log(`article posts compose and place: ${written}`)
