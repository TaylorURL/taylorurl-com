/**
 * Launch posts: the day a client's site goes live, the studio's own pages say
 * so, by name where the client said yes and by trade and town where they did
 * not.
 *
 * Every evening the Pi reads the builds the console has marked live and posts
 * each launch once, on the Page, Instagram and the Business Profile. Everything
 * that decides what a launch post says and whom it names is here and touches no
 * network, so it can be checked against a fixture; the recording, the drawing
 * and the queueing are `scripts/social/generated-cards.js launch`.
 *
 * WHEN A SITE HAS LAUNCHED. When the console moves a build to its last stage.
 * `admin_project_stage` is the only writer of `projects.stage`, and moving a
 * build to `live` is what stamps `projects.launched_at`, once, and marks the
 * build complete; moving it back off `live` clears the stamp. So a launch is a
 * project whose stage is `live` with a stamp on it, and the day it launched is
 * the stamp's date in Central. A cancelled build is never one, whatever its
 * stage says.
 *
 * WHO SAID YES. The brief's own question, `contacts.showcase` in
 * `project_onboarding.answers`, and nothing else: not a conversation, not an
 * email, not a site the client was happy with. Only the answer `yes` names the
 * business. No, an unanswered question, a brief never opened and a project with
 * no brief at all are the same answer, and each is posted without the name,
 * without the site's address and without any picture of the site, naming the
 * trade and the town alone.
 *
 * WHAT A NAMED POST CARRIES. A short vertical video of the site loading on an
 * emulated mid-range phone over 4G, with three lines on what the site lets the
 * business's customers do, on the Page and Instagram, and a still card with the
 * loaded site on a phone on the Business Profile, which Buffer gives no video.
 * An anonymous post is one still card on all three.
 *
 * THE THREE LINES. Never the client's own words, and never a claim about the
 * business. Each line is a thing a customer can do on the site, chosen from a
 * fixed list, and is offered only where the brief asked for it and, wherever the
 * live page was read, the page bears it out: a tap-to-call line needs a `tel:`
 * link on the page, a booking line needs the page to link to booking. What the
 * customer said they do first leads. Three closing lines are true of every
 * site the studio builds and fill in when fewer than three are borne out.
 *
 * WHEN IT POSTS. On the evening of the launch day, and on any evening in the
 * week after it that a run did not happen or did not finish: a run that missed
 * a launch picks it up the next time it runs, and past the week the launch is
 * left without a post rather than given one that reads as late. One launch is
 * posted a run; a second the same day takes the next evening.
 */
import { dayIn, formatInstant } from '../time/zone.js'
import { bareDomain } from '../../src/app/utils/domains.js'
import { CALL } from './generated.js'
import { TRADE_WORDS } from './reviews.js'

/** Where in the stored brief the answer lives, as the onboarding register keys it. */
export const SHOWCASE_KEY = 'contacts.showcase'

/**
 * The launch day and the six after it. A launch older than this is recorded as
 * passed over, once, and never posted.
 */
export const WINDOW_DAYS = 7

/** How far back the projects are read: the window, and a week to say "passed over" in. */
export const READ_DAYS = WINDOW_DAYS * 2

const DAY = 86_400_000

/** Whole days from one Central date to another, both `YYYY-MM-DD`. */
export const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY)

/**
 * Whether the client said yes to being shown, read from the stored answers.
 *
 * Strictly the stored `yes`. Anything else - `no`, absent, an old shape, a
 * value nobody offered - is not a yes.
 *
 * @param {object|null|undefined} answers `project_onboarding.answers`.
 */
export function consented(answers) {
  const [group, name] = SHOWCASE_KEY.split('.')
  const held = answers?.[group]
  return Boolean(held && typeof held === 'object' && held[name] === 'yes')
}

/**
 * Which launches a run is for, oldest first, with one left half done first.
 *
 * @param {object} options
 * @param {object[]} options.projects Rows of `projects`: `id`, `stage`, `status`,
 *   `launched_at`, `business_name`, `site_id`.
 * @param {Map<string, object>} options.recorded Rows already written, by project id.
 * @param {Date} [options.now]
 * @returns {{due: object[], late: object[], done: string[]}}
 */
