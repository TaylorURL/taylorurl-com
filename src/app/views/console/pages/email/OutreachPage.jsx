import { useCallback, useEffect, useMemo, useState } from 'react'
import { m } from 'framer-motion'
import { Ban, ChevronLeft, ChevronRight, ExternalLink, Pause, Play, Plus, X } from 'lucide-react'
import { fadeInUp } from '@constants/animations'
import { faultFromResponse, faultMessage, readsAsWritten } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'
import { useSession } from '@hooks/session/useSession'
import { writeEndpoint } from '@hooks/console/endpoint'
import { useOutreachFeed } from '@hooks/console/useOutreachFeed'
import {
  auditScore,
  hasNoSiteOfItsOwn,
  opportunityBand,
  OPPORTUNITY_BANDS,
} from '@utils/outreachOpportunity'
import {
  BOUNCE_STEPS_UNDER,
  FOLLOW_UP_DAYS,
  FOLLOW_UPS_PER_RUN,
  queueFloorFor,
  ROTATION_TARGET,
} from '../../../../../../lib/outreach/sending/limits.js'
import { ZONE } from '@lib/time/zone.js'
import { DELIVERS_A_DAY } from '@lib/outreach/sending/schedule.js'
import { SEGMENTS, segmentOf } from '@lib/outreach/segments.js'
import { isYoung, youthOf } from '@lib/outreach/prospects/youth.js'
import { ASKED_SOURCE } from '@lib/outreach/sending/rank.js'
import {
  Area,
  Badge,
  Board,
  ConsoleError,
  ConsolePage,
  ConsoleSplit,
  EmptyRow,
  Panel,
  PanelBody,
  PanelFoot,
  SectionNotice,
  SidePanel,
  SkeletonBar,
  SkeletonList,
  SkeletonRows,
  ViewNav,
} from '../../ui'
import {
  BUTTON,
  CELL_TIGHT as CELL,
  FIELD,
  MONO_LABEL,
  QUIET,
  SELECT,
  TH_TIGHT as TH,
} from '../../lib/tokens'
import { useView } from '../../lib/views'
import { Figures } from '../../Figures'
import { fullCount, percent } from '../../../analytics/lib/format'

/**
 * The cold email engine: what it found, what it sent, what came back, and
 * whether it is running at all.
 *
 * This is read rather than worked through, so it is ordered by how far a
 * figure is from needing attention. The strip is the state of the whole
 * pipeline, the pipeline is where the prospects have got to, and the mail list
 * is who is on file, who hears from the studio next, who heard from it last
 * and where one business is looked up - all five under one switch, since they
 * are the same list read at different moments.
 *
 * What the strip is about is the rotation. Outreach is one letter, an
 * introduction, sent to every business alike and sent again every month until
 * they reply or take themselves off, so the two figures that say whether it is
 * working are how many businesses are on that rotation and how many are queued
 * to join it. Both are drawn against a target - ROTATION_TARGET and
 * queueFloorFor in lib/outreach/sending/limits.js - because either one alone is a
 * number with nothing to be read against, and the queue falling under its floor
 * is the single reading that says the pipeline has stopped feeding the
 * rotation. The floor is the cap's own two days once the cap is set high
 * enough to need them, so raising the cap raises what the queue is read
 * against and the reading keeps meaning what it meant at the old figure.
 *
 * Nothing here splits, weights or holds anybody back. There was a time when
 * each segment drew a first letter from several by their shares, kept a share
 * of businesses aside to measure them against, and handed off to a different
 * letter at each step of a four-step chain; the console had a slider for every
 * part of it. All of that is gone, and what is left in its place is a list of
 * one letter and a record of what the retired ones brought back. The retired
 * letters are still here because every message they sent still names them.
 *
 * The section splits into views, one question each, and every view is laid
 * out to fit the room under the figures: what does not fit moves inside its
 * own card. The front carries the two readings that decide whether anything
 * is happening at all - whether sourcing is on and whether sending is on -
 * and the two things that open over it are the form that puts one business in
 * by hand and the profile of one business, which opens over the table it was
 * picked from.
 *
 * The strip is the section's own, and the section is marked in the catalogue
 * as carrying no traffic figures, so the six the console puts above every
 * other section are absent here. Visitors and bounce rate belong to a site
 * being read; this page is about businesses being written to.
 *
 * The pipeline is eleven stages against the fullest of them, one line each,
 * in two columns from the width the second one fits. Eleven stages is a shape
 * rather than eleven figures - where the work has piled up and where it has
 * stopped - so each row is a bar as long as its share and the definitions sit
 * behind a disclosure, which is what keeps the whole distribution inside one
 * card. Picking a stage opens the Prospects view narrowed to it.
 *
 * The mail list is worked out rather than stored. Nothing writes a queue down:
 * the order is the one the send job computes each time it runs, read here from
 * the same module without being acted on, and the times beside it come from the
 * schedule that spreads the day's cap across the sending window. So the list
 * says what will happen rather than what somebody wrote down that it would.
 *
 * Every state is a shape as well as a number. A stage is a badge rather than a
 * word in a column, and a stage a prospect can no longer move out of carries a
 * square mark inside its badge, so a table of ten stages is read at a glance
 * rather than word by word.
 *
 * The audit score is the one figure here that reads backwards. It measures how
 * fast a business's site is, and a slow site is the reason there is anything to
 * say to them, so the colour follows the opportunity rather than the site and
 * only the businesses worth acting on carry any: a fast site is not a fault, it
 * is simply not work, and colouring it would leave a page of them competing
 * with the leads for the same attention. No score is shown as a bare number,
 * because a bare number does not say which way it runs.
 *
 * Nothing here is what enforces any of it. The endpoint verifies the session,
 * refuses any account that is not an admin, holds the service role, and
 * validates every field before it reaches the database; this is the surface
 * those rules are worked through.
 */

/**
 * The eleven stages a prospect moves through, in the order it moves through
 * them.
 *
 * The last six are where one stops. `unsubscribed` is the only stage no job
 * may walk a prospect out of, because what put it there was a person asking.
 */
const STAGE = {
  found: { label: 'Found', tone: 'plain', caption: 'sourced, nothing looked up yet' },
  enriched: { label: 'Enriched', tone: 'plain', caption: 'an email address was found' },
  audited: {
    label: 'Audited',
    tone: 'plain',
    caption: 'the website has been scored, or there was none to score',
  },
  queued: {
    label: 'Queued',
    tone: 'accent',
    caption: 'a message is written and the transport has not answered',
  },
  contacted: { label: 'Contacted', tone: 'accent', caption: 'a message went out' },
  replied: { label: 'Replied', tone: 'good', caption: 'they wrote back' },
  unsubscribed: {
    label: 'Unsubscribed',
    tone: 'muted',
    mark: 'final',
    caption: 'they asked for no further contact, and the address is suppressed',
  },
  bounced: { label: 'Bounced', tone: 'warn', caption: 'the address did not accept' },
  unreachable: { label: 'Unreachable', tone: 'warn', caption: 'no address could be found' },
  undeliverable: {
    label: 'Undeliverable',
    tone: 'warn',
    caption: 'the address was checked before sending and cannot receive mail',
  },
  skipped: { label: 'Skipped', tone: 'muted', caption: 'taken out of the pipeline by hand' },
}

const STAGE_ORDER = [
  'found',
  'enriched',
  'audited',
  'queued',
  'contacted',
  'replied',
  'unsubscribed',
  'bounced',
  'unreachable',
  'undeliverable',
  'skipped',
]

/**
 * The three opportunity bands, and the row nothing has been measured on.
 *
 * Only a band worth acting on carries a tone, and the tone runs against the
 * score rather than with it: a slow site is a business with a problem worth a
 * message, so the worst band takes the good one and the middle band the warning
 * one. A fast site is not a fault. It is a business there is no work for, so it
 * carries no tone at all and sits in the column as plain faint text, which is
 * what keeps a screen of them quiet instead of turning the column into a wall
 * of alarms. A prospect nothing has been measured on carries no tone either,
 * and is told apart by having no figure to show.
 *
 * The cut points are the ones the score itself is banded at, which
 * `outreachOpportunity` holds.
 */
const OPPORTUNITY = {
  strong: {
    label: 'Strong',
    tone: 'good',
    caption: 'a slow site, which is the reason there is something to say',
  },
  fair: {
    label: 'Fair',
    tone: 'warn',
    caption: 'a middling site, which leaves something to improve',
  },
  weak: { label: 'Weak', tone: null, caption: 'a fast site, so there is little to offer' },
  none: {
    label: 'Not Scored',
    tone: null,
    caption: 'nothing has been scored for this business yet',
  },
}

/**
 * A business with no site of its own is the strongest lead there is, and
 * unscorable, keyed by which shape of it the row turned out to be.
 *
 * The row is in hand wherever this is read, so the sentence can say the true
 * thing rather than the one that covers both: a profile on somebody else's
 * platform is something a reader can be pointed at, and nothing at all is not,
 * and a caption that said profile to a business with none would be wrong in
 * front of the person deciding whether to write to it. A row carrying no kind
 * reached here through the platform host it listed, which is the first of the
 * two.
 */
const NO_SITE = {
  social: {
    reading: 'no site',
    caption: "no site of its own, only a profile on someone else's platform",
  },
  none: {
    reading: 'no site',
    caption: 'no site of its own and no page on a platform either',
  },
}

/**
 * The five readings a business's site can come to, keyed the way
 * lib/outreach/segments.js keys them.
 *
 * The band says how strong a lead is; the segment says what there is to say
 * to it, and it is the word the message a business gets is chosen on. It is
 * shown beside the band rather than in place of it, and carries no colour of
 * its own, because the band beside it already carries the one the row earns
 * and a second badge in the same colour would read as a second verdict.
 */
const SEGMENT = {
  'no-site': {
    label: 'No Site',
    caption: 'no site of its own to send a searcher to',
  },
  'slow-site': {
    label: 'Slow Site',
    caption: 'a site Google scores under 50 on mobile, which it files as poor',
  },
  'fair-site': {
    label: 'Fair Site',
    caption: 'a site scored 50 to 89, short of the good band that starts at 90',
  },
  'sound-site': {
    label: 'Sound Site',
    caption: 'a site scored 90 or over, with no speed fault to name',
  },
  unmeasured: {
    label: 'Unmeasured',
    caption: 'nothing has been measured for this business yet',
  },
}

/**
 * The three readings a listing's review count can come to, keyed the way
 * lib/outreach/prospects/youth.js keys them.
 *
 * Reviews are the one thing on a Google listing that only accumulates with time
 * and trade, so a business carrying almost none has either opened recently or
 * has never been visible enough to collect any. Those are the same sale and the
 * console does not try to separate them; what it does keep separate is a count
 * of nothing from no count at all, because a third of the table has never been
 * asked for the field and reading that silence as a zero would mark every row
 * the pipeline knows least about as the freshest lead on the page.
 *
 * Only 'young' earns a badge. The other two are the ordinary case and the
 * unknown case, and a column of chips that fires on every row says nothing.
 */
const YOUTH = {
  young: {
    label: 'Young',
    caption: 'under ten reviews, so it has either opened recently or never been visible',
  },
  established: {
    label: 'Established',
    caption: 'reviews enough that it has been trading and being found for a while',
  },
  unread: {
    label: 'Unread',
    caption: 'no review count on the row, so nothing here says how long it has traded',
  },
}

/**
 * A business that ran the speed check on its own site, which is the strongest
 * thing a row can say about itself.
 *
 * Every other reading on the page is the studio looking at a business. This one
 * is the business looking at itself and not liking what it found, at the moment
 * it was thinking about it, which is why it sits in front of every measured
 * site in the queue however well or badly that site scored.
 */
const ASKED = {
  label: 'Asked',
  caption: 'ran the speed check on its own site, so it found the problem itself',
}

/**
 * Where a prospect came from, in the console's words. The sweep files under
 * 'places' and the form under 'console'; a source the console has no word for
 * is shown as the row says it.
 */
const SOURCE = {
  places: 'Google Places',
  console: 'By Hand',
  [ASKED_SOURCE]: 'Speed Check',
}

/**
 * The three states a variant can be in. Only a live one is ever chosen. A
 * paused one keeps the businesses already holding it and takes no new ones,
 * and a draft is written but not yet sent under.
 */
const VARIANT_STATUS = {
  live: { label: 'Live', tone: 'good' },
  paused: { label: 'Paused', tone: 'muted' },
  draft: { label: 'Draft', tone: 'plain' },
}

/** The sentence that says which way the scale runs, wherever a score is shown. */
const SCALE =
  "A score is Google's mobile performance figure for the business's own site, out of 100. " +
  'The lower it runs, the slower the site and the stronger the lead.'

/**
 * How one prospect's audit score reads: which band it falls in, the figure
 * with its scale on it, and the sentence saying what that band means.
 */
function opportunityOf(prospect) {
  const band = OPPORTUNITY[opportunityBand(prospect)]
  if (hasNoSiteOfItsOwn(prospect)) {
    return { ...band, ...(NO_SITE[prospect.site_kind] ?? NO_SITE.social) }
  }
  const score = auditScore(prospect)
  return { ...band, reading: score === null ? null : `${score} / 100` }
}

/**
 * What each verification verdict found, said in full.
 *
 * The row stores a key, the same way it stores a stage, so the wording lives
 * beside every other piece of wording the section shows rather than in the
 * database. A key with no entry here is shown as it was stored, which is worth
 * more than an empty space.
 */
const CHECK_REASON = {
  malformed: 'not a valid email address',
  role_box: 'a mailbox that reaches nobody',
  not_a_person: "a shared inbox, not a person's",
  held_domain: 'a business held off outreach by request',
  disposable: 'a throwaway mail service',
  platform: "a booking platform's own address, not the business's",
  no_domain: 'the domain does not exist',
  no_mx: 'the domain has no mail server',
  dns_unavailable: 'the domain could not be looked up',
}

/**
 * What a message that never arrived says, where the reason it came back with
 * was written for a mail server rather than for anybody.
 *
 * A row records whatever the send threw, and that is a provider's own line -
 * an SMTP code, a policy URL, a thousand characters of it. The stage the row
 * sits at already says whether it failed on the way out or came back after.
 *
 * This is a log rather than a control, and the difference decides how the line
 * is read. `faultMessage` answers the question a person is asking while they
 * wait - what happened, and what to do about it - so it hands back live advice:
 * give it a moment, try again, check the address. Beside a send that failed on
 * Tuesday there is nothing to wait for and nothing to retry from this row, and
 * its table would go further and read a provider's stored 'Invalid login
 * credentials' as the reader's own sign-in being wrong. So a recorded failure
 * takes only the half of the door that keeps machine text out: the provider's
 * line if it reads as something a person could have written, and this sentence
 * if it does not.
 *
 * It reports and does not instruct, because the address is not known to be the
 * fault - a refusal at the studio's own transport lands in this column too.
 */
const NOT_DELIVERED = 'This message did not reach the address.'

/** A failure a row recorded earlier, with a provider's own machinery kept out. */
const asRecorded = said => (readsAsWritten(said) ? said : NOT_DELIVERED)

/** The three verdicts a check gives, and how each reads beside an address. */
const VERDICT = {
  deliverable: { label: 'Verified', tone: 'good' },
  undeliverable: { label: 'Undeliverable', tone: 'warn' },
  unknown: { label: 'Unchecked', tone: 'muted' },
}

/** How each message reads in the profile's timeline. */
const MESSAGE_STATUS = {
  drafted: { label: 'Drafted', tone: 'plain' },
  sent: { label: 'Sent', tone: 'accent' },
  failed: { label: 'Failed', tone: 'danger' },
  bounced: { label: 'Bounced', tone: 'warn' },
  received: { label: 'Received', tone: 'good' },
}

/**
 * The semantic tones, kept apart from the accent.
 *
 * The accent marks what a reader is meant to look at next, which is a
 * different question from whether a thing is healthy: a run that succeeded is
 * the one row on the page that never needs looking at.
 */
