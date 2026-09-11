import { memo, useMemo } from 'react'
import { Phone } from 'lucide-react'
import { formatInstant } from '@lib/time/zone.js'
import { scriptFor } from '@lib/outreach/prospects/handbook.js'
import {
  CALL_OUTCOMES,
  OUTCOME_FLOOR_HOURS,
  callTakesOwner,
  dialHref,
  outcomeOf,
  ownerOf,
  whyListed,
} from '@lib/outreach/prospects/calls.js'
import { platformName, hostOf } from '@lib/outreach/prospects/platforms.js'
import { fullCount } from '../../../analytics/lib/format'
import { callerMark, callerName } from '@lib/outreach/prospects/callPresence.js'
import { Badge } from '../../ui'
import { BUTTON, MONO_LABEL, QUIET } from '../../lib/tokens'

/**
 * One business, as the conversation it actually is.
 *
 * A call to this list is almost never the first one. The ladder rings a number
 * at a day, three days, a week, a fortnight and a month, so a business that
 * does not answer is dialled about six times over two months, and a business
 * that does is rung again after whatever it said. All of that used to reach the
 * caller as one clause - "Rung 3 times, last Sep 2 by Dylan" - with what was
 * actually said, who to ask for and what was promised sitting in a note nobody
 * opens while a phone is ringing.
 *
 * So the calls are drawn as a column and the one being placed is the last entry
 * in it, in the same shape as the ones above and still empty. A caller reads
 * down and arrives at their own turn, which is the order the conversation
 * happened in and the order the next sentence has to follow from.
 *
 * THE GAP BETWEEN TWO ENTRIES IS DRAWN. It is the one place the wait is a fact
 * somebody can see rather than a rule in a file, and it says two things at
 * once: how long the ladder meant to hold them, and how long actually passed.
 * Those are different numbers far more often than they should be, and the
 * difference is a business that came back onto the list and nobody rang.
 *
 * THE SCRIPT IS IN THE LAST ENTRY. `scriptFor` has always composed an opener
 * out of the row on screen, and until now the only way to it was a search field
 * in an overlay three columns away from the business it was written about. It
 * belongs where the call is: under "This Call", above the buttons that end it.
 *
 * Nothing here sends anything. The one action is recording what a person heard
 * when somebody picked up a phone.
 */