export function launchesDue({ projects, recorded, now = new Date() }) {
  const today = dayIn(now)
  const due = []
  const late = []
  const done = []
  const ordered = [...projects]
    .filter(project => project.launched_at)
    .sort((a, b) => String(a.launched_at).localeCompare(String(b.launched_at)))

  for (const project of ordered) {
    if (project.stage !== 'live' || project.status === 'cancelled') continue
    const row = recorded.get(project.id)
    if (row?.state === 'queued') {
      done.push(project.id)
      continue
    }
    // Passed over once already, and said so then.
    if (row?.state === 'skipped') continue
    const on = dayIn(project.launched_at)
    const age = daysBetween(on, today)
    // A stamp ahead of the clock is a clock to distrust, not a launch to post.
    if (age < 0) continue
    if (age >= WINDOW_DAYS) {
      late.push({ project, on, age, row: row ?? null })
      continue
    }
    due.push({ project, on, age, row: row ?? null, resume: row?.state === 'drawn' })
  }
  due.sort((a, b) => Number(b.resume) - Number(a.resume))
  return { due, late, done }
}

/** A brief row by its label, or an empty string. */
const briefValue = (brief, label) =>
  String(
    (Array.isArray(brief) ? brief : []).find(entry => entry?.label === label)?.value ?? ''
  ).trim()

const slugOf = name =>
  String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * The trade the pay form recorded, as the card names it, or null.
 *
 * Read off the brief's 'Business Type' row, which holds the trade's display
 * name, and joined to the nouns the review cards already use, so a roofer is "a
 * roofing company" wherever the studio's pages describe one. A business that
 * answered Something Else, or whose brief is missing, has no trade to name.
 *
 * @param {Array<{label: string, value: string}>} brief `project_briefs.answers`.
 * @returns {{id: string, noun: string}|null}
 */
export function tradeOf(brief) {
  const id = slugOf(briefValue(brief, 'Business Type'))
  const found = TRADE_WORDS.find(trade => trade.id === id)
  return found ? { id: found.id, noun: found.noun } : null
}

/** A town as a reader would write it, or null where the answer is not a town. */
function townName(value) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!/^[A-Za-z][A-Za-z .'-]{1,28}[A-Za-z.]$/.test(text)) return null
  return text.replace(/\b[a-z]/g, letter => letter.toUpperCase())
}

/**
 * The town the business works from, or null.
 *
 * The address the client gave, where they gave one, and otherwise the first
 * town they said they cover. A town is held to the shape of a town before it
 * is printed, so a postcode, a street or a sentence typed into the box comes
 * off rather than onto a card.
 *
 * @param {object} answers `project_onboarding.answers`.
 */
export function townOf(answers) {
  const address = answers?.business?.address
  if (address && typeof address === 'object' && address.none !== true) {
    const city = townName(address.city)
    if (city) return city
  }
  const area = Array.isArray(answers?.business?.service_area) ? answers.business.service_area : []
  for (const entry of area) {
    const town = townName(entry)
    if (town) return town
  }
  return null
}

/**
 * The name a named post uses, or null.
 *
 * The client's own spelling from the brief first, because the question asked
 * for it "exactly as you want it read", then the name the pay form took. An
 * asterisk is taken out, because the sheet reads one as an accent marker.
 */
export function nameOf(project, answers) {
  const written = String(answers?.brand?.name_as_written ?? '').trim()
  const name = (written || String(project?.business_name ?? '').trim()).replace(/\*/g, '')
  return name.replace(/\s+/g, ' ').trim() || null
}

/**
 * Who an anonymous post is about: "a roofing company in Crosby".
 *
 * The description is held to the same guards as anything else on a card, so a
 * town that shares its name with another client comes off first, then the
 * trade, down to "a local business".
 *
 * @param {object} options
 * @param {{noun: string}|null} options.trade From `tradeOf`.
 * @param {string|null} options.town From `townOf`.
 * @param {(text: string) => boolean} options.passes The sheet's guards.
 */