const TONE = {
  plain: 'text-paper-soft',
  muted: 'text-paper-faint',
  accent: 'text-accent',
  good: 'text-[color:var(--good)]',
  warn: 'text-[color:var(--warn)]',
  danger: 'text-[color:var(--danger)]',
}

/**
 * The same six tones as the console's badge carries them.
 *
 * The badge draws four grounds where this page names six states, so the two
 * quiet ones share the plain ground: neither is a condition worth a colour,
 * and what tells them apart is the word.
 */
const BADGE_TONE = {
  plain: 'plain',
  muted: 'plain',
  accent: 'accent',
  good: 'good',
  warn: 'warn',
  danger: 'bad',
}

// The endpoint holds the rule; the figure is here so the control can say what it
// will take before a value it refuses is typed into it. The daily cap has no
// figure of its own any more - that field takes whatever whole number is typed
// into it - so this is the town and trade lists alone.
const LIST_MAX = 100

/** A day and a clock time, for a stamp that is read rather than scanned. */
function stamp(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    timeZone: ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** The day alone, for a table column that has no room for the clock. */
function day(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    timeZone: ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** How long ago, in the coarsest unit that still says something useful. */
function since(value) {
  if (!value) return 'never'
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

// The add form with nothing in it, which is what it opens on and what it goes
// back to once a business has been filed. Every field is a string because
// every field is an input, and the endpoint reads a blank one as a field left
// out rather than as a value.
const BLANK_BUSINESS = {
  name: '',
  town: '',
  trade: '',
  website: '',
  address: '',
  phone: '',
  email: '',
}

/** Where a business typed in by hand is filed. */
const ADD_PATH = '/api/outreach-admin'

/** What a reader is told when the add did not reach the file at all. */
const NOT_ADDED = 'That business could not be added. Try it again.'

/** The two answers that are a refusal about a field rather than a failure. */
const REFUSED = new Set([400, 409])

/**
 * Which field an add is refused over.
 *
 * The endpoint measures the same fields this form does and answers one at a
 * time, naming it in its own words, so the sentence it sends back is read
 * under the input it is about. A name left out, an address that is not one and
 * a business already on file are each about the field the reader typed into,
 * and none of them is news to anybody looking anywhere else.
 */
const ADD_FIELD = [
  [/business name|already on file/i, 'name'],
  [/website/i, 'website'],
  [/contact address|left alone/i, 'email'],
]

/** The field a refusal names, or nothing where it names none of them. */
function fieldOf(said) {
  return ADD_FIELD.find(([mark]) => mark.test(said))?.[1] ?? null
}

/** A refusal, at the size the hints beside these fields are read at. */
const FAULT_NOTE = 'text-[12px] leading-relaxed text-[color:var(--danger-on-paper)]'

/** A saved settings row as the draft the form holds. */
function toDraft(settings) {
  return {
    daily_cap: String(settings.daily_cap ?? 0),
    towns: settings.towns || [],
    trades: settings.trades || [],
    from_name: settings.from_name || '',
    from_address: settings.from_address || '',
  }
}

/**
 * The names one piece of typing adds to a list.
 *
 * A town is typed in one at a time and pasted in by the dozen, so both a
 * newline and a comma end an entry. A name already on the list is dropped
 * whatever case it was typed in, since a second Kaufman is a second search of
 * the same town rather than a second town.
 */
function namesFrom(text, held) {
  const taken = new Set(held.map(name => name.toLowerCase()))
  const added = []
  for (const part of String(text || '').split(/[\n,]/)) {
    const name = part.trim()
    if (!name || taken.has(name.toLowerCase())) continue
    taken.add(name.toLowerCase())
    added.push(name)
  }
  return added
}

/**
 * A state as the console's badge, so a column of them reads as states rather
 * than words.
 *
 * The square mark in front of the word belongs to a state a prospect can no
 * longer move out of. A closed state is not a fault and takes no colour for
 * one, so the mark is what says the row is settled, which leaves the warning
 * colour to mean what it means everywhere else on the page.
 *
 * A badge holds one line and keeps its whole word. Given a column narrower
 * than the word it carries it takes the width it needs and the layout around
 * it gives way, rather than the word losing its last letters.
 */
function Chip({ tone, mark, children }) {
  return (
    <Badge tone={BADGE_TONE[tone] || 'plain'}>
      {mark === 'final' && (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-[1px] bg-current" />
      )}
      {children}
    </Badge>
  )
}

function StageChip({ stage }) {
  const known = STAGE[stage]
  if (!known) return <Chip tone="muted">{stage}</Chip>
  return (
    <Chip tone={known.tone} mark={known.mark}>
      {known.label}
    </Chip>
  )
}

/** The segment a business reads as, in a word, worked out from its row. */
function SegmentChip({ prospect }) {
  return <Chip tone="plain">{SEGMENT[segmentOf(prospect)].label}</Chip>
}

/**
 * Why a row is sent before the measured sites, where it is, and nothing where
 * it is not.
 *
 * The two readings are read in the order the send queue ranks them, and the
 * first one true is the whole of the answer: a business that asked is not then
 * also weighed on how young its listing looks, because the strongest thing true
 * about a row is its position. A row with neither reading gets no chip at all
 * rather than a word for being ordinary, which is what keeps the badge worth
 * looking for in a column fifty rows long.
 *
 * Plain, like the segment beside it. The opportunity mark on the same row
 * already carries the one colour the row earns, and a second coloured badge
 * would read as a second verdict on the same question.
 */
function AxisChip({ prospect }) {
  if (prospect?.source === ASKED_SOURCE) return <Chip tone="plain">{ASKED.label}</Chip>
  if (isYoung(prospect)) return <Chip tone="plain">{YOUTH.young.label}</Chip>
  return null
}

/**
 * A band and the figure behind it, together.
 *
 * A chip is what marks a business worth an hour, so only the two bands that are
 * carry one. The rest of the column is plain faint text on the same baseline,
 * which leaves the green and the amber the only things in a long table pulling
 * the eye.
 *
 * The figure carries its scale rather than standing alone, so a column of them
 * says what 34 is out of without the reader holding the range in their head.
 * Where there is no figure the slot is left empty, and that emptiness is what
 * separates a prospect nothing was measured on from a fast site: one line ends
 * in a number and the other ends where the word does.
 */
function OpportunityMark({ lead }) {
  const quiet = !lead.tone
  return (
    <span className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
      {quiet ? (
        /* The badge's own box without its ground, so a quiet band sits on the
           same baseline as the two that carry one and the column reads as one
           column. */
        <span className="text-paper-faint inline-flex flex-shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] font-semibold">
          {lead.label}
        </span>
      ) : (
        <Chip tone={lead.tone}>{lead.label}</Chip>
      )}
      {lead.reading && (
        <span
          className={`font-mono text-[12px] tabular-nums ${quiet ? 'text-paper-faint' : 'text-paper-soft'}`}
        >
          {lead.reading}
        </span>
      )}
    </span>
  )
}

/** One reading and the word for it, side by side on a line of them. */
function Meta({ label, value, tone }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`${MONO_LABEL} text-paper-faint`}>{label}</span>
      <span className={`font-mono text-[12px] tabular-nums ${tone || 'text-paper-soft'}`}>
        {value}
      </span>
    </span>
  )
}

/**
 * One stage as a bar the length of its share, under its name and its count.
 *
 * The bar is measured against the fullest stage rather than against the whole
 * table. A pipeline holds most of its prospects at one or two stages, so the
 * total as the scale draws every other stage as nothing and the shape that
 * matters - which stage is second, and where a handful sit - is lost.
 *
 * The bar runs the width of the row rather than sharing a line with the name,
 * because the row is half a card wide and a bar left the room after a name
 * and a figure at that width is a few pixels long whatever its share.
 *
 * The row is the control that narrows the prospects half of the mail list to
 * this stage, and picking the stage already showing widens it again, so the
 * same row both takes the filter and takes it off.
 */
function StageRow({ name, count, peak, picked, loading, onPick }) {
  const stage = STAGE[name]
  const empty = !count
  // The eleven stages and their order are known before any figure is; only
  // the bar and the count wait on the read. Standing a zero in for a figure
  // that has not arrived says the stage is empty, which is a different thing.
  if (loading) {
    return (
      <li aria-hidden="true">
        <div className="grid w-full gap-1 px-5 py-1.5">
          <span className="flex items-center justify-between gap-3">
            <span className={`${MONO_LABEL} text-paper-faint flex min-w-0 items-center gap-2`}>
              <span
                className={`h-1.5 w-1.5 shrink-0 bg-current ${stage.mark === 'final' ? 'rounded-[1px]' : 'rounded-full'}`}
              />
              <span className="truncate">{stage.label}</span>
            </span>
            <span className="block h-3 w-8 shrink-0 animate-pulse rounded-sm bg-paper-soft/15" />
          </span>
          <span className="block h-1.5 w-full animate-pulse rounded-sm bg-paper-soft/15" />
        </div>
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(picked ? '' : name)}
        aria-pressed={picked}
        className="grid w-full gap-1 px-5 py-1.5 text-left transition-colors duration-150 hover:bg-[color:var(--console-row-hover)] aria-pressed:bg-[color:var(--paper-hairline)]"
      >
        <span className="flex items-center justify-between gap-3">
          <span
            className={`${MONO_LABEL} flex min-w-0 items-center gap-2 ${empty ? 'text-paper-faint' : 'text-ink-paper'}`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 bg-current ${stage.mark === 'final' ? 'rounded-[1px]' : 'rounded-full'} ${TONE[stage.tone] || TONE.muted}`}
              aria-hidden="true"
            />
            <span className="truncate">{stage.label}</span>
          </span>
          <span
            className={`shrink-0 font-mono text-[12px] tabular-nums ${empty ? 'text-paper-faint' : 'text-paper-soft'}`}
          >
            {fullCount(count)}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="block h-1.5 w-full rounded-sm bg-[color:var(--paper-hairline)]"
        >
          <span
            className="block h-full rounded-sm bg-accent transition-[width] duration-150 ease-out-soft"
            style={{ width: `${peak ? (count / peak) * 100 : 0}%` }}
          />
        </span>
      </button>
    </li>
  )
}

/**
 * One figure about the businesses waiting on a first letter that the stage
 * counts above cannot give.
 *
 * A stage says where a business has got to. Neither of these does: they say how
 * much of what is waiting would be sent before the measured sites, and how much
 * of it reads as newly trading, both worked out from the row rather than stored
 * on it. So they sit under the stages instead of among them, and they read
 * rather than press, since there is no stage for them to narrow the table to.
 *
 * A figure that has not arrived waits as a placeholder rather than as a zero,
 * the same way the stages above do. A zero here would say the queue is holding
 * no strong leads at all, and that is the one reading off this panel somebody
 * would act on, by turning the sourcing up.
 */
function QueueFigure({ label, count, loading }) {
  return (
    <li className="flex items-baseline justify-between gap-3 px-5 py-1.5">
      <span className={`${MONO_LABEL} text-paper-faint min-w-0 truncate`}>{label}</span>
      {loading ? (
        <SkeletonBar className="w-8 shrink-0" />
      ) : (
        <span
          className={`shrink-0 font-mono text-[12px] tabular-nums ${count ? 'text-paper-soft' : 'text-paper-faint'}`}
        >
          {fullCount(count)}
        </span>
      )}
    </li>
  )
}

/**
 * A list of short names, edited as the list it is.
 *
 * Towns and trades are sixteen and twenty single words that the sourcing grid
 * multiplies together, so what an operator does to them is add one and take
 * one out. As lines in a box that is a whole-text edit every time, with no
 * count, no way to remove one without selecting exactly the right line, and a
 * trailing space that quietly makes a second Kaufman.
 *
 * Enter and a comma both end an entry, which is what makes a pasted list land
 * as a list, and backspace on an empty field takes back the last one added.
 */
// How many entries a list shows before it offers to stop. Sixteen towns beside
// sixteen trades is thirty-two removable chips in a column two hundred pixels
// wide, which wraps into forty rows and pushes everything under it off the
// screen - and none of it is being read while the table beside it is.
const LIST_PREVIEW = 6

function ListField({ label, note, placeholder, entries, max, onChange }) {
  const [typed, setTyped] = useState('')
  const [expanded, setExpanded] = useState(false)
  const full = entries.length >= max
  const hidden = expanded ? 0 : Math.max(entries.length - LIST_PREVIEW, 0)
  const shown = hidden ? entries.slice(0, LIST_PREVIEW) : entries

  const add = text => {
    const added = namesFrom(text, entries)
    if (added.length) {
      onChange([...entries, ...added].slice(0, max))
      // An entry filed straight out of sight reads as one that was not taken.
      setExpanded(true)
    }
    setTyped('')
  }

  const onKeyDown = event => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(typed)
      return
    }
    if (event.key === 'Backspace' && !typed && entries.length) {
      onChange(entries.slice(0, -1))
    }
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`${MONO_LABEL} text-paper-faint`}>{label}</span>
        <span className={`${MONO_LABEL} text-paper-faint tabular-nums`}>
          {fullCount(entries.length)} of {fullCount(max)}
        </span>
      </div>

      {entries.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {shown.map(name => (
            <li key={name}>
              <span
                className={`${MONO_LABEL} border-hair-paper inline-flex items-center gap-1.5 rounded-sm border bg-[color:var(--paper-field)] py-1.5 pl-2.5 pr-1.5 text-ink-paper`}
              >
                {name}
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => onChange(entries.filter(entry => entry !== name))}
                  className="text-paper-faint flex h-5 w-5 items-center justify-center rounded-sm transition-colors duration-150 hover:text-[color:var(--danger)]"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
          {hidden > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className={`${MONO_LABEL} border-hair-paper inline-flex items-center rounded-sm border border-dashed px-2.5 py-1.5 text-paper-soft transition-colors duration-150 hover:text-accent`}
              >
                {fullCount(hidden)} More
              </button>
            </li>
          )}
          {expanded && entries.length > LIST_PREVIEW && (
            <li>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className={`${MONO_LABEL} border-hair-paper inline-flex items-center rounded-sm border border-dashed px-2.5 py-1.5 text-paper-soft transition-colors duration-150 hover:text-accent`}
              >
                Show Fewer
              </button>
            </li>
          )}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={typed}
          disabled={full}
          onChange={event => setTyped(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(typed)}
          placeholder={full ? 'This list is full' : placeholder}
          className={`${FIELD} disabled:cursor-not-allowed disabled:opacity-50`}
        />
        <button
          type="button"
          disabled={full || !typed.trim()}
          aria-label={`Add to ${label}`}
          onClick={() => add(typed)}
          className={`${QUIET} justify-center px-2.5`}
        >
          <Plus className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <span className="text-paper-faint text-[12px] leading-relaxed">{note}</span>
    </div>
  )
}

/** One switch, the state it is in, and the sentence saying what that means. */
function Switch({ name, on, note, busy, loading, onToggle }) {
  // Off is what a switch reads as before its setting has been read back, and
  // it comes with a button offering to resume the thing that is already
  // running and a line stating that nothing is going out. Every part of the
  // row waits, including the button, since the state it would act on is the
  // one that is not known yet.
  if (loading) {
    return (
      <div className="border-hair-paper grid gap-2 border-b px-5 py-4 last:border-b-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2.5">
            <span className={`${MONO_LABEL} text-ink-paper`}>{name}</span>
            <SkeletonBar className="w-8" />
          </span>
          <SkeletonBar className="h-[38px] w-32" />
        </div>
        <SkeletonBar className="w-full max-w-[26rem]" />
      </div>
    )
  }
  return (
    <div className="border-hair-paper grid gap-2 border-b px-5 py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className={`${MONO_LABEL} text-ink-paper`}>{name}</span>
          <Chip tone={on ? 'good' : 'muted'}>{on ? 'On' : 'Off'}</Chip>
        </span>
        <button type="button" disabled={busy} onClick={onToggle} className={QUIET}>
          {on ? (
            <Pause className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Play className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          )}
          {on ? `Pause ${name}` : `Resume ${name}`}
        </button>
      </div>
      <p className="text-[13px] leading-relaxed text-paper-soft">{note}</p>
    </div>
  )
}

/**
 * What the deliverability check made of an address, under the address itself.
 *
 * Every address is checked before a message is written for it, so a business
 * that was never written to says here why rather than only in a run record. A
 * row checked before the columns existed shows nothing, which is honest: no
 * reading was taken.
 */
function Verdict({ prospect }) {
  const verdict = VERDICT[prospect.email_verdict]
  if (!verdict) return null
  // Only a reason there are words for is read back. The column holds the
  // checker's own key, and a key nothing here names prints as a key - the
  // chip beside it already carries the verdict, so a row whose reason has no
  // sentence yet says the verdict and stops, the same way a row checked
  // before the columns existed says nothing at all.
  const said = CHECK_REASON[prospect.email_check_reason]
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <Chip tone={verdict.tone}>{verdict.label}</Chip>
      {said && <span className="text-[12px] text-paper-soft">{said}</span>}
      {prospect.email_checked_at && (
        <span className={`${MONO_LABEL} text-paper-faint`}>{stamp(prospect.email_checked_at)}</span>
      )}
    </span>
  )
}

/**
 * One labelled fact in a profile.
 *
 * The column is named rather than left implicit, because an implicit track is
 * sized to the longest thing in it and a value with no length of its own - a
 * URL, an address - widens the cell past the column it was given and prints
 * over the fact beside it. Named, the track floors at nothing and the value
 * inside it is the thing that gives way.
 */
function Fact({ label, children }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1">
      <span className={`${MONO_LABEL} text-paper-faint`}>{label}</span>
      <span className="break-words text-[13px] text-ink-paper">{children ?? '—'}</span>
    </div>
  )
}

/**
 * A value with no length of its own - an address, a URL, a subject line - held
 * to one line, with the whole of it on hover.
 *
 * A panel of eighteen facts in two columns is read across as much as down, and
 * a value that wraps to three lines pushes the fact under it out of step with
 * the one beside it for the length of the panel.
 */
function Capped({ children }) {
  return (
    <span className="block truncate" title={typeof children === 'string' ? children : undefined}>
      {children}
    </span>
  )
}

/**
 * A run of facts under the one word for what they have in common.
 *
 * A profile drawn as one grid of eighteen equal cells is eighteen things of
 * equal weight, and a reader looking for the address reads the place id on the
 * way. Grouped, the same facts are three short lists, each answering a
 * question a reader arrives with: how to reach it, what it is worth, what has
 * already happened to it. Two columns, which is what the panel's width holds.
 */
function Group({ name, aside, columns = 'sm:grid-cols-2', children }) {
  return (
    <section className="border-hair-paper border-b px-5 py-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={`${MONO_LABEL} text-ink-paper`}>{name}</h3>
        {aside ? <p className={`${MONO_LABEL} text-paper-faint`}>{aside}</p> : null}
      </header>
      <div className={`grid gap-4 ${columns}`}>{children}</div>
    </section>
  )
}

/**
 * One message, in full.
 *
 * The body is shown whole rather than trimmed, because reading the exact
 * wording before it goes out is what the timeline is for, and a message that
 * has not been sent yet is the one that most needs reading.
 */
function Message({ message, step, letters, onOpenLetter }) {
  const status = MESSAGE_STATUS[message.status]
  const inbound = message.direction === 'inbound'
  return (
    <li className="border-hair-paper grid gap-2.5 border-t px-5 py-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Chip tone={inbound ? 'good' : 'plain'}>{inbound ? 'Inbound' : 'Outbound'}</Chip>
        {!inbound && step ? (
          <Chip tone={step > 1 ? 'accent' : 'plain'}>{stepLabel(step)}</Chip>
        ) : null}
        {!inbound && message.variant_id ? (
          <LetterLink id={message.variant_id} letters={letters} onOpen={onOpenLetter} />
        ) : null}
        <Chip tone={status ? status.tone : 'muted'}>{status ? status.label : message.status}</Chip>
        {message.intent === 'opt_out' && (
          <Chip tone="muted" mark="final">
            Opt-Out
          </Chip>
        )}
        <span className={`${MONO_LABEL} text-paper-faint`}>
          {stamp(message.sent_at || message.created_at)}
        </span>
      </div>

      <p
        className="truncate text-[13px] font-medium text-ink-paper"
        title={message.subject || undefined}
      >
        {message.subject || 'No subject'}
      </p>

      <p
        className={`${MONO_LABEL} text-paper-faint truncate`}
        title={`${message.from_address || '—'} to ${message.to_address || '—'}`}
      >
        {message.from_address || '—'} to {message.to_address || '—'}
      </p>

      {!inbound && message.status === 'sent' && <Reach row={message} />}

      <pre className="border-hair-paper overflow-x-auto whitespace-pre-wrap break-words rounded-sm border bg-[color:var(--paper-field)] px-3 py-2.5 font-mono text-[12px] leading-relaxed text-paper-soft">
        {message.body_text || 'This message has no body text.'}
      </pre>

      {message.intent === 'opt_out' && (
        <div className="border-hair-paper grid gap-1.5 rounded-sm border px-3 py-2.5">
          <span className={`${MONO_LABEL} text-ink-paper`}>Opt-Out</span>
          <p className="text-[13px] leading-relaxed text-paper-soft">
            This reply was read as a request for no further contact. The business sits at the
            unsubscribed stage and the address is suppressed against every list.
          </p>
          <p className="font-mono text-[12px] leading-relaxed text-ink-paper">
            {message.intent_phrase
              ? `read from \u201c${message.intent_phrase}\u201d`
              : 'the wording it was read from was not recorded'}
          </p>
        </div>
      )}

      {message.error && (
        <p className="text-[13px] leading-relaxed text-[color:var(--danger)]">
          {asRecorded(message.error)}
        </p>
      )}
    </li>
  )
}

/**
 * A clock time alone, for a schedule read against the hour it is now.
 *
 * The hour it is now is the one in Texas, which is what the window either side
 * of this list is stated in. Read off the reader's own clock instead, a slot
 * inside an 8-to-5 window prints outside it.
 */
function clock(value) {
  if (!value) return null
  return new Date(value).toLocaleTimeString('en-US', {
    timeZone: ZONE,
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** The segments the panel lists, strongest lead first. */
/**
 * A step of the chain, in words: the first letter, or which reminder and the
 * day it goes.
 *
 * The letter repeats rather than handing off to a different one, so a step
 * past the first is the same words arriving again and is named as such.
 */
const stepLabel = step =>
  (step ?? 1) === 1 ? 'First Letter' : `Reminder ${step - 1}, Day ${(step - 1) * FOLLOW_UP_DAYS}`

/** The step a message was written at: the row's own, or read off the letter it names. */
const stepOfMessage = (message, letters) =>
  message.step ?? letters.find(entry => entry.id === message.variant_id)?.step ?? null

/**
 * The marks beside a letter's name. The accent belongs to the one that sends;
 * a retired letter takes the ink, since it is a record rather than something
 * running.
 */
const SENDING_TONE = 'bg-[color:var(--accent-fill)]'
const RETIRED_TONE = 'bg-[color:var(--paper-ink-faint)] opacity-40'

/**
 * One switch: on or off, and nothing else to read.
 *
 * A letter is either being sent to new businesses or it is not, and a control
 * with a third state to pick from was a question nobody needed answered. A
 * draft, which the registry allows, reads as off and is turned on the same
 * way a paused letter is.
 */
function Toggle({ on, label, busy, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={on ? 'Sending' : 'Off'}
      disabled={busy}
      onClick={() => onChange(!on)}
      className="console-toggle"
    />
  )
}

/**
 * One letter in the list: its name, which puts it on the stage, what it says
 * in a sentence, and whether it is being sent. Everything else about the
 * letter is on the stage, where there is room to read it.
 *
 * A retired letter carries no switch. It is listed because every message it
 * sent still names it, which is a record to read rather than a decision left
 * to make, and a switch beside it is one stray press away from putting a
 * letter nobody has read in years back on the rotation. Bringing one back is
 * a change to the registry in lib/outreach/variants.js, where the words are.
 */
function LetterRow({ variant, tone, selected, retired, saving, onOpen, onSet }) {
  const on = variant.status === 'live'
  return (
    <li
      className={`flex items-start justify-between gap-3 px-5 py-3 ${selected ? 'bg-[color:var(--paper-field)]' : ''}`}
      aria-current={selected ? 'true' : undefined}
    >
      <button
        type="button"
        onClick={() => onOpen(variant.id)}
        className="min-w-0 flex-1 cursor-pointer text-left transition-colors duration-150 ease-out-soft hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-2 w-2 flex-shrink-0 rounded-[1px] ${tone}`} />
          <span className="truncate text-[13px] font-medium text-ink-paper">{variant.name}</span>
        </span>
        <span className="text-paper-faint block text-[11px] leading-relaxed">
          {variant.about}
          {variant.condition ? ` Only where ${variant.condition}.` : ''}
        </span>
      </button>
      {retired ? null : (
        <Toggle
          on={on}
          label={`Send ${variant.name}`}
          busy={saving}
          onChange={next => onSet({ status: next ? 'live' : 'paused' })}
        />
      )}
    </li>
  )
}

/** What the stage says about the business a letter was rendered for. */
function renderedFor(preview) {
  const business = preview?.prospect
  if (!business) return ''
  const place = business.town ? `, ${business.town}` : ''
  const standing = business.queued
    ? 'next in the queue for this letter'
    : 'on file in this segment, with none waiting'
  return `Rendered for ${business.name}${place}, ${standing}.`
}

/**
 * The letter chosen in the panel, drawn as it would arrive.
 *
 * Both halves of the message, the one action a letter has, and what the list
 * beside it does not have room to say: the business it was rendered for, the
 * condition it is sent under, and what it has brought back so far.
 */
function LetterSheet({
  variant,
  preview,
  rendering,
  part,
  onPart,
  onProof,
  proofing,
  proofed,
  results,
  onResults,
}) {
  // A letter written for one kind of site names it. The letter that sends is
  // written for none: it is registered against every segment because that is
  // how the registry is keyed, and it says the same words to all of them, so
  // naming one here would read as a letter that goes to a fifth of the list.
  const everyone = variant?.family === 'introduction'
  const segment = variant && !everyone ? SEGMENT[variant.segment] : null
  const state = variant ? VARIANT_STATUS[variant.status] : null
  const ready = Boolean(preview && !preview.error && !rendering)
  // Why the letter is not on the stage, where the render came back with a
  // reason instead of a message. It is a sentence rather than a subject, so it
  // is read in the body, which has the room for one, and stands in place of
  // the bars that would otherwise say a message is still on its way.
  const unrendered = rendering ? null : (preview?.error ?? null)
  // What this letter has brought back so far, on the sheet rather than a
  // table away, so a letter is read beside what it does.
  const record = results
    ? `Sent ${fullCount(results.sent)}, opened ${fullCount(results.opened)}, replied ${fullCount(results.replied)}, ${fullCount(results.enquired)} inquiries.`
    : ''

  return (
    <>
      <header className="border-hair-paper grid flex-shrink-0 gap-2 border-b px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold tracking-tight text-ink-paper">
              {variant?.name ?? 'Letter'}
            </span>
            {segment ? <Chip tone="plain">{segment.label}</Chip> : null}
            {everyone ? <Chip tone="plain">Every Business</Chip> : null}
            {variant ? <Chip tone="plain">{stepLabel(variant.step)}</Chip> : null}
            {state ? <Chip tone={state.tone}>{state.label}</Chip> : null}
          </span>
          <span className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPart('html')}
              className={part === 'html' ? BUTTON : QUIET}
            >
              Laid Out
            </button>
            <button
              type="button"
              onClick={() => onPart('text')}
              className={part === 'text' ? BUTTON : QUIET}
            >
              Plain Text
            </button>
            {onResults ? (
              <button type="button" onClick={onResults} className={QUIET}>
                Results
              </button>
            ) : null}
            <button
              type="button"
              disabled={proofing || !ready}
              onClick={() => onProof(variant.id)}
              className={BUTTON}
            >
              {proofing ? 'Sending' : 'Send Me a Proof'}
            </button>
          </span>
        </div>
        <div className="grid gap-0.5">
          <span className="truncate text-[12px] font-medium text-ink-paper">
            {rendering ? 'Rendering' : (preview?.subject ?? '')}
          </span>
          <span className="text-paper-faint text-[11px] leading-relaxed">
            {ready ? renderedFor(preview) : ''}
            {variant?.condition ? ` Sent only where ${variant.condition}.` : ''}
            {record ? ` ${record}` : ''}
            {proofed ? ` A proof went to ${proofed.to}.` : ''}
          </span>
        </div>
      </header>
      <div className="min-h-0 flex-1 bg-[color:var(--paper-field)]">
        {unrendered ? (
          <p
            role="status"
            className="px-5 py-4 text-[13px] leading-relaxed text-[color:var(--danger-on-paper)]"
          >
            {unrendered}
          </p>
        ) : !ready ? (
          <div className="grid gap-3 px-5 py-4">
            <SkeletonBar className="w-full max-w-[26rem]" />
            <SkeletonBar className="w-full max-w-[22rem]" />
          </div>
        ) : part === 'html' ? (
          <iframe
            title="The letter as it would arrive"
            sandbox=""
            srcDoc={preview.html}
            className="console-letter h-full w-full"
          />
        ) : (
          <pre className="h-full overflow-auto whitespace-pre-wrap p-5 font-mono text-[12px] leading-relaxed text-ink-paper">
            {preview.text}
          </pre>
        )}
      </div>
    </>
  )
}