/** A day and a clock, the way the rest of the section writes one. */
function when(value) {
  if (!value) return '—'
  return formatInstant(new Date(value), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** A run of hours said the way a person says it. */
function saidHours(hours) {
  if (hours === null || hours === undefined) return 'no time at all'
  if (hours < 48) return 'a day'
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} days`
  if (days === 7) return 'a week'
  if (days === 14) return 'a fortnight'
  return `${Math.round(days / 7)} weeks`
}

/** A run of days between two calls, said the same way. */
function saidDays(ms) {
  const days = Math.round(ms / 86_400_000)
  if (days <= 0) return 'The same day'
  if (days === 1) return 'One day'
  if (days === 7) return 'A week'
  if (days === 14) return 'A fortnight'
  return `${days} days`
}

/**
 * What sat between two calls, and what was meant to.
 *
 * The floor is what the outcome buys on its own, which is the figure a caller
 * can actually act on: a business rung once and not answered is back tomorrow,
 * and a fortnight between those two calls is twelve days nobody was working.
 * Where the two agree the sentence says so and stops.
 */
function gapLine(earlier, later) {
  const from = new Date(earlier?.called_at ?? '').getTime()
  const to = new Date(later?.called_at ?? '').getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null
  const elapsed = to - from
  const floor = OUTCOME_FLOOR_HOURS[earlier?.outcome]
  const said = saidDays(elapsed)
  if (!floor) return `${said} passed.`
  const bought = floor * 3_600_000
  if (elapsed <= bought * 1.5) {
    return `${said} passed, which is about what ${outcomeOf(earlier.outcome)?.label ?? 'that'} buys.`
  }
  return `${said} passed. ${outcomeOf(earlier.outcome)?.label ?? 'That'} rests them ${saidHours(floor)}, so the rest of it was nobody ringing.`
}

/**
 * The business in one line, which is what the card used to spend four metric
 * tiles and two sentences on.
 *
 * Every figure here is one a caller says out loud on the call rather than one
 * they study, and the script two blocks down says each of them in a sentence.
 * So they are set as facts in a row: enough to recognise the business and to
 * catch a wrong number before the phone is picked up, and no more.
 */
function facts(row) {
  const said = [row.trade, row.town]
  if (typeof row.rating_count === 'number') {
    const rating = row.rating === null || row.rating === undefined ? null : Number(row.rating)
    const count = fullCount(row.rating_count)
    said.push(rating === null ? `${count} reviews` : `${count} reviews at ${rating.toFixed(1)}`)
  }
  if (row.trade_median !== null && row.trade_median !== undefined) {
    said.push(`Trade middle ${fullCount(Math.round(row.trade_median))}`)
  }
  said.push(
    row.site_kind === 'none'
      ? 'No site at all'
      : platformName(hostOf(row.website)) || 'A platform page'
  )
  return said.filter(Boolean)
}

/** One call already on the record. */
function Entry({ call, nth, you, name }) {
  const outcome = outcomeOf(call.outcome)
  const by = call.called_by === you ? 'you' : (name ?? 'somebody else')
  return (
    <li className="console-spine-entry">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="text-[13px] font-semibold text-ink-paper">{nth}</h4>
        <p className={`${MONO_LABEL} text-paper-faint`}>
          {when(call.called_at)} &middot; {by}
        </p>
        <Badge tone={outcome?.tone ?? 'plain'}>{outcome?.label ?? call.outcome}</Badge>
        {call.callback_at && <Badge tone="accent">Asked for {when(call.callback_at)}</Badge>}
      </div>
      {call.note ? (
        <p className="max-w-[68ch] text-[14px] leading-relaxed text-ink-paper">{call.note}</p>
      ) : (
        <p className={`${MONO_LABEL} text-paper-faint`}>Nothing was written down.</p>
      )}
    </li>
  )
}

/** How a call is named by its place in the thread. */
const NTH = ['First Call', 'Second Call', 'Third Call', 'Fourth Call', 'Fifth Call']
const nameOf = index => NTH[index] ?? `Call ${index + 1}`

/**
 * The business, its thread, and the turn about to be taken.
 */
function CallRecord({
  row,
  caller,
  saving,
  recorded,
  asking,
  holder,
  you,
  onQuick,
  onAnswer,
  onDrop,
  onOpen,
  onSkip,
}) {
  const href = dialHref(row.phone)
  // The thread as a flat run of entries and the gaps between them, oldest
  // first. Built here rather than in the markup because a gap belongs between
  // two calls rather than to either of them, and a list that computes one
  // inside its own map has to reach forward a row to do it.
  //
  // The feed hands the calls back newest first, which is the order a table
  // wants and the reverse of the order a conversation happened in.
  const thread = useMemo(() => {
    const calls = [...(row.calls ?? [])].reverse()
    const run = []
    calls.forEach((call, index) => {
      run.push({ kind: 'call', call, nth: nameOf(index), key: call.id ?? `call-${index}` })
      const next = calls[index + 1]
      const said = next ? gapLine(call, next) : null
      if (said) run.push({ kind: 'gap', said, key: `gap-${call.id ?? index}` })
    })
    return { run, placed: calls.length }
  }, [row.calls])
  const script = useMemo(() => scriptFor(row, caller), [row, caller])

  return (
    <div className="grid gap-4 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5">
        <div className="min-w-0">
          <h3 className="text-[21px] leading-tight tracking-tight text-ink-paper">
            {row.name || 'Unnamed business'}
          </h3>
          <p className="mt-0.5 text-[13px] text-paper-soft">{facts(row).join(' · ')}</p>
          <p className="text-paper-faint text-[13px]">{row.address || '—'}</p>
        </div>
        {/* Somebody got to this one first. The number is drawn quiet rather
            than removed - the batch is a snapshot and they may have hung up by
            now - and the way past it is offered right here. */}
        {holder ? (
          <div className="border-hair-paper grid gap-2 rounded-[var(--console-radius-sm)] border px-4 py-3">
            <p className={`${MONO_LABEL} flex items-center gap-2 text-accent`}>
              <Badge tone="accent">{callerMark(holder)}</Badge>
              {callerName(holder)} is on this call.
            </p>
            <button type="button" className={BUTTON} onClick={onSkip}>
              Skip to the Next
            </button>
          </div>
        ) : (
          href && (
            <a href={href} className={`${BUTTON} min-h-[52px] text-[17px]`}>
              <Phone aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
              {row.phone}
            </a>
          )
        )}
      </div>

      {/* Whose business this is, said before the number is pressed. A caller
          about to ring somebody else's business is about to have a first
          conversation with a business that has already had one. */}
      <p className={`${MONO_LABEL} text-paper-faint`}>
        {callTakesOwner(row)
          ? 'Nobody holds this one. Recording a call puts it in your name.'
          : ownerOf(row) === you
            ? 'Yours since the first call.'
            : `${callerName({ name: row.assigned_name })} holds this one.`}
      </p>

      <ol className="console-spine">
        {thread.run.map(step =>
          step.kind === 'gap' ? (
            <li key={step.key} className="console-spine-gap">
              {step.said}
            </li>
          ) : (
            <Entry
              key={step.key}
              call={step.call}
              nth={step.nth}
              you={you}
              name={step.call.called_by_name}
            />
          )
        )}

        <li className="console-spine-entry" data-now="true">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h4 className="text-[13px] font-semibold text-ink-paper">{nameOf(thread.placed)}</h4>
            <p className={`${MONO_LABEL} text-paper-faint`}>Now &middot; you</p>
            <Badge tone="accent">Not Recorded</Badge>
          </div>

          <div className="grid gap-3">
            {asking ? (
              <div className="grid gap-2">
                <p className="text-[15px] text-ink-paper">
                  {outcomeOf(asking)?.label}. Were they interested?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`${BUTTON} min-h-[48px]`}
                    disabled={saving}
                    onClick={() => onAnswer(true)}
                  >
                    <span className="mr-1 rounded-[var(--r-tiny)] border border-current px-1">
                      Y
                    </span>
                    Interested
                  </button>
                  <button
                    type="button"
                    className={`${QUIET} min-h-[48px] justify-center`}
                    disabled={saving}
                    onClick={() => onAnswer(false)}
                  >
                    <span className="border-hair-paper mr-1 rounded-[var(--r-tiny)] border px-1">
                      N
                    </span>
                    Not Interested
                  </button>
                  <button
                    type="button"
                    className={`${QUIET} col-span-2 min-h-[48px] justify-center`}
                    disabled={saving}
                    onClick={() => onAnswer(null)}
                  >
                    <span className="border-hair-paper mr-1 rounded-[var(--r-tiny)] border px-1">
                      S
                    </span>
                    They Did Not Say
                  </button>
                </div>
                <p className={`${MONO_LABEL} text-paper-faint`}>
                  Not interested leaves them on the call list and off the lead list. Anything else
                  puts them in the lead list.
                </p>
                <button type="button" className={QUIET} disabled={saving} onClick={onDrop}>
                  Back to the Outcomes
                </button>
              </div>
            ) : (
              <>
                <section className="console-say">
                  <div className="console-say-line">
                    <p className={`${MONO_LABEL} text-paper-faint`}>Why They Are On The List</p>
                    <p className="max-w-[68ch] text-[14px] leading-relaxed text-paper-soft">
                      {whyListed(row)}
                    </p>
                  </div>
                  {script.map(beat => (
                    <div key={beat.id} className="console-say-line">
                      <p className={`${MONO_LABEL} text-paper-faint`}>{beat.label}</p>
                      <p className="max-w-[68ch] text-[15px] leading-relaxed text-ink-paper">
                        {beat.say}
                      </p>
                    </div>
                  ))}
                </section>

                <div className="grid gap-2">
                  <p className={`${MONO_LABEL} text-paper-faint`}>
                    {recorded || 'What did the call come to?'}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {CALL_OUTCOMES.map(outcome => (
                      <button
                        key={outcome.id}
                        type="button"
                        className={QUIET}
                        disabled={saving}
                        onClick={() => onQuick(outcome.id)}
                      >
                        <span className="border-hair-paper mr-1 rounded-[var(--r-tiny)] border px-1">
                          {outcome.key}
                        </span>
                        {outcome.label}
                      </button>
                    ))}
                  </div>
                  <button type="button" className={QUIET} onClick={() => onOpen(row)}>
                    Open the Record to Add a Note or a Time
                  </button>
                </div>
              </>
            )}
          </div>
        </li>
      </ol>
    </div>
  )
}

export default memo(CallRecord)