export function subjectOf({ trade, town, passes }) {
  const who = trade?.noun ?? 'a local business'
  return (
    [town ? `${who} in ${town}` : null, who, 'a local business'].find(
      candidate => candidate && passes(candidate)
    ) ?? 'a local business'
  )
}

/** The pages a brief turned on, as a set of ids. */
const pagesOn = answers =>
  new Set(Array.isArray(answers?.pages?.chosen) ? answers.pages.chosen : [])

/**
 * What a customer can do on a site, in the order they are offered.
 *
 * - `line`   The words, as a verb phrase: "book a time online". The
 *            card capitalises it and the post runs it into a sentence.
 * - `brief`  Whether the brief asked for it.
 * - `page`   Whether the live page bears it out, or null where the page cannot
 *            say and the brief's word is the whole of it.
 * - `first`  The answer to "what they do first" that puts this line ahead.
 */
export const LINES = [
  {
    id: 'call',
    line: 'call with one tap',
    first: 'calls',
    brief: () => true,
    page: facts => facts.tel,
  },
  {
    id: 'text',
    line: 'text the business from the site',
    first: 'texts',
    brief: answers =>
      answers?.contacts?.text_ok === 'yes' || answers?.customers?.decision === 'texts',
    page: facts => facts.sms,
  },
  {
    id: 'book',
    line: 'book a time online',
    first: 'books_online',
    brief: answers =>
      ['book', 'book_a_bay', 'book_consult', 'schedule_treatment'].some(page =>
        pagesOn(answers).has(page)
      ),
    page: facts => facts.links.some(link => /\bbook|schedul|appointment/.test(link)),
  },
  {
    id: 'reserve',
    line: 'reserve a table online',
    brief: answers => pagesOn(answers).has('reservations'),
    page: facts => facts.links.some(link => /reserv/.test(link)),
  },
  {
    id: 'order',
    line: 'order ahead online',
    brief: answers => pagesOn(answers).has('order_delivery'),
    page: facts => facts.links.some(link => /\border/.test(link)),
  },
  {
    id: 'quote',
    line: 'ask for a quote in a few taps',
    first: 'fills_a_form',
    brief: answers =>
      ['request_a_quote', 'free_inspection', 'request_measurements', 'free_consultation'].some(
        page => pagesOn(answers).has(page)
      ),
    page: facts => facts.links.some(link => /quote|estimate|inspection|consult|measure/.test(link)),
  },
  {
    id: 'menu',
    line: 'read the menu on a phone',
    brief: answers => pagesOn(answers).has('menu'),
    page: facts => facts.links.some(link => /\bmenu/.test(link)),
  },
  {
    id: 'services',
    line: 'see every service in one place',
    brief: answers =>
      pagesOn(answers).has('services') &&
      (Array.isArray(answers?.pages?.services) ? answers.pages.services.length : 0) >= 2,
    page: facts => facts.links.some(link => /service/.test(link)),
  },
  {
    id: 'towns',
    line: 'check which towns are covered',
    brief: answers =>
      ['service_areas', 'service_map', 'coverage_response'].some(page =>
        pagesOn(answers).has(page)
      ),
    page: facts => facts.links.some(link => /area|towns|service-map|coverage/.test(link)),
  },
  {
    id: 'reviews',
    line: 'read what other customers said',
    brief: answers => pagesOn(answers).has('reviews'),
    page: facts => facts.links.some(link => /review|testimonial/.test(link)),
  },
  {
    id: 'photos',
    line: 'look through real photos',
    brief: answers => ['gallery', 'before_after'].some(page => pagesOn(answers).has(page)),
    page: facts => facts.links.some(link => /gallery|photo|portfolio|before/.test(link)),
  },
  {
    id: 'message',
    line: 'send a message from the site',
    first: 'fills_a_form',
    brief: answers =>
      answers?.customers?.decision === 'fills_a_form' || pagesOn(answers).has('contact'),
    page: facts => facts.form,
  },
  {
    id: 'hours',
    line: 'check the hours before heading over',
    first: 'walks_in',
    brief: answers =>
      answers?.customers?.decision === 'walks_in' ||
      ['walk_ins', 'hours_holidays', 'find_us'].some(page => pagesOn(answers).has(page)),
    page: null,
  },
]