/**
 * The halves of the mail list: what has not gone yet, what has, what came back
 * undelivered, what went out under each variant, and every business on file
 * the rest of it is drawn from.
 */
const MAIL_TABS = [
  { key: 'next', label: 'Next Out' },
  { key: 'past', label: 'Sent' },
  { key: 'bounces', label: 'Bounces' },
  { key: 'variants', label: 'Results' },
  { key: 'prospects', label: 'Prospects' },
]

/**
 * The trailing hard-bounce rate the daily cap may rise under.
 *
 * At or above it the sending domain is taking damage that the outreach and the
 * client mail share, so the figure is drawn as a warning rather than as one
 * more percentage on the row. It is the ramp's own threshold rather than a
 * second copy of it: a console warning that disagreed with the figure the cap
 * actually moves on would be worse than no warning.
 */
const BOUNCE_LIMIT = BOUNCE_STEPS_UNDER

/**
 * The width a column stays on down to.
 *
 * Nothing in this section scrolls sideways. A table dragged left to reach its
 * last column loses the row it was opened for on the way back, and a column
 * hidden past the edge of a card is a column a reader has no reason to look
 * for. So every table is fixed to the width it is given, and the columns a row
 * can be read without give way as that width goes - each of them folded back
 * into the one column that never does, so nothing is lost with the column.
 *
 * The steps are the console's own, not the window's, and the two do not run
 * together. The column of sections is a drawer up to 1024px and a fifteen-rem
 * rail from there, so the work is 991px wide at 1023 and 720px at 1024: a
 * column let back in at `lg` comes back to less room than it left. These are
 * the four widths where the work actually gains, and `lg` is not one of them.
 *
 *   the work column   358   608   736   720   976   1232   1408
 *   the window        390   640   768  1024  1280   1536   1728
 */
const FROM_SM = 'hidden sm:table-cell'
const FROM_MD = 'hidden md:table-cell'
const FROM_XL = 'hidden xl:table-cell'
const FROM_2XL = 'hidden 2xl:table-cell'

/**
 * Each half's cells in order, as the classes they take.
 *
 * The placeholder rows are drawn from the same list. A placeholder holding
 * cells the head above it has dropped draws the table one width while it loads
 * and another once the rows land, which is the shift the placeholder is there
 * to prevent.
 */
const COLUMNS = {
  next: [
    `${CELL} whitespace-nowrap`,
    `${CELL} ${FROM_XL}`,
    CELL,
    `${CELL} ${FROM_2XL}`,
    `${CELL} ${FROM_MD}`,
    `${CELL} ${FROM_XL}`,
  ],
  past: [
    `${CELL} ${FROM_SM}`,
    CELL,
    `${CELL} ${FROM_2XL}`,
    `${CELL} ${FROM_XL}`,
    `${CELL} ${FROM_2XL}`,
    CELL,
    `${CELL} ${FROM_MD}`,
  ],
  bounces: [CELL, `${CELL} ${FROM_SM}`, CELL, CELL],
  prospects: [CELL, `${CELL} ${FROM_MD}`, `${CELL} ${FROM_XL}`, `${CELL} ${FROM_SM}`, CELL],
  variants: [
    CELL,
    `${CELL} ${FROM_XL}`,
    `${CELL} ${FROM_MD}`,
    `${CELL} ${FROM_2XL}`,
    CELL,
    `${CELL} ${FROM_MD}`,
    `${CELL} ${FROM_XL}`,
    CELL,
    `${CELL} ${FROM_2XL}`,
  ],
}

/** One day of sending, against what came back undelivered. */
function BounceRow({ row }) {
  const over = row.rate !== null && row.rate >= BOUNCE_LIMIT
  return (
    <tr className="border-hair-paper border-t align-top">
      <td className={`${CELL} whitespace-nowrap text-paper-soft`}>
        {row.date}
        <span className={`${MONO_LABEL} text-paper-faint mt-1 block sm:hidden`}>
          {fullCount(row.sent)} sent
        </span>
      </td>
      <td className={`${CELL} ${FROM_SM} tabular-nums`}>{fullCount(row.sent)}</td>
      <td className={CELL}>
        {row.bounced ? <Chip tone="warn">{fullCount(row.bounced)}</Chip> : '—'}
      </td>
      <td
        className={`${CELL} tabular-nums ${over ? 'text-[color:var(--warn)]' : 'text-paper-soft'}`}
      >
        {row.rate === null ? '—' : percent(row.rate)}
      </td>
    </tr>
  )
}

// The letters switched on for one kind at one step. `repeats` is the half a
// step number cannot carry: the letter that sends is registered at step one
// and stands at every step after it, which is what a monthly reminder is. This
// is `sendsAt` in lib/outreach/variants.js, which is what the sender asks, and
// reading `step` alone here reported every reminder in the queue as having no
// letter switched on for it.
const sendsAt = (entry, step) =>
  entry.repeats ? step >= (entry.step ?? 1) : (entry.step ?? 1) === step

/** The letters switched on for one kind at one step, which is what a draw is made among. */
const lettersAt = (letters, segment, step) =>
  letters.filter(
    entry =>
      !entry.holdout && entry.segment === segment && sendsAt(entry, step) && entry.status === 'live'
  )

/**
 * A letter's name as the way to it, on the stage in the Letters view. An id
 * the registry no longer knows is shown as the id, since the messages sent
 * under it are still messages that went out.
 */
function LetterLink({ id, letters, onOpen }) {
  const letter = letters.find(entry => entry.id === id)
  if (!letter) return <span className="text-paper-faint break-all font-mono text-[12px]">{id}</span>
  return (
    <button
      type="button"
      onClick={() => onOpen(letter.id)}
      className="break-words text-left font-medium text-ink-paper transition-colors duration-150 hover:text-accent"
    >
      {letter.name}
    </button>
  )
}

/** The kind a business reads as, with the figure that put it there. */
function KindCell({ segment, score }) {
  const kind = SEGMENT[segment] ?? SEGMENT.unmeasured
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Chip tone="plain">{kind.label}</Chip>
      {typeof score === 'number' ? (
        <span className="font-mono text-[12px] tabular-nums text-paper-soft">{score} / 100</span>
      ) : null}
    </span>
  )
}

/**
 * Which letter a queued business is owed, and under what subject.
 *
 * It is its own piece because it is read in two places: its column, and folded
 * under the business name at the widths that column is gone. Written twice it
 * would drift, and a queue that names one letter wide and another narrow is a
 * queue that cannot be trusted either way.
 */