/** True of every site the studio builds, so they close any list that runs short. */
export const CLOSERS = [
  'find what they need on a phone',
  'get in touch without hunting for a number',
  'read every page without pinching to zoom',
]

/**
 * The three things a customer can do on the site, as verb phrases.
 *
 * @param {object} options
 * @param {object} options.answers `project_onboarding.answers`.
 * @param {{tel: boolean, sms: boolean, form: boolean, links: string[]}|null} options.facts
 *   What the live page carries, or null where it was not read.
 * @returns {string[]} Exactly three.
 */
export function launchLines({ answers, facts }) {
  const decision = answers?.customers?.decision
  const borne = entry =>
    entry.brief(answers ?? {}) && (!facts || entry.page === null || entry.page(facts))
  const ordered = [
    ...LINES.filter(entry => entry.first && entry.first === decision),
    ...LINES.filter(entry => !entry.first || entry.first !== decision),
  ]
  const picked = []
  for (const entry of ordered) {
    if (picked.length === 3) break
    if (!picked.includes(entry.line) && borne(entry)) picked.push(entry.line)
  }
  for (const closer of CLOSERS) if (picked.length < 3) picked.push(closer)
  return picked.slice(0, 3)
}

/** A line as the card sets it. */
export const asShown = line => line.charAt(0).toUpperCase() + line.slice(1)

/** Three phrases run into one: "a, b and c". */
const listed = items =>
  items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

/** The day a site went live, as a post says it: "October 13". */
export const dayOf = launchedAt => formatInstant(launchedAt, { month: 'long', day: 'numeric' })

/** The day in the top rail of a card or a video: "Oct 13, 2026". */
export const railDateOf = launchedAt =>
  formatInstant(launchedAt, { month: 'short', day: 'numeric', year: 'numeric' })

/** The same day with its year, as a card and an alt say it. */
export const dateOf = launchedAt =>
  formatInstant(launchedAt, { month: 'long', day: 'numeric', year: 'numeric' })

/** A name or a description closed with a stop, without doubling one it carries. */
const stopped = text => (/[.!?]$/.test(text) ? text : `${text}.`)

/**
 * Each channel's post for a launch.
 *
 * Two sentences and a next step. The first is what the business's customers
 * get from the new site, which is the reason a reader stops; the second is who
 * built it and when it went live, with the date written out because the post
 * may publish days after the launch and "this week" would then be wrong. The
 * Page and Instagram end on the number; the Business Profile leaves the asking
 * to its Learn more button and refuses a number anyway.
 *
 * @param {object} options
 * @param {boolean} options.named Whether the client said yes.
 * @param {string} options.who The business's name, or the description from `subjectOf`.
 * @param {string[]} options.lines From `launchLines`.
 * @param {string} options.launchedAt `projects.launched_at`.
 * @returns {Record<string, string>}
 */
export function launchTexts({ named, who, lines, launchedAt }) {
  const gets = `Customers of ${who} can now ${listed(lines)}.`
  const day = dayOf(launchedAt)
  const site = named ? 'the new site' : 'the site'
  return {
    facebook: `${gets}\nI built ${site}, and it went live on ${day}.\n\n${CALL}`,
    instagram: `${gets}\nI built ${site}, and it went live on ${day}.\n\n${CALL}`,
    googlebusiness: `${gets}\nTaylorURL built ${site} in Baytown, and it went live on ${day}.`,
  }
}

/** The address a site is read and shown at. */
export const siteUrl = domain => `https://${bareDomain(domain)}/`