function QueueLetter({ row, step, letters, onOpenLetter }) {
  const following = step > 1
  const drawn = lettersAt(letters, row.segment, step)
  return (
    <>
      <span className="flex flex-wrap items-center gap-2">
        <Chip tone={following ? 'accent' : 'plain'}>{stepLabel(step)}</Chip>
        {row.variant_id ? (
          <LetterLink id={row.variant_id} letters={letters} onOpen={onOpenLetter} />
        ) : row.ends ? (
          <span className="text-paper-faint text-[13px]">the chain ends here</span>
        ) : drawn.length ? (
          /* One letter is switched on for this kind, so the row names it. A
             draw is only a draw where there is more than one to draw among,
             and there has been one letter since the split came out. */
          <span className="flex flex-wrap items-center gap-x-1.5 text-[13px]">
            {drawn.length > 1 ? <span className="text-paper-faint">drawn from</span> : null}
            {drawn.map((entry, at) => (
              <span key={entry.id}>
                <LetterLink id={entry.id} letters={letters} onOpen={onOpenLetter} />
                {at + 1 < drawn.length ? ',' : ''}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-paper-faint text-[13px]">
            no letter is switched on for this kind
          </span>
        )}
      </span>
      {row.subject ? (
        <span className="mt-1.5 grid gap-1">
          <span className="text-paper-faint block truncate text-[12px]" title={row.subject}>
            {row.subject}
          </span>
          {row.variant_id ? (
            <span className="justify-self-start">
              <Chip tone="plain">Drafted</Chip>
            </span>
          ) : (
            <span className="text-paper-faint text-[12px]">
              an old draft, written again under a letter when it goes
            </span>
          )}
        </span>
      ) : following && row.first_subject ? (
        <span
          className="text-paper-faint mt-1.5 block truncate text-[12px]"
          title={row.first_subject}
        >
          under {row.first_subject}
        </span>
      ) : null}
    </>
  )
}

/**
 * A business about to be written to: when, its place in the line, the kind
 * it reads as, the letter it gets and where the letter goes.
 *
 * The day's cap is spread across the sending window rather than sent in one
 * burst, so every place in the queue has a time attached to it. A time already
 * past is one the next run catches up on, which is a different thing from a
 * time that has not come yet, and the two are told apart by the mark rather
 * than by the reader comparing a clock.
 *
 * Which letter goes is settled at different moments. A draft names the letter
 * it was written under; a business with none is drawn one from the letters
 * switched on for its kind and step when it goes, so the row names those
 * instead. A draft written before the letters existed names none and is
 * written again under one when it goes. A follow-up is owed a step rather
 * than a letter, and threads under the first letter the row names beneath.
 */
function NextRow({ row, place, letters, onOpenProspect, onOpenLetter }) {
  const due = row.due_at ? new Date(row.due_at).getTime() : null
  const now = Date.now()
  const step = row.step ?? 1
  return (
    <tr className="border-hair-paper border-t align-top">
      <td className={`${CELL} whitespace-nowrap`}>
        {due === null ? (
          <span className="text-paper-faint text-[13px]">after today</span>
        ) : due <= now ? (
          <Chip tone="accent">Due Now</Chip>
        ) : (
          <span className="font-mono text-[13px] tabular-nums text-paper-soft">
            {clock(row.due_at)}
          </span>
        )}
      </td>
      <td className={`${CELL} text-paper-faint ${FROM_XL} font-mono text-[12px] tabular-nums`}>
        {place === null ? '—' : fullCount(place + 1)}
      </td>
      <td className={CELL}>
        <button
          type="button"
          onClick={() => onOpenProspect(row.prospect_id)}
          title={row.name || 'Unnamed business'}
          className="block w-full truncate text-left font-medium text-ink-paper transition-colors duration-150 hover:text-accent"
        >
          {row.name || 'Unnamed business'}
        </button>
        <span className={`${MONO_LABEL} text-paper-faint block truncate`}>
          {[row.town, row.trade].filter(Boolean).join(' · ') || '—'}
        </span>
        {/* What the dropped columns were carrying, folded back under the name
            at the widths they are gone. */}
        <span className="mt-1.5 grid gap-1.5 2xl:hidden">
          <KindCell segment={row.segment} score={row.audit_score} />
          <span className={`${MONO_LABEL} text-paper-faint block truncate xl:hidden`}>
            {row.to_address}
          </span>
          <span className="grid gap-1 md:hidden">
            <QueueLetter row={row} step={step} letters={letters} onOpenLetter={onOpenLetter} />
          </span>
        </span>
      </td>
      <td className={`${CELL} ${FROM_2XL}`}>
        <KindCell segment={row.segment} score={row.audit_score} />
      </td>
      <td className={`${CELL} ${FROM_MD}`}>
        <QueueLetter row={row} step={step} letters={letters} onOpenLetter={onOpenLetter} />
      </td>
      <td className={`${CELL} ${FROM_XL}`}>
        <span className="block truncate text-paper-soft" title={row.to_address}>
          {row.to_address}
        </span>
      </td>
    </tr>
  )
}

/**
 * Whether a message was read and whether a link in it was followed.
 *
 * An open is a lower bound and a noisy one: a mail client that fetches images
 * before a person sees the message counts as one, and a reader with images off
 * never counts at all. A click is firmer. An inquiry is the only one of the
 * three that is the outcome itself rather than a sign of it, so it leads and
 * carries the mark, the click holds the tone behind it, and the open sits last
 * as plain text. None is shown as a dash where there is nothing, because an
 * empty slot beside a message that did land is the reading - nothing came
 * back.
 */
function Reach({ row }) {
  const opens = row.open_count || 0
  const clicks = row.click_count || 0
  const inquiries = row.enquiry_count || 0
  if (!row.opened_at && !row.clicked_at && !row.enquired_at) {
    return <span className="text-paper-faint text-[13px]">not yet</span>
  }
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {row.enquired_at && (
        <Chip tone="accent" mark="final">
          {inquiries > 1 ? `Inquired ${fullCount(inquiries)}x` : 'Inquired'}
        </Chip>
      )}
      {row.clicked_at && (
        <Chip tone="good">{clicks > 1 ? `Clicked ${fullCount(clicks)}x` : 'Clicked'}</Chip>
      )}
      {row.opened_at && (
        <span className={`${MONO_LABEL} text-paper-soft`} title={`first ${stamp(row.opened_at)}`}>
          {opens > 1 ? `Opened ${fullCount(opens)}x` : 'Opened'}
        </span>
      )}
    </span>
  )
}

/** A message that has already left, which letter it was, and what became of it. */
function PastRow({ row, letters, onOpenProspect, onOpenLetter }) {
  const status = MESSAGE_STATUS[row.status]
  const step = row.step ?? stepOfMessage(row, letters) ?? 1
  // Read once and drawn in two places: the failure sits in the subject column
  // where there is room for it, and moves under the state chip at the widths
  // that column is gone.
  const fault = row.error ? asRecorded(row.error) : null
  return (
    <tr className="border-hair-paper border-t align-top">
      <td className={`${CELL} ${FROM_SM} text-paper-soft`}>
        {stamp(row.sent_at || row.created_at)}
      </td>
      <td className={CELL}>
        <button
          type="button"
          onClick={() => onOpenProspect(row.prospect_id)}
          title={row.name || 'Unnamed business'}
          className="block w-full truncate text-left font-medium text-ink-paper transition-colors duration-150 hover:text-accent"
        >
          {row.name || 'Unnamed business'}
        </button>
        <span className={`${MONO_LABEL} text-paper-faint block truncate`}>{row.town || '—'}</span>
        {/* What the dropped columns were carrying, folded back under the name
            at the widths they are gone. */}
        <span className="mt-1.5 grid gap-1.5 2xl:hidden">
          <span className={`${MONO_LABEL} text-paper-faint sm:hidden`}>
            {stamp(row.sent_at || row.created_at)}
          </span>
          <span className="block truncate text-[13px] text-paper-soft xl:hidden">
            {row.subject || 'No subject'}
          </span>
          <span className={`${MONO_LABEL} text-paper-faint block truncate`}>
            {row.to_address || '—'}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone={step > 1 ? 'accent' : 'plain'}>{stepLabel(step)}</Chip>
            {row.variant_id ? (
              <LetterLink id={row.variant_id} letters={letters} onOpen={onOpenLetter} />
            ) : (
              <span className="text-paper-faint text-[13px]">before the letters</span>
            )}
          </span>
          <span className="md:hidden">{row.status === 'sent' ? <Reach row={row} /> : null}</span>
        </span>
      </td>
      <td className={`${CELL} ${FROM_2XL}`}>
        <span className="block truncate text-paper-soft" title={row.to_address || ''}>
          {row.to_address || '—'}
        </span>
      </td>
      <td className={`${CELL} ${FROM_XL}`}>
        <span className="block truncate text-paper-soft" title={row.subject || ''}>
          {row.subject || 'No subject'}
        </span>
        {fault && (
          <span className="block break-words text-[12px] leading-relaxed text-[color:var(--danger)]">
            {fault}
          </span>
        )}
      </td>
      <td className={`${CELL} ${FROM_2XL}`}>
        <span className="flex flex-wrap items-center gap-2">
          <Chip tone={step > 1 ? 'accent' : 'plain'}>{stepLabel(step)}</Chip>
          {row.variant_id ? (
            <LetterLink id={row.variant_id} letters={letters} onOpen={onOpenLetter} />
          ) : (
            <span className="text-paper-faint text-[13px]">before the letters</span>
          )}
        </span>
      </td>
      <td className={CELL}>
        <Chip tone={status ? status.tone : 'muted'}>{status ? status.label : row.status}</Chip>
        {/* The failure belongs beside the state it explains once the column
            holding it is gone. */}
        {fault && (
          <span className="mt-1.5 block break-words text-[12px] leading-relaxed text-[color:var(--danger)] xl:hidden">
            {fault}
          </span>
        )}
      </td>
      <td className={`${CELL} ${FROM_MD}`}>{row.status === 'sent' ? <Reach row={row} /> : null}</td>
    </tr>
  )
}

/**
 * What went out under one variant and what came back, as the counts stand.
 *
 * A row with no name is one the registry no longer knows, shown under its id,
 * and a row with no id at all is the messages sent before any variant was
 * recorded. Both keep their counts, because a message that went out is a
 * message that went out whatever the code calls it now.
 */
function ResultRow({ row, onOpenLetter }) {
  // A row is one letter rather than one registration, so the kind it was
  // written for is the kinds it covers. The letter that sends covers all of
  // them, which is the whole point of it; a retired one covers whatever it was
  // registered against, and naming the first of several would read as a letter
  // that went to a fifth of the list.
  const covered = row.segments ?? (row.segment ? [row.segment] : [])
  const covers = row.ids ?? (row.id ? [row.id] : [])
  const marker = row.step > 1 ? `follow-up ${row.step - 1}` : ''
  const state = VARIANT_STATUS[row.status]
  const kind =
    covered.length >= SEGMENTS.length ? (
      <Chip tone="plain">Every Business</Chip>
    ) : covered.length > 1 ? (
      <Chip tone="plain">{fullCount(covered.length)} Kinds</Chip>
    ) : SEGMENT[covered[0]] ? (
      <Chip tone="plain">{SEGMENT[covered[0]].label}</Chip>
    ) : null
  const status = state ? (
    <Chip tone={state.tone}>{state.label}</Chip>
  ) : row.status ? (
    <Chip tone="muted">{row.status}</Chip>
  ) : null
  return (
    <tr className="border-hair-paper border-t align-top">
      <td className={CELL}>
        {row.name && row.id && !row.holdout ? (
          <button
            type="button"
            onClick={() => onOpenLetter(row.id)}
            className="block w-full truncate text-left font-medium text-ink-paper transition-colors duration-150 hover:text-accent"
          >
            {row.name}
          </button>
        ) : (
          <span className="block truncate font-medium text-ink-paper">
            {row.name || row.id || 'No Letter'}
          </span>
        )}
        {/* The id, where the row is one registration and an id is a thing to
            look up. A letter registered once per kind has several, and the
            whole list is on the line rather than in it. A row for an id the
            registry no longer knows carries it in the name above instead,
            since it has no name of its own. */}
        {row.name && (marker || covers.length === 1) && (
          <span
            className={`${MONO_LABEL} text-paper-faint block truncate font-mono`}
            title={covers.join(' ')}
          >
            {covers.length === 1 ? covers[0] : ''}
            {covers.length === 1 && marker ? ', ' : ''}
            {marker}
          </span>
        )}
        {/* What the dropped columns were carrying, folded back under the name
            at the widths they are gone. */}
        <span className="mt-1.5 flex flex-wrap items-center gap-2 xl:hidden">
          {kind}
          <span className="md:hidden">{status}</span>
        </span>
      </td>
      <td className={`${CELL} ${FROM_XL}`}>{kind ?? '—'}</td>
      <td className={`${CELL} ${FROM_MD}`}>{status ?? '—'}</td>
      <td className={`${CELL} ${FROM_2XL} tabular-nums`}>
        {row.assigned === null || row.assigned === undefined ? '—' : fullCount(row.assigned)}
      </td>
      <td className={`${CELL} tabular-nums`}>{fullCount(row.sent)}</td>
      <Outcome className={FROM_MD} count={row.opened} rate={row.open_rate} />
      <Outcome className={FROM_XL} count={row.clicked} rate={row.click_rate} />
      <Outcome count={row.replied} rate={row.reply_rate} />
      <Outcome className={FROM_2XL} count={row.enquired} rate={row.enquiry_rate} />
    </tr>
  )
}

/** One thing that came back: the count, with its rate against what was sent beneath. */
function Outcome({ count, rate, className = '' }) {
  return (
    <td className={`${CELL} tabular-nums ${className}`}>
      {count === null || count === undefined ? '—' : fullCount(count)}
      {rate === null || rate === undefined ? null : (
        <span className="text-paper-faint block text-[11px]">{percent(rate)}</span>
      )}
    </td>
  )
}

/**
 * One business on file: where it is, how much of an opportunity its site is,
 * what kind it reads as, and where it has got to.
 */
function ProspectRow({ row, onOpenProspect }) {
  const lead = opportunityOf(row)
  const place = [row.town, row.trade].filter(Boolean).join(' · ')
  return (
    <tr className="border-hair-paper border-t align-top">
      <td className={CELL}>
        <button
          type="button"
          onClick={() => onOpenProspect(row.id)}
          title={row.name || 'Unnamed business'}
          className="block w-full truncate text-left font-medium text-ink-paper transition-colors duration-150 hover:text-accent"
        >
          {row.name || 'Unnamed business'}
        </button>
        <span className={`${MONO_LABEL} text-paper-faint block truncate`} title={place}>
          {place || '—'}
        </span>
        {/* What the dropped columns were carrying, folded back under the name
            at the widths they are gone. */}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 xl:hidden">
          <span className="md:hidden">
            <OpportunityMark lead={lead} />
          </span>
          <SegmentChip prospect={row} />
          <AxisChip prospect={row} />
          <span className={`${MONO_LABEL} text-paper-faint sm:hidden`}>
            {row.contacted_at ? day(row.contacted_at) : 'not written to yet'}
          </span>
        </span>
      </td>
      <td className={`${CELL} ${FROM_MD}`}>
        <OpportunityMark lead={lead} />
      </td>
      <td className={`${CELL} ${FROM_XL}`}>
        <span className="flex flex-wrap items-center gap-1.5">
          <SegmentChip prospect={row} />
          <AxisChip prospect={row} />
        </span>
      </td>
      <td className={`${CELL} ${FROM_SM} whitespace-nowrap text-paper-soft`}>
        {day(row.contacted_at)}
      </td>
      <td className={CELL}>
        <StageChip stage={row.stage} />
      </td>
    </tr>
  )
}

/**
 * Who is on file, who hears from the studio next, and who heard from it last.
 *
 * Nothing stores a queue. The order is the one the send job works out each
 * time it runs, read here without being acted on, and the times come from the
 * schedule that spreads the day's cap across the sending window. So this is
 * what will happen rather than a list of what has been written down. The
 * follow-ups owed now sit under the first letters, since that is the order a
 * run sends them in.
 *
 * The five halves are one table under a switch rather than five tables,
 * because they answer the same question at different moments: the businesses
 * on file are who the queue is drawn from, and the queue, what was sent, what
 * bounced and what each letter brought back are what became of them. Every
 * business named is the way to its profile and every letter named is the way
 * to the letter itself, so a row here is the place the rest of the section is
 * reached from.
 *
 * The prospects half is read from the board rather than from the mail feed,
 * which is the one thing it does not share: the two land in different frames,
 * so the placeholder rows and the busy state follow the half rather than the
 * panel.
 */
function MailPanel({
  mail,
  error,
  loading,
  half,
  onHalf,
  letters,
  prospects,
  onOpenProspect,
  onOpenLetter,
  area,
}) {
  const next = mail?.next || []
  const follow = mail?.follow_ups || []
  const past = mail?.past || []
  const bounces = mail?.bounces
  const days = bounces?.days || []
  const sending = mail?.sending
  const results = mail?.results || []
  const filed = prospects.rows
  const showing =
    half === 'next'
      ? [...next, ...follow]
      : half === 'past'
        ? past
        : half === 'variants'
          ? results
          : half === 'prospects'
            ? filed
            : days
  const busy = half === 'prospects' ? prospects.loading : loading
  // A board that refuses says so above the panel rather than twice, so the
  // refusal shown here is the mail feed's own.
  const refusal = half === 'prospects' ? null : error

  const total =
    half === 'next'
      ? `${fullCount(mail?.next_total)} in the queue${
          typeof mail?.follow_ups_due === 'number'
            ? `, ${fullCount(mail.follow_ups_due)} follow-ups due`
            : ''
        }`
      : half === 'past'
        ? `${fullCount(past.length)} shown`
        : half === 'variants'
          ? `${fullCount(results.length)} letters`
          : half === 'prospects'
            ? prospects.filtering
              ? `${fullCount(prospects.matching)} matching`
              : `${fullCount(prospects.total)} on file`
            : `${fullCount(bounces?.window_days)} days`

  return (
    <Panel title="Mail" aside={total} loading={busy} area={area}>
      <div className="border-hair-paper flex flex-wrap items-center gap-3 border-b px-5 py-3">
        <div className="console-segmented" role="group" aria-label="Mail">
          {MAIL_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onHalf(tab.key)}
              aria-pressed={half === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {half === 'prospects' && prospects.controls}
        {half !== 'prospects' && !loading && sending && (
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Meta
              label="Today"
              value={`${fullCount(mail.sent_today)} / ${fullCount(mail.cap)}`}
              tone={mail.cap && mail.sent_today >= mail.cap ? 'text-[color:var(--warn)]' : null}
            />
            {typeof mail.follow_ups_today === 'number' ? (
              <Meta label="Follow-Ups" value={fullCount(mail.follow_ups_today)} />
            ) : null}
            {bounces?.rate !== null && bounces?.rate !== undefined ? (
              <Meta
                label="Bounced"
                value={percent(bounces.rate)}
                tone={bounces.rate >= BOUNCE_LIMIT ? 'text-[color:var(--warn)]' : null}
              />
            ) : null}
            {mail.reach?.sent ? (
              <>
                <Meta
                  label="Opened"
                  value={percent(mail.reach.open_rate)}
                  tone={mail.reach.opened ? 'text-[color:var(--good)]' : null}
                />
                <Meta
                  label="Clicked"
                  value={percent(mail.reach.click_rate)}
                  tone={mail.reach.clicked ? 'text-[color:var(--good)]' : null}
                />
                <Meta
                  label="Inquired"
                  value={percent(mail.reach.enquiry_rate)}
                  tone={mail.reach.enquired ? 'text-[color:var(--good)]' : null}
                />
              </>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <span className={`${MONO_LABEL} text-paper-faint`}>Sending</span>
              <Chip tone={sending.enabled && sending.armed && sending.open ? 'good' : 'muted'}>
                {sending.enabled && sending.armed && sending.open ? 'Open' : 'Closed'}
              </Chip>
            </span>
          </span>
        )}
      </div>

      {refusal ? (
        <p className="px-5 py-10 text-center text-[13px] text-paper-soft">{refusal}</p>
      ) : (
        <PanelBody>
          <table className="console-table" aria-busy={busy}>
            <thead>
              <tr>
                {half === 'variants' ? (
                  <>
                    <th scope="col" className={TH}>
                      Letter
                    </th>
                    <th scope="col" className={`${TH} w-[7rem] ${FROM_XL}`}>
                      Kind
                    </th>
                    <th scope="col" className={`${TH} w-[6.5rem] ${FROM_MD}`}>
                      Status
                    </th>
                    <th scope="col" className={`${TH} w-[5rem] ${FROM_2XL}`}>
                      Given
                    </th>
                    <th scope="col" className={`${TH} w-[4.5rem]`}>
                      Sent
                    </th>
                    <th scope="col" className={`${TH} w-[5.5rem] ${FROM_MD}`}>
                      Opened
                    </th>
                    <th scope="col" className={`${TH} w-[5.5rem] ${FROM_XL}`}>
                      Clicked
                    </th>
                    <th scope="col" className={`${TH} w-[5.5rem]`}>
                      Replied
                    </th>
                    <th scope="col" className={`${TH} w-[6rem] ${FROM_2XL}`}>
                      Inquiries
                    </th>
                  </>
                ) : half === 'bounces' ? (
                  <>
                    <th scope="col" className={TH}>
                      Day
                    </th>
                    <th scope="col" className={`${TH} w-[6rem] ${FROM_SM}`}>
                      Sent
                    </th>
                    <th scope="col" className={`${TH} w-[6.5rem]`}>
                      Bounced
                    </th>
                    <th scope="col" className={`${TH} w-[6rem]`}>
                      Rate
                    </th>
                  </>
                ) : half === 'prospects' ? (
                  <>
                    <th scope="col" className={TH}>
                      Business
                    </th>
                    <th scope="col" className={`${TH} w-[12rem] ${FROM_MD}`}>
                      Opportunity
                    </th>
                    <th scope="col" className={`${TH} w-[9rem] ${FROM_XL}`}>
                      Kind
                    </th>
                    <th scope="col" className={`${TH} w-[9rem] ${FROM_SM}`}>
                      Contacted
                    </th>
                    <th scope="col" className={`${TH} w-[7.5rem] md:w-[9rem]`}>
                      Stage
                    </th>
                  </>
                ) : half === 'next' ? (
                  <>
                    <th scope="col" className={`${TH} w-[6.5rem]`}>
                      Due
                    </th>
                    <th scope="col" className={`${TH} w-[3.5rem] ${FROM_XL}`}>
                      Place
                    </th>
                    <th scope="col" className={TH}>
                      Business
                    </th>
                    <th scope="col" className={`${TH} w-[8.5rem] ${FROM_2XL}`}>
                      Kind
                    </th>
                    <th scope="col" className={`${TH} w-[14rem] ${FROM_MD}`}>
                      Letter
                    </th>
                    <th scope="col" className={`${TH} w-[10rem] ${FROM_XL}`}>
                      To
                    </th>
                  </>
                ) : (
                  <>
                    <th scope="col" className={`${TH} w-[10rem] ${FROM_SM}`}>
                      Sent
                    </th>
                    <th scope="col" className={TH}>
                      Business
                    </th>
                    <th scope="col" className={`${TH} w-[10rem] ${FROM_2XL}`}>
                      To
                    </th>
                    <th scope="col" className={`${TH} w-[13rem] ${FROM_XL}`}>
                      Message
                    </th>
                    <th scope="col" className={`${TH} w-[9rem] ${FROM_2XL}`}>
                      Letter
                    </th>
                    <th scope="col" className={`${TH} w-[6.5rem]`}>
                      State
                    </th>
                    <th scope="col" className={`${TH} w-[8.5rem] ${FROM_MD}`}>
                      Reach
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {busy ? (
                <SkeletonRows cols={COLUMNS[half]} rows={half === 'prospects' ? 8 : 4} />
              ) : showing.length ? (
                half === 'prospects' ? (
                  filed.map(row => (
                    <ProspectRow key={row.id} row={row} onOpenProspect={onOpenProspect} />
                  ))
                ) : half === 'variants' ? (
                  results.map(row => (
                    <ResultRow key={row.id ?? 'none'} row={row} onOpenLetter={onOpenLetter} />
                  ))
                ) : half === 'bounces' ? (
                  days.map(row => <BounceRow key={row.date} row={row} />)
                ) : half === 'next' ? (
                  <>
                    {next.map((row, place) => (
                      <NextRow
                        key={row.prospect_id}
                        row={row}
                        place={place}
                        letters={letters}
                        onOpenProspect={onOpenProspect}
                        onOpenLetter={onOpenLetter}
                      />
                    ))}
                    {follow.length ? (
                      <tr className="border-hair-paper border-t">
                        <td
                          colSpan={COLUMNS.next.length}
                          className={`${MONO_LABEL} text-paper-faint bg-[color:var(--paper-field)] px-5 py-2`}
                        >
                          Follow-ups owed now, longest waiting first. Up to{' '}
                          {fullCount(FOLLOW_UPS_PER_RUN)} go on each run after its first letters,
                          outside the daily cap.
                        </td>
                      </tr>
                    ) : null}
                    {follow.map(row => (
                      <NextRow
                        key={`follow:${row.prospect_id}`}
                        row={row}
                        place={null}
                        letters={letters}
                        onOpenProspect={onOpenProspect}
                        onOpenLetter={onOpenLetter}
                      />
                    ))}
                  </>
                ) : (
                  past.map(row => (
                    <PastRow
                      key={row.id}
                      row={row}
                      letters={letters}
                      onOpenProspect={onOpenProspect}
                      onOpenLetter={onOpenLetter}
                    />
                  ))
                )
              ) : half === 'prospects' ? (
                prospects.filtering ? (
                  <EmptyRow cols={COLUMNS.prospects.length}>
                    No businesses match. Widen the search or clear a filter.
                  </EmptyRow>
                ) : (
                  <EmptyRow cols={COLUMNS.prospects.length}>
                    <span className="grid justify-items-center gap-3">
                      <span>
                        Every business the Source job finds appears here, newest first, with the
                        stage it stands at and what its site scored.
                      </span>
                      <button
                        type="button"
                        disabled={prospects.running}
                        onClick={prospects.onRun}
                        className={QUIET}
                      >
                        <Play className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                        {prospects.running ? 'Running' : 'Run Source'}
                      </button>
                    </span>
                  </EmptyRow>
                )
              ) : half === 'variants' ? (
                <EmptyRow cols={COLUMNS.variants.length}>
                  No letter is registered, so nothing can be counted against one.
                </EmptyRow>
              ) : half === 'next' ? (
                <EmptyRow cols={COLUMNS.next.length}>
                  Nothing is queued. A business joins the queue once it has an address on file and
                  its site has been scored, which the Enrich and Audit jobs do.
                </EmptyRow>
              ) : half === 'past' ? (
                <EmptyRow cols={COLUMNS.past.length}>
                  Nothing has been sent yet. Every message that leaves appears here with the address
                  it went to.
                </EmptyRow>
              ) : (
                <EmptyRow cols={COLUMNS.bounces.length}>
                  Nothing has been sent yet, so there is no bounce rate to read.
                </EmptyRow>
              )}
            </tbody>
          </table>
        </PanelBody>
      )}

      {!loading && half === 'variants' ? (
        <PanelFoot>
          <p className="leading-relaxed">
            Each row is what went out under one letter and what came back, with each rate against
            what was sent. One letter sends and the rest are retired, so every row below it is a
            record of what the pipeline used to say rather than a reading on anything running.
          </p>
        </PanelFoot>
      ) : null}

      {half === 'next' || half === 'past' ? (
        <PanelFoot>
          <p className="leading-relaxed">
            {/* Every branch below turns on a queue that has not been read yet, so
                the sentence stating that sending is on and spreading its cap is
                the one that falls out by default. */}
            {loading ? (
              <SkeletonBar className="w-full max-w-[38rem]" />
            ) : sending && !sending.enabled ? (
              'Sending is off, so these messages are written and held rather than delivered.'
            ) : sending && !sending.armed ? (
              'Sending is off on the deployment, so these messages are written and held rather than delivered.'
            ) : sending && !sending.reaches ? (
              /* The reason is the window's and it is empty while the window is
                 open, which is the case in the last few minutes before closing:
                 open, but with the day's final run already behind it. */
              `Nothing more goes out today${sending.reason ? `: ${sending.reason}` : ', the last run that can deliver has already gone'}. These are the order they hear from the studio tomorrow.`
            ) : sending && !sending.open ? (
              `Nothing is going out right now: ${sending.reason}.`
            ) : (
              "The day's cap is spread across the sending window rather than sent at once, so each business has its own time. A time already past goes on the next run, and the follow-ups owed go after its first letters."
            )}
          </p>
        </PanelFoot>
      ) : null}

      {half === 'prospects' ? prospects.pager : null}
    </Panel>
  )
}

/**
 * The section's views, first one the front. Each is one question: how the
 * pipeline stands, who is on file and what has been written to them, the
 * letters themselves, and what it is set up with.
 */
const VIEWS = [
  { key: 'overview', label: 'Overview' },
  { key: 'mail', label: 'Mail' },
  { key: 'letters', label: 'Letters' },
  { key: 'settings', label: 'Settings' },
]

// How many of the queue the front shows. The whole of it is the Mail view's;
// the front says who is next, which the head of the line answers.
const NEXT_SHOWN = 6

/**
 * The day's sending as three facts and the head of the queue, on the front of
 * the section.
 *
 * The queue answers in full in the Mail view; this is what a reader who opened
 * the section to see whether anything is going out reads without leaving the
 * front: the cap and where it stands, the follow-ups sent and owed, and who
 * hears next.
 */
function TodayPanel({ mail, loading, error, onOpenMail, onOpenProspect, area }) {
  const sending = mail?.sending
  const ahead = (mail?.next || []).slice(0, NEXT_SHOWN)
  const now = Date.now()
  return (
    <Panel
      area={area}
      title="Today's Mail"
      aside={loading ? undefined : sending?.open ? 'the window is open' : sending?.reason}
      loading={loading}
    >
      {error ? (
        <p className="px-5 py-10 text-center text-[13px] text-paper-soft">{error}</p>
      ) : (
        <>
          <div className="border-hair-paper grid grid-cols-3 gap-4 border-b px-5 py-3">
            <Fact label="First Letters">
              {loading ? (
                <SkeletonBar className="my-1 w-16" />
              ) : (
                `${fullCount(mail.sent_today)} of ${fullCount(mail.cap)}`
              )}
            </Fact>
            <Fact label="Follow-Ups Sent">
              {loading ? (
                <SkeletonBar className="my-1 w-16" />
              ) : typeof mail.follow_ups_today === 'number' ? (
                fullCount(mail.follow_ups_today)
              ) : (
                'not running yet'
              )}
            </Fact>
            <Fact label="Follow-Ups Owed">
              {loading ? (
                <SkeletonBar className="my-1 w-16" />
              ) : typeof mail.follow_ups_due === 'number' ? (
                fullCount(mail.follow_ups_due)
              ) : (
                'not running yet'
              )}
            </Fact>
          </div>
          <PanelBody>
            {loading ? (
              <SkeletonList rows={4} />
            ) : ahead.length ? (
              <ul className="divide-hair-paper divide-y">
                {ahead.map(row => {
                  const due = row.due_at ? new Date(row.due_at).getTime() : null
                  return (
                    <li key={row.prospect_id} className="flex items-center gap-3 px-5 py-2">
                      <span className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onOpenProspect(row.prospect_id)}
                          title={row.name || 'Unnamed business'}
                          className="block w-full truncate text-left text-[13px] font-medium text-ink-paper transition-colors duration-150 hover:text-accent"
                        >
                          {row.name || 'Unnamed business'}
                        </button>
                        <span className={`${MONO_LABEL} text-paper-faint block truncate`}>
                          {[row.town, row.trade].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </span>
                      {due === null ? (
                        <span className="text-paper-faint flex-shrink-0 text-[12px]">
                          after today
                        </span>
                      ) : due <= now ? (
                        <Chip tone="accent">Due Now</Chip>
                      ) : (
                        <span className="flex-shrink-0 font-mono text-[12px] tabular-nums text-paper-soft">
                          {clock(row.due_at)}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-[13px] text-paper-soft">
                Nothing is queued. A business joins the queue once it has an address on file and its
                site has been scored.
              </p>
            )}
          </PanelBody>
        </>
      )}
      <PanelFoot>
        <span>
          {loading ? (
            <SkeletonBar className="w-64" />
          ) : (
            `${fullCount(mail?.next_total)} in the queue, up to ${fullCount(mail?.cap)} a day, 8:00am to 5:00pm Central, Monday to Saturday.`
          )}
        </span>
        <button type="button" onClick={() => onOpenMail('next')} className={QUIET}>
          Open the Queue
          <ChevronRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PanelFoot>
    </Panel>
  )
}

/**
 * One business in full: where it stands, what it is worth, how to reach it,
 * what has been sent, and every message to and from it.
 *
 * It opens over the table rather than in place of it, so the row it was
 * opened from is still there when it closes, and the record scrolls on its
 * own inside the panel.
 */
function ProfileSheet({
  record,
  error,
  loading,
  letters,
  reason,
  onReason,
  acting,
  onSkip,
  onOpenLetter,
}) {
  if (error) {
    return <p className="px-5 py-12 text-center text-[13px] text-paper-soft">{error}</p>
  }
  if (loading || !record) {
    return (
      <p className="px-5 py-12 text-center text-[13px] text-paper-soft">Reading this prospect</p>
    )
  }
  const lead = opportunityOf(record)
  const segment = SEGMENT[segmentOf(record)]
  // What the listing says about how long the business has been trading, read
  // in full here rather than as the badge alone: 'established' and 'unread' get
  // no chip in a table because they are the ordinary and the unknown case, but
  // on one business's own record the difference between a listing with reviews
  // and a listing nobody has read is worth a sentence.
  const listing = YOUTH[youthOf(record)]
  const asked = record.source === ASKED_SOURCE
  const messages = record.messages || []
  return (
    <>
      {/* The name, where it trades, and where it stands: what a reader opened
          the row to check, settled before the facts under it rather than found
          among them. */}
      <div className="border-hair-paper flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-5 py-4">
        <div className="grid min-w-0 gap-1">
          <h3 className="truncate text-[19px] font-semibold tracking-tight text-ink-paper">
            {record.name || 'Unnamed business'}
          </h3>
          <p className="text-[13px] text-paper-soft">
            {[record.town, record.trade].filter(Boolean).join(' · ') || 'no town or trade on file'}
          </p>
        </div>
        <StageChip stage={record.stage} />
      </div>

      <Group name="What It Is Worth" columns="sm:grid-cols-2">
        <Fact label="Opportunity">
          <OpportunityMark lead={lead} />
          <span className="text-paper-faint mt-1.5 block text-[12px] leading-relaxed">
            {lead.caption}
          </span>
          {record.audit_at && (
            <span className="text-paper-faint block text-[12px]">
              taken {stamp(record.audit_at)}
            </span>
          )}
        </Fact>
        <Fact label="Kind">
          <span className="flex flex-wrap items-center gap-1.5">
            <SegmentChip prospect={record} />
            <AxisChip prospect={record} />
          </span>
          <span className="text-paper-faint mt-1.5 block text-[12px] leading-relaxed">
            {segment.caption}
          </span>
          {asked && (
            <span className="text-paper-faint block text-[12px] leading-relaxed">
              {ASKED.caption}
            </span>
          )}
          <span className="text-paper-faint block text-[12px] leading-relaxed">
            {listing.caption}
          </span>
        </Fact>
        <p className="text-paper-faint text-[12px] leading-relaxed sm:col-span-2">{SCALE}</p>
      </Group>

      <Group name="How to Reach It">
        <Fact label="Email">
          {record.email ? (
            <>
              <Capped>{record.email}</Capped>
              <span className="text-paper-faint block text-[12px]">
                found by {record.email_source || 'an unrecorded step'}
              </span>
              <Verdict prospect={record} />
            </>
          ) : (
            'No address found'
          )}
        </Fact>
        <Fact label="Phone">{record.phone}</Fact>
        <Fact label="Website">
          {record.website ? (
            <a
              href={record.website}
              target="_blank"
              rel="noreferrer noopener"
              title={record.website}
              className="flex max-w-full items-center gap-1.5 text-accent"
            >
              <span className="truncate">{record.website}</span>
              <ExternalLink
                className="h-3 w-3 flex-shrink-0"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </a>
          ) : null}
        </Fact>
        <Fact label="Address">{record.address}</Fact>
      </Group>

      <Group
        name="What Has Been Sent"
        columns="sm:grid-cols-2"
        aside={
          record.contacted_at
            ? `first written to ${stamp(record.contacted_at)}`
            : 'not written to yet'
        }
      >
        <Fact label="Letter">
          {record.variant_id ? (
            <LetterLink id={record.variant_id} letters={letters} onOpen={onOpenLetter} />
          ) : (
            'none given yet'
          )}
          {typeof record.step === 'number' && record.step > 0 ? (
            <span className="text-paper-faint mt-1.5 block text-[12px] leading-relaxed">
              {fullCount(record.step)} of the chain sent
              {record.next_due_at
                ? `, the next owed ${stamp(record.next_due_at)}`
                : ', nothing more owed'}
            </span>
          ) : null}
        </Fact>
        <Fact label="Replied">{stamp(record.replied_at)}</Fact>
        <Fact label="Bounced">{stamp(record.bounced_at)}</Fact>
      </Group>

      <Group name="Where It Came From" columns="sm:grid-cols-2">
        <Fact label="Source">{SOURCE[record.source] ?? record.source ?? '—'}</Fact>
        <Fact label="Found">{stamp(record.created_at)}</Fact>
        <Fact label="Place ID">
          <span className="break-all font-mono text-[12px]">{record.place_id || '—'}</span>
        </Fact>
        {record.skip_reason && <Fact label="Skip Reason">{record.skip_reason}</Fact>}
      </Group>

      <section className="border-hair-paper grid gap-2.5 border-b px-5 py-4">
        <h3 className={`${MONO_LABEL} text-ink-paper`}>Taking It Out</h3>
        {record.stage === 'unsubscribed' ? (
          <p className="text-[13px] leading-relaxed text-paper-soft">
            This business asked for no further contact. Nothing further is written or sent for it,
            and the address stays suppressed against every list.
          </p>
        ) : record.stage === 'skipped' ? (
          <p className="text-[13px] leading-relaxed text-paper-soft">
            This business is out of the pipeline. Nothing further is written or sent for it.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2.5">
              <label className="min-w-[12rem] flex-1">
                <span className={`${MONO_LABEL} text-paper-faint mb-1.5 block`}>Reason</span>
                <input
                  type="text"
                  value={reason}
                  onChange={event => onReason(event.target.value)}
                  placeholder="why this one is out"
                  className={FIELD}
                />
              </label>
              <button
                type="button"
                disabled={acting === 'skip'}
                onClick={() => onSkip(record.id)}
                className={`${QUIET} hover:text-[color:var(--warn)]`}
              >
                <Ban className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                {acting === 'skip' ? 'Skipping' : 'Skip This Prospect'}
              </button>
            </div>
            <p className="text-[13px] leading-relaxed text-paper-soft">
              Skipping takes this business out of the pipeline. Nothing further is written or sent
              for it, and the reason stays on the row.
            </p>
          </>
        )}
      </section>

      <header className="border-hair-paper flex items-center justify-between gap-3 border-b px-5 py-3">
        <h3 className={`${MONO_LABEL} text-ink-paper`}>Messages</h3>
        <p className={`${MONO_LABEL} text-paper-faint`}>
          {messages.length ? `${fullCount(messages.length)} in all` : 'none yet'}
        </p>
      </header>

      {messages.length ? (
        <ul>
          {messages.map(message => (
            <Message
              key={message.id}
              message={message}
              step={stepOfMessage(message, letters)}
              letters={letters}
              onOpenLetter={onOpenLetter}
            />
          ))}
        </ul>
      ) : (
        <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
          Nothing has been written to this business yet. A drafted message appears here in full once
          the send job writes one.
        </p>
      )}
    </>
  )
}

export default function OutreachPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const toast = useToast()

  // Which view is open, which business, which letter and which half of the
  // mail list, all held in the address so a link lands on them.
  const [view, go, params] = useView(VIEWS)
  const openId = params.get('open')
  const tabParam = params.get('tab')
  const half = MAIL_TABS.some(tab => tab.key === tabParam) ? tabParam : 'next'
  const letterParam = params.get('letter')

  const [stage, setStage] = useState('')
  const [town, setTown] = useState('')
  const [trade, setTrade] = useState('')
  const [band, setBand] = useState('')
  const [chosenSort, setChosenSort] = useState(null)
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  // Whether the form that puts a business in by hand is open.
  const [panel, setPanel] = useState(null)
  // One letter rendered as it would be sent, held here rather than in the
  // feed: the board does not move when a letter is looked at.
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(null)
  // The last proof sent from here, so the sheet it was sent for can say so.
  const [proofed, setProofed] = useState(null)
  // The letter on the stage.
  const [selected, setSelected] = useState(null)
  const [part, setPart] = useState('html')

  // A read per keystroke would spend a request on every prefix of a name.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), 250)
    return () => clearTimeout(timer)
  }, [typed])

  // The audited stage is the businesses whose sites have been scored and not
  // yet written to, which is a list read best lead first. Every other stage is
  // read newest first, until the order is picked by hand.
  const sort = chosenSort ?? (stage === 'audited' ? 'opportunity' : 'newest')

  // A new filter selects a different set of rows, so page four of the last
  // one is not a page of this one. A new order selects the same rows in a
  // different sequence, which page four of the last one is no part of either.
  useEffect(() => setPage(0), [stage, town, trade, band, sort, search])

  const filters = useMemo(
    () => ({ stage, town, trade, band, sort, search, page }),
    [stage, town, trade, band, sort, search, page]
  )
  const {
    data,
    retained,
    error,
    loading,
    profile,
    profileError,
    profileLoading,
    mail,
    mailError,
    mailLoading,
    acting,
    running,
    refresh,
    act,
    run,
    preview: readPreview,
  } = useOutreachFeed({ token, enabled: Boolean(token), filters, openId })

  const [edited, setEdited] = useState(null)
  const [reason, setReason] = useState('')
  // The business being added by hand. It is held whole rather than a field at
  // a time so closing the panel over a half-typed name does not lose it.
  const [business, setBusiness] = useState(BLANK_BUSINESS)
  // What the add was refused over, and the field the refusal is about where it
  // names one, so the sentence can be read under the input rather than beside
  // the button.
  const [addFault, setAddFault] = useState(null)
  const [adding, setAdding] = useState(false)

  const settings = data?.settings || null
  // The form reads from the saved row until it is typed in, and from the
  // typing after that. Deriving it rather than copying it into state on a
  // read is what keeps a re-read behind a half-typed list from overwriting
  // it, and what puts the fields on screen in the same frame as the switches
  // beside them.
  const draft = edited ?? (settings ? toDraft(settings) : null)

  const prospects = data?.prospects || []
  const counts = data?.counts || {}
  // Held between renders, since the Letters view opens the first letter off
  // this list and a fresh array each render would open it again and again.
  const variants = useMemo(() => data?.variants || [], [data])
  const total = data?.total || 0
  const matching = data?.matching || 0
  const size = data?.size || prospects.length || 1
  // The filter's own lists and the pager describe the question rather than
  // answer it, so they stand on the last read while the next one runs.
  // Otherwise picking a town empties the town list, and pressing Next unmounts
  // the control that was pressed.
  const towns = retained?.towns || []
  const trades = retained?.trades || []
  const paged = retained?.matching || 0
  const pageSize = retained?.size || size
  const pages = Math.max(1, Math.ceil(paged / pageSize))
  const filtering = Boolean(stage || town || trade || band || search)
  const narrowing = Boolean(stage || town || trade || band)
  const peak = Math.max(1, ...STAGE_ORDER.map(name => counts[name] || 0))
  // The stage counts, the strong-lead figure and the two filter lists are
  // taken over the whole table unless it is long enough to have been read to a
  // ceiling. Saying so is what keeps a breakdown over part of the table from
  // reading as one over all of it.
  const sampled = Boolean(data && data.summarised < total)

  const cap = settings?.daily_cap ?? 0
  const today = data?.contacted_today ?? 0
  // The two figures the rotation is read by: how many businesses are on it,
  // and how many are waiting to join. The queue is the mail view's own count,
  // since it is the length of the line the sender works rather than a stage.
  const rotation = data?.rotation ?? 0
  const queued = mail?.next_total ?? null
  // What the queue is read against, which moves with the cap. A floor left at
  // its standing figure under a cap larger than it is a floor the day walks
  // past, and the tile would read good on the morning the queue emptied.
  const queueFloor = queueFloorFor(cap)
  /**
   * The rotation, as records.
   *
   * Every figure on this strip is already measured out of something - a
   * target, a floor, the day's cap, everybody ever written to - so the
   * promoted one is drawn on that scale with the bar it answers to marked on
   * it. A queue under its floor is the one thing here that needs a person, so
   * it takes the lede on its own when it happens.
   */
  const outreachFigures = useMemo(() => {
    const contacted = data?.contacted_ever ?? 0
    const replied = data?.replied ?? 0
    const short = queued === null ? 0 : Math.max(0, queueFloor - queued)

    return [
      {
        key: 'rotation',
        label: 'In Rotation',
        gloss: 'Businesses hearing from the studio every month.',
        value: `${fullCount(rotation)} / ${fullCount(ROTATION_TARGET)}`,
        caption: `${fullCount(Math.max(0, ROTATION_TARGET - rotation))} short of the target`,
        tone: rotation ? 'good' : 'plain',
        loading,
        facts: [
          [fullCount(rotation), 'on the rotation'],
          [fullCount(ROTATION_TARGET), 'the target'],
          [fullCount(contacted), 'written to ever'],
        ],
        room: {
          kind: 'progress',
          at: rotation,
          of: ROTATION_TARGET,
          target: ROTATION_TARGET,
          note: `${fullCount(rotation)} of a ${fullCount(ROTATION_TARGET)} rotation`,
        },
      },
      {
        key: 'queued',
        label: 'Queued',
        gloss: 'Waiting on a first letter.',
        value: `${fullCount(queued)} / ${fullCount(queueFloor)}`,
        caption: short ? `${fullCount(short)} under the floor` : 'above the floor',
        tone: queued === null ? 'plain' : queued < queueFloor ? 'warn' : 'good',
        urgent: queued !== null && queued < queueFloor,
        loading: mailLoading,
        facts: [
          [fullCount(queued), 'in the line'],
          [fullCount(queueFloor), 'the floor'],
          [fullCount(cap), 'a day at most'],
        ],
        room: {
          kind: 'progress',
          at: queued || 0,
          of: Math.max(queueFloor, queued || 0),
          target: queueFloor,
          note: short
            ? `${fullCount(short)} short of the floor the day walks past`
            : `${fullCount(queued)} waiting, floor of ${fullCount(queueFloor)}`,
        },
      },
      {
        key: 'today',
        label: 'Contacted Today',
        gloss: 'First letters sent since midnight.',
        value: `${fullCount(today)} / ${fullCount(cap)}`,
        caption: cap ? `${fullCount(Math.max(0, cap - today))} left in the day` : null,
        tone: cap && today >= cap ? 'warn' : 'plain',
        loading,
        room: cap
          ? {
              kind: 'progress',
              at: today,
              of: cap,
              target: cap,
              note: `${fullCount(today)} of the day's ${fullCount(cap)}`,
            }
          : null,
      },
      {
        key: 'replied',
        label: 'Replied',
        gloss: 'Wrote back to a letter.',
        value: fullCount(replied),
        caption: `of ${fullCount(contacted)} contacted`,
        tone: replied ? 'good' : 'plain',
        loading,
        room: contacted
          ? {
              kind: 'progress',
              at: replied,
              of: contacted,
              note: `${fullCount(replied)} of ${fullCount(contacted)} wrote back`,
            }
          : null,
      },
      {
        key: 'rate',
        label: 'Reply Rate',
        gloss: 'Replies as a share of everybody ever written to.',
        value: percent(data?.reply_rate),
        caption: `${fullCount(replied)} of ${fullCount(contacted)}`,
        tone: data?.reply_rate ? 'good' : 'plain',
        loading,
      },
    ]
  }, [cap, data, loading, mailLoading, queued, queueFloor, rotation, today])

  const sending = Boolean(settings?.sending_enabled)
  const sourcing = Boolean(settings?.sourcing_enabled)

  const clearFilters = () => {
    setStage('')
    setTown('')
    setTrade('')
    setBand('')
  }

  const toggle = (key, next) => act({ action: 'settings', [key]: next }, key)
  const setLetter = useCallback(
    (id, change) => act({ action: 'variant', id, ...change }, `variant:${id}`),
    [act]
  )
  // Held between renders, since a slider's save waits on its handler and a
  // fresh closure each render would restart that wait while a drag settles.
  const setters = useMemo(
    () =>
      Object.fromEntries(variants.map(entry => [entry.id, change => setLetter(entry.id, change)])),
    [variants, setLetter]
  )
  const previewVariant = useCallback(
    async id => {
      setSelected(id)
      setPreviewing(id)
      setPreview(null)
      setProofed(null)
      const shown = await readPreview(id)
      setPreview({ ...shown, variant: shown?.variant ?? id })
      setPreviewing(null)
    },
    [readPreview]
  )
  const proofVariant = async id => {
    const answer = await act({ action: 'proof', id }, `proof:${id}`)
    if (answer?.ok) setProofed({ id, to: answer.to, name: answer.prospect?.name ?? null })
  }

  // The ways between the views. A business named anywhere opens on its own
  // profile, a letter named anywhere opens on the stage, and a stage picked
  // from the pipeline narrows the table, so each is one move that sets the
  // view and what it opens on together.
  const openProspect = id => {
    go('mail', { tab: 'prospects', open: id })
    setReason('')
  }
  const closeProspect = () => go('mail', { tab: 'prospects', open: null })
  const openLetter = id => go('letters', { letter: id })
  const openMail = tab => go('mail', { tab: tab === 'next' ? null : tab })
  const pickStage = name => {
    setStage(name)
    go('mail', { tab: 'prospects', open: null })
  }

  // The Letters view opens on the letter the address names, or on the first
  // live one, so the stage is never an empty frame beside the list.
  useEffect(() => {
    if (view !== 'letters' || !variants.length) return
    const named = letterParam
      ? variants.find(entry => entry.id === letterParam && !entry.holdout)
      : null
    const first =
      named ??
      variants.find(entry => !entry.holdout && entry.status === 'live') ??
      variants.find(entry => !entry.holdout)
    if (first && first.id !== selected && previewing !== first.id) previewVariant(first.id)
  }, [view, letterParam, variants, selected, previewing, previewVariant])
  // The registry holds one entry per letter per segment, and the letter that
  // sends says the same thing to every segment, so five identical rows would
  // be five ways of reading one letter. The list is by name for that reason:
  // one row per letter, whatever it is registered against. Picking one opens
  // the first entry under it, and every entry under it renders the same words.
  const byName = entries => {
    const seen = new Set()
    return entries.filter(entry => {
      if (seen.has(entry.name)) return false
      seen.add(entry.name)
      return true
    })
  }
  const sendingLetters = byName(variants.filter(entry => !entry.holdout && entry.status === 'live'))
  const retiredLetters = byName(variants.filter(entry => !entry.holdout && entry.status !== 'live'))
  const staged = selected ? (variants.find(entry => entry.id === selected) ?? null) : null
  // Matched on the name rather than the id, because both lists are one row per
  // letter and a letter registered once per segment has five ids. Matching on
  // the id the stage happens to hold would report a fifth of what the letter
  // did as the whole of it.
  const stagedResults = staged
    ? ((mail?.results || []).find(row => row.name && row.name === staged.name) ?? null)
    : null

  const saveSettings = async event => {
    event.preventDefault()
    const answer = await act(
      {
        action: 'settings',
        daily_cap: draft.daily_cap === '' ? 0 : Number(draft.daily_cap),
        towns: draft.towns,
        trades: draft.trades,
        from_name: draft.from_name,
        from_address: draft.from_address,
      },
      'settings'
    )
    if (answer?.settings) setEdited(null)
  }

  // Typing into a field answers the refusal under it, so the sentence goes as
  // the reader acts on it rather than standing over a value it is no longer
  // about.
  const typeInto = key => event => {
    const typing = event.target.value
    setBusiness(current => ({ ...current, [key]: typing }))
    setAddFault(current => (current?.field === key ? null : current))
  }

  const closeAdd = () => {
    setPanel(null)
    setAddFault(null)
  }

  // A filed business opens on its own profile, which is the section's account
  // of where a row stands. Nothing else here says a change went through, and a
  // form that empties itself says only that the typing has gone.
  //
  // It is asked for on its own rather than through the board's changes,
  // because what it comes back refused with is about a field: a name left out,
  // an address that is not one, a business already on file. Those are read
  // beside the typing, and reading the answer here is what puts them there.
  // A failure behind the form is not the reader's to correct and is said the
  // way the section's other failures are.
  const submitAdd = async event => {
    event.preventDefault()
    if (!token || adding) return
    setAdding(true)
    setAddFault(null)
    try {
      const { response, payload } = await writeEndpoint(token, ADD_PATH, {
        action: 'add',
        ...business,
      })
      if (!response.ok) {
        const said = faultFromResponse(response, payload, NOT_ADDED)
        if (REFUSED.has(response.status)) setAddFault({ field: fieldOf(said), said })
        else toast(said, 'error')
        return
      }
      if (!payload?.prospect) return
      setBusiness(BLANK_BUSINESS)
      setPanel(null)
      await refresh()
      openProspect(payload.prospect.id)
    } catch (cause) {
      toast(faultMessage(cause, NOT_ADDED), 'error')
    } finally {
      setAdding(false)
    }
  }

  const runJob = name => run(name)

  // A refusal with nothing behind it is the whole answer, so it is shown in
  // place of the page rather than above an empty one.
  if (error && !data) return <SectionNotice>{error}</SectionNotice>

  const record = profile?.prospect
    ? { ...profile.prospect, messages: profile.messages || [] }
    : null

  // The three fields the add form can be refused over. Each says so itself:
  // the sentence under the input, and the input marked as the one refused, so
  // a reader who cannot see the colour is told the same thing.
  const nameFault = addFault?.field === 'name' ? addFault.said : null
  const websiteFault = addFault?.field === 'website' ? addFault.said : null
  const emailFault = addFault?.field === 'email' ? addFault.said : null

  // The search field and the five that narrow the table stand on the same row
  // as the halves, each showing what it is set to, so a table missing rows
  // always says why. The order is beside them, since the audited stage reads
  // best lead first and the rest newest first until it is picked by hand.
  const prospectControls = (
    <span className="flex flex-1 flex-wrap items-center gap-2">
      <label className="min-w-[11rem] flex-1">
        <span className="sr-only">Search Prospects</span>
        <input
          type="search"
          value={typed}
          onChange={event => setTyped(event.target.value)}
          placeholder="Search by name or address"
          className={FIELD}
        />
      </label>
      <select
        aria-label="Stage"
        value={stage}
        onChange={event => setStage(event.target.value)}
        className={SELECT}
      >
        <option value="">Every Stage</option>
        {STAGE_ORDER.map(name => (
          <option key={name} value={name}>
            {STAGE[name].label}
          </option>
        ))}
      </select>
      <select
        aria-label="Town"
        value={town}
        onChange={event => setTown(event.target.value)}
        className={SELECT}
      >
        <option value="">Every Town</option>
        {towns.map(name => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Trade"
        value={trade}
        onChange={event => setTrade(event.target.value)}
        className={SELECT}
      >
        <option value="">Every Trade</option>
        {trades.map(name => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Opportunity"
        title={SCALE}
        value={band}
        onChange={event => setBand(event.target.value)}
        className={SELECT}
      >
        <option value="">Every Opportunity</option>
        {OPPORTUNITY_BANDS.map(name => (
          <option key={name} value={name}>
            {OPPORTUNITY[name].label}
          </option>
        ))}
      </select>
      <select
        aria-label="Sort Order"
        value={sort}
        onChange={event => setChosenSort(event.target.value)}
        className={SELECT}
      >
        <option value="opportunity">Best Lead First</option>
        <option value="newest">Newest First</option>
      </select>
      {narrowing && (
        <button type="button" onClick={clearFilters} className={`${QUIET} px-2.5`}>
          Clear All
        </button>
      )}
      <button
        type="button"
        onClick={() => setPanel('add')}
        aria-haspopup="dialog"
        className={QUIET}
      >
        <Plus className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
        Add Prospect
      </button>
    </span>
  )

  const prospectPager =
    pages > 1 ? (
      <PanelFoot>
        <p className={`${MONO_LABEL} text-paper-faint`}>
          Page {fullCount(page + 1)} of {fullCount(pages)}
        </p>
        <span className="inline-flex items-center gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(current => Math.max(0, current - 1))}
            className={QUIET}
          >
            <ChevronLeft className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
            Previous
          </button>
          <button
            type="button"
            disabled={page + 1 >= pages}
            onClick={() => setPage(current => current + 1)}
            className={QUIET}
          >
            Next
            <ChevronRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </span>
      </PanelFoot>
    ) : null

  // Everything the mail panel's prospects half needs that the mail feed does
  // not carry, held together rather than as nine props on a panel about mail.
  const onFile = {
    rows: prospects,
    loading,
    total,
    matching,
    filtering,
    controls: prospectControls,
    pager: prospectPager,
    running: running.includes('source'),
    onRun: () => runJob('source'),
  }

  const views = VIEWS.map(one =>
    one.key === 'mail'
      ? { ...one, count: fullCount(mail?.next_total), loading: mailLoading }
      : one.key === 'letters'
        ? { ...one, count: fullCount(sendingLetters.length), loading }
        : one
  )

  return (
    <ConsolePage areas={['stats', 'views', 'work']} rows="auto auto minmax(0,1fr)">
      <Area area="stats">
        <ConsoleError>{error}</ConsoleError>

        <Figures figures={outreachFigures} pinned="rotation" busy={loading} />
      </Area>

      <Area area="views">
        <ViewNav views={views} current={view} onPick={key => go(key)} label="Outreach views" />
      </Area>

      {view === 'overview' ? (
        <Board
          area="work"
          areas={['pipeline state', 'pipeline today']}
          cols="minmax(0,1fr) minmax(0,1fr)"
          rows="auto minmax(0,1fr)"
        >
          <Panel
            area="pipeline"
            title="Pipeline"
            aside={`${fullCount(total)} in all`}
            loading={loading}
          >
            <PanelBody>
              {/* Six rows a column at the width a second column fits, so the
                  eleven stages read down the first and on down the second,
                  which is the order the pipeline runs in. Picking a stage
                  opens the businesses on file narrowed to it. */}
              <ul className="sm:grid sm:grid-flow-col sm:grid-rows-6">
                {STAGE_ORDER.map(name => (
                  <StageRow
                    key={name}
                    name={name}
                    count={counts[name] || 0}
                    peak={peak}
                    picked={stage === name}
                    loading={loading}
                    onPick={pickStage}
                  />
                ))}
              </ul>
              {/* The two readings the send queue puts in front of every
                  measured site, counted over the businesses still owed a first
                  letter. They are taken from the same sample as the stages
                  above, so the note under them covers these as well. */}
              <ul className="border-hair-paper border-t py-1 sm:grid sm:grid-cols-2">
                <QueueFigure label="Ahead of Score" count={data?.ahead_leads} loading={loading} />
                <QueueFigure label="Young Listings" count={data?.young_leads} loading={loading} />
              </ul>
              {sampled && (
                <p className="border-hair-paper text-paper-faint border-t px-5 py-3 text-[12px] leading-relaxed">
                  These figures are taken over the {fullCount(data.summarised)} most recent
                  prospects of {fullCount(total)}. The businesses on file read the whole of it.
                </p>
              )}
              <details className="border-hair-paper border-t px-5 py-3">
                <summary className={`${MONO_LABEL} text-paper-faint cursor-pointer select-none`}>
                  What the Stages Mean
                </summary>
                <dl className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {STAGE_ORDER.map(name => (
                    <div key={name} className="grid gap-0.5">
                      <dt className={`${MONO_LABEL} text-ink-paper`}>{STAGE[name].label}</dt>
                      <dd className="text-[13px] leading-relaxed text-paper-soft">
                        {STAGE[name].caption}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </PanelBody>
          </Panel>

          {/* The two readings that decide whether anything is happening at
              all - whether sourcing is on and whether sending is on - and the
              way in by hand. */}
          <Area area="state">
            <m.div {...fadeInUp} className="console-card">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                {/* A switch read before the settings land is a switch reported
                    off, which is the one reading a reader acts on. It waits
                    with the rest of the strip instead. */}
                <span className="inline-flex items-center gap-1.5">
                  <span className={`${MONO_LABEL} text-paper-faint`}>Sourcing</span>
                  {loading ? (
                    <SkeletonBar className="w-8" />
                  ) : (
                    <Chip tone={sourcing ? 'good' : 'muted'}>{sourcing ? 'On' : 'Off'}</Chip>
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`${MONO_LABEL} text-paper-faint`}>Sending</span>
                  {loading ? (
                    <SkeletonBar className="w-8" />
                  ) : (
                    <Chip tone={sending ? 'good' : 'muted'}>{sending ? 'On' : 'Off'}</Chip>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setPanel('add')}
                  aria-haspopup="dialog"
                  className={`${QUIET} sm:ml-auto`}
                >
                  <Plus className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  Add Prospect
                </button>
              </div>
            </m.div>
          </Area>

          <TodayPanel
            area="today"
            mail={mail}
            loading={mailLoading}
            error={mailError}
            onOpenMail={openMail}
            onOpenProspect={openProspect}
          />
        </Board>
      ) : null}

      {view === 'mail' ? (
        <MailPanel
          area="work"
          mail={mail}
          error={mailError}
          loading={mailLoading}
          half={half}
          onHalf={openMail}
          letters={variants}
          prospects={onFile}
          onOpenProspect={openProspect}
          onOpenLetter={openLetter}
        />
      ) : null}

      {view === 'letters' ? (
        <ConsoleSplit
          area="work"
          list={
            <Panel
              title="Letters"
              aside={
                sendingLetters.length
                  ? `${fullCount(sendingLetters.length)} sending, ${fullCount(retiredLetters.length)} retired`
                  : undefined
              }
              loading={loading}
            >
              <PanelBody>
                {loading ? (
                  <div className="grid gap-3 px-5 py-4">
                    <SkeletonBar className="w-full max-w-[26rem]" />
                    <SkeletonBar className="w-full max-w-[22rem]" />
                  </div>
                ) : (
                  <ul>
                    <li className="border-hair-paper border-b px-5 py-3">
                      <p className="text-[12px] leading-relaxed text-paper-soft">
                        Every business gets the same letter, and gets it again every{' '}
                        {FOLLOW_UP_DAYS} days until it replies or takes itself off the list. Nothing
                        is drawn and nothing is split, so what one business reads is what all of
                        them read. Press a name to read it.
                      </p>
                    </li>
                    <li className="border-hair-paper border-b py-1">
                      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-5 pb-2 pt-3">
                        <span className={`${MONO_LABEL} text-ink-paper`}>Sending</span>
                        <span className="text-paper-faint text-[11px]">
                          the letter every business hears, monthly
                        </span>
                      </span>
                      <ul className="divide-hair-paper divide-y">
                        {sendingLetters.map(entry => (
                          <LetterRow
                            key={entry.id}
                            variant={entry}
                            tone={SENDING_TONE}
                            selected={selected === entry.id}
                            saving={acting === `variant:${entry.id}`}
                            onOpen={openLetter}
                            onSet={setters[entry.id]}
                          />
                        ))}
                      </ul>
                    </li>
                    {retiredLetters.length ? (
                      <li className="py-1">
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-5 pb-2 pt-3">
                          <span className={`${MONO_LABEL} text-ink-paper`}>Retired</span>
                          <span className="text-paper-faint text-[11px]">
                            {fullCount(retiredLetters.length)} kept for the messages they sent
                          </span>
                        </span>
                        <ul className="divide-hair-paper divide-y">
                          {retiredLetters.map(entry => (
                            <LetterRow
                              key={entry.id}
                              variant={entry}
                              tone={RETIRED_TONE}
                              retired
                              selected={selected === entry.id}
                              onOpen={openLetter}
                            />
                          ))}
                        </ul>
                      </li>
                    ) : null}
                  </ul>
                )}
              </PanelBody>
              <PanelFoot>
                <p className="leading-relaxed">
                  A retired letter takes no new businesses and keeps the ones it already went to.
                  They are kept rather than deleted because every message they sent still names
                  them, and a name nothing answers to is a message nobody can read back.
                </p>
              </PanelFoot>
            </Panel>
          }
        >
          <Panel title="The Letter" aside={staged ? staged.name : undefined} loading={loading}>
            {/* The sheet takes the whole of the card at the desk width, and a
                floor of its own on a phone, where the card has no height to
                hand down and the letter would otherwise be a strip. */}
            <div className="flex min-h-[32rem] flex-1 flex-col lg:min-h-0">
              {staged ? (
                <LetterSheet
                  variant={staged}
                  preview={preview}
                  rendering={previewing === staged.id}
                  part={part}
                  onPart={setPart}
                  onProof={proofVariant}
                  proofing={acting === `proof:${staged.id}`}
                  proofed={proofed?.id === staged.id ? proofed : null}
                  results={stagedResults}
                  onResults={() => openMail('variants')}
                />
              ) : (
                <p className="px-5 py-10 text-center text-[13px] text-paper-soft">
                  Press a letter's name to read it as it would arrive.
                </p>
              )}
            </div>
          </Panel>
        </ConsoleSplit>
      ) : null}

      {view === 'settings' ? (
        <Board area="work" areas={['switches form']} cols="minmax(20rem,0.8fr) minmax(0,1.2fr)">
          <Panel area="switches" title="Switches" aside="what the engine is doing">
            <PanelBody>
              <Switch
                name="Sourcing"
                on={sourcing}
                loading={loading}
                busy={acting === 'sourcing_enabled'}
                onToggle={() => toggle('sourcing_enabled', !sourcing)}
                note={
                  sourcing
                    ? 'Sourcing is on. New businesses are being found in the towns and trades set beside this and added at the found stage.'
                    : 'Sourcing is off. No new businesses are being found, and the ones already on file stay where they are.'
                }
              />
              <Switch
                name="Sending"
                on={sending}
                loading={loading}
                busy={acting === 'sending_enabled'}
                onToggle={() => toggle('sending_enabled', !sending)}
                note={
                  sending
                    ? `Sending is on. Messages are written and go out to the addresses on file, up to ${fullCount(cap)} first letters a day, and the follow-ups owed go after them.`
                    : 'Sending is off. No email is going out and none is being written. Businesses wait at the stage before sending until it is switched on.'
                }
              />
            </PanelBody>
          </Panel>

          <Panel
            area="form"
            title="Settings"
            aside={settings?.updated_at ? `saved ${since(settings.updated_at)}` : 'never saved'}
            loading={loading}
          >
            {draft ? (
              <form onSubmit={saveSettings} className="flex min-h-0 flex-1 flex-col">
                <PanelBody className="grid gap-x-6 gap-y-4 px-5 py-4 xl:grid-cols-2">
                  <div className="grid content-start gap-4">
                    <label className="grid gap-1.5">
                      <span className={`${MONO_LABEL} text-paper-faint`}>Daily Cap</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={draft.daily_cap}
                        onChange={event => setEdited({ ...draft, daily_cap: event.target.value })}
                        className={`${FIELD} sm:max-w-[12rem]`}
                      />
                      <span className="text-paper-faint text-[12px] leading-relaxed">
                        The most first letters that go out in one day, counted from midnight
                        Central. There is no ceiling on it and it takes effect the moment it is
                        saved. The day is spaced out by this number, so raising it partway through
                        one leaves the morning's extra slots behind the clock and the runs left
                        catch up on them. The runs inside the sending window carry{' '}
                        {fullCount(DELIVERS_A_DAY)} between them at most. A number above that does
                        not send more; the day ends short of it. Follow-ups are outside it.
                      </span>
                    </label>

                    <label className="grid gap-1.5">
                      <span className={`${MONO_LABEL} text-paper-faint`}>From Name</span>
                      <input
                        type="text"
                        value={draft.from_name}
                        onChange={event => setEdited({ ...draft, from_name: event.target.value })}
                        className={FIELD}
                      />
                      <span className="text-paper-faint text-[12px] leading-relaxed">
                        The name a recipient sees in their inbox.
                      </span>
                    </label>
                    <label className="grid gap-1.5">
                      <span className={`${MONO_LABEL} text-paper-faint`}>From Address</span>
                      <input
                        type="email"
                        value={draft.from_address}
                        onChange={event =>
                          setEdited({ ...draft, from_address: event.target.value })
                        }
                        placeholder="name@example.com"
                        className={FIELD}
                      />
                      <span className="text-paper-faint text-[12px] leading-relaxed">
                        The address messages are sent from and replies come back to.
                      </span>
                    </label>
                  </div>

                  <div className="grid content-start gap-4">
                    <ListField
                      label="Towns"
                      placeholder="Add a town"
                      entries={draft.towns}
                      max={LIST_MAX}
                      onChange={towns => setEdited({ ...draft, towns })}
                      note={`Where sourcing looks. Every town is searched for every trade, which is ${fullCount(draft.towns.length * draft.trades.length)} searches in all.`}
                    />
                    <ListField
                      label="Trades"
                      placeholder="Add a trade"
                      entries={draft.trades}
                      max={LIST_MAX}
                      onChange={trades => setEdited({ ...draft, trades })}
                      note="What sourcing looks for in each town. A trade is the words a search would use, such as plumber or roofing contractor."
                    />
                  </div>
                </PanelBody>
                <PanelFoot>
                  <span>
                    {edited
                      ? 'Changes are held until they are saved.'
                      : 'Nothing has been changed.'}
                  </span>
                  <button type="submit" disabled={acting === 'settings'} className={BUTTON}>
                    {acting === 'settings' ? 'Saving' : 'Save Settings'}
                  </button>
                </PanelFoot>
              </form>
            ) : (
              <div className="grid gap-3 px-5 py-4">
                <SkeletonBar className="w-full max-w-[26rem]" />
                <SkeletonBar className="w-full max-w-[22rem]" />
              </div>
            )}
          </Panel>
        </Board>
      ) : null}

      {/* One business in full, over the table it was opened from. The head
          names the record rather than the business; the business is named
          inside, at the size a heading is read at. */}
      <SidePanel
        open={Boolean(openId)}
        title="Prospect Profile"
        aside={record ? record.name || 'Unnamed business' : undefined}
        onClose={closeProspect}
        loading={profileLoading}
      >
        <ProfileSheet
          record={record}
          error={profileError}
          loading={profileLoading}
          letters={variants}
          reason={reason}
          onReason={setReason}
          acting={acting}
          onSkip={id => act({ action: 'skip', id, reason }, 'skip')}
          onOpenLetter={openLetter}
        />
      </SidePanel>

      {/* The way in for a business no search returned. The fields are the ones
          a map result carries, so a row filed here is the same shape as every
          other row at the found stage and every job downstream reads it
          without knowing which way it arrived. */}
      <SidePanel open={panel === 'add'} title="Add Prospect" onClose={closeAdd}>
        <form onSubmit={submitAdd} className="grid gap-4 px-5 py-4">
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Business Name</span>
            <input
              required
              type="text"
              value={business.name}
              onChange={typeInto('name')}
              aria-invalid={nameFault ? 'true' : undefined}
              aria-describedby={nameFault ? 'add-name-note' : undefined}
              className={FIELD}
            />
            {nameFault ? (
              <p id="add-name-note" className={FAULT_NOTE}>
                {nameFault}
              </p>
            ) : null}
          </label>
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Town</span>
            <input
              type="text"
              value={business.town}
              onChange={typeInto('town')}
              className={FIELD}
            />
            <span className="text-paper-faint text-[12px] leading-relaxed">
              The town the business trades in. The message names it, and the chain rules count it.
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Trade</span>
            <input
              type="text"
              value={business.trade}
              onChange={typeInto('trade')}
              className={FIELD}
            />
            <span className="text-paper-faint text-[12px] leading-relaxed">
              What the business does, in the words a search would use, such as plumber or roofing
              contractor.
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Website</span>
            <input
              type="text"
              value={business.website}
              onChange={typeInto('website')}
              placeholder="example.com"
              aria-invalid={websiteFault ? 'true' : undefined}
              aria-describedby={websiteFault ? 'add-website-note' : undefined}
              className={FIELD}
            />
            {websiteFault ? (
              <p id="add-website-note" className={FAULT_NOTE}>
                {websiteFault}
              </p>
            ) : null}
            <span className="text-paper-faint text-[12px] leading-relaxed">
              The site enrichment reads an address off and the audit measures. Left out, enrichment
              looks for one.
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Postal Address</span>
            <input
              type="text"
              value={business.address}
              onChange={typeInto('address')}
              className={FIELD}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Phone</span>
            <input
              type="tel"
              value={business.phone}
              onChange={typeInto('phone')}
              className={FIELD}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={`${MONO_LABEL} text-paper-faint`}>Contact Address</span>
            <input
              type="email"
              value={business.email}
              onChange={typeInto('email')}
              placeholder="name@example.com"
              aria-invalid={emailFault ? 'true' : undefined}
              aria-describedby={emailFault ? 'add-email-note' : undefined}
              className={FIELD}
            />
            {emailFault ? (
              <p id="add-email-note" className={FAULT_NOTE}>
                {emailFault}
              </p>
            ) : null}
            <span className="text-paper-faint text-[12px] leading-relaxed">
              Where a message would go, where it is already known. One that has asked to be left
              alone is refused; one left blank is found by enrichment.
            </span>
          </label>

          {/* The panel covers the page, and with it the notice at the top of
              the page that every other refusal is read from. A business
              already on file is the ordinary answer here, so it is said where
              the typing is: under the field it is about, or here beside the
              button where it is about none of them. */}
          {addFault && !addFault.field ? (
            <p className={FAULT_NOTE} role="status">
              {addFault.said}
            </p>
          ) : null}

          <button type="submit" disabled={adding} className={`${BUTTON} justify-self-start`}>
            <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            {adding ? 'Adding' : 'Add Prospect'}
          </button>
          <p className="text-[13px] leading-relaxed text-paper-soft">
            The business enters at the found stage. Enrichment, the address check and the audit take
            it from there on their own schedules, and nothing is sent to it until they have.
          </p>
        </form>
      </SidePanel>
    </ConsolePage>
  )
}