/** Every way a named post may print the business: its name and its address. */
export const allowFor = ({ name, domain }) =>
  [name, domain ? bareDomain(domain) : null, domain ? `www.${bareDomain(domain)}` : null].filter(
    Boolean
  )

/** Where a launch's media is stored in the bucket. */
export const launchPaths = projectId => {
  const id = String(projectId).replace(/[^A-Za-z0-9-]/g, '')
  return {
    video: `launches/${id}-site.mp4`,
    still: `launches/${id}-site.png`,
    card: `launches/${id}-card.png`,
  }
}

/** What the anonymous card shows, as the `launch` template takes it. */
export function launchCardItem({ subject, lines, launchedAt }) {
  return {
    eyebrow: 'Just Launched',
    counter: railDateOf(launchedAt),
    headline: `A *new* site for ${subject.replace(/\*/g, '')}.`,
    listLabel: 'What Customers Can Do',
    items: lines.map(asShown),
    source: `Built by me in Baytown. Live since ${dateOf(launchedAt)}.`,
  }
}

/** What the named still shows, as the `launchSite` template takes it. */
export function launchStillItem({ name, domain, lines, launchedAt, shot }) {
  return {
    eyebrow: 'Just Launched',
    counter: railDateOf(launchedAt),
    headline: `*${name}* is live.`,
    domain: bareDomain(domain),
    listLabel: 'What Customers Can Do',
    items: lines.map(asShown),
    source: `Built by me in Baytown. Live since ${dateOf(launchedAt)}.`,
    shot,
  }
}

/** What a reader who cannot see the anonymous card is given: all of it, in order. */
export function launchCardAlt({ subject, lines, launchedAt }) {
  return `Just launched: a new site for ${subject}. What customers can do: ${lines.map(asShown).join('; ')}. Built by me in Baytown and live since ${dateOf(launchedAt)}.`
}

/** What a reader who cannot see the named still is given. */
export function launchStillAlt({ name, domain, lines, launchedAt }) {
  return `${stopped(`The new site for ${name}, open at ${bareDomain(domain)} on a phone`)} What customers can do: ${lines.map(asShown).join('; ')}. Built by me in Baytown and live since ${dateOf(launchedAt)}.`
}

/**
 * When each recorded picture is on screen in the video, in seconds from the
 * moment the recording starts playing.
 *
 * The load is played at the speed it happened, with the blank lead-in before
 * the first paint cut to `lead` at most: the page is shown loading as it
 * loaded, and a reader is not made to watch a white screen for the length of a
 * slow handshake. The settled page is held for `hold`, and the scroll down it
 * is then spread over `scrollFor` seconds, or whatever is left before `end`
 * less a `tail` to rest on. A load so slow that under half a second is left
 * plays without the scroll.
 *
 * @param {object} recording From `recordSite`: `load` as `{at, src}` in seconds
 *   from the navigation, `painted` the second of the first paint or null, and
 *   `scroll` as a list of `src`.
 * @param {object} [options]
 * @returns {{frames: {at: number, src: string}[], loaded: number}}
 */
export function frameTimeline(
  recording,
  { lead = 1, hold = 1.2, scrollFor = 4, tail = 0.5, end = 7.8 } = {}
) {
  const cut = Math.max(0, (recording.painted ?? 0) - lead)
  const frames = []
  for (const frame of recording.load) {
    const at = Math.max(0, frame.at - cut)
    if (at > end) break
    // Two pictures for one moment: the later is the one that was on screen.
    if (frames.length && Math.abs(frames.at(-1).at - at) < 1e-6) frames.pop()
    frames.push({ at, src: frame.src })
  }
  const loaded = frames.length ? frames.at(-1).at : 0
  const from = loaded + hold
  const span = Math.min(scrollFor, end - tail - from)
  const steps = recording.scroll.length
  if (span >= 0.5 && steps) {
    recording.scroll.forEach((src, index) =>
      frames.push({ at: from + (steps > 1 ? (index * span) / (steps - 1) : 0), src })
    )
  }
  return { frames, loaded }
}
