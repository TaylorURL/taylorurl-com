import { useEffect, useMemo, useRef } from 'react'
import { m } from 'framer-motion'
import { fadeInUp } from '@constants/animations'
import { useSession } from '@hooks/session/useSession'
import { ago, useNow } from '@hooks/console/useNow'
import { useServerFeed } from '@hooks/console/useServerFeed'
import { formatInstant } from '@lib/time/zone.js'
import {
  Area,
  Badge,
  ConsoleError,
  ConsolePage,
  Metric,
  Panel,
  PanelBody,
  SectionNotice,
  SkeletonBar,
  SkeletonRows,
  StatCard,
} from '../../ui'
import { CELL_TIGHT, ROW_HEIGHT, TH_TIGHT } from '../../lib/tokens'
import { recalledRows, rememberRows } from '../../lib/rowMemory'

/**
 * The Sunday Server, and every routine running on it.
 *
 * The Status section beside this answers for the sites. This answers for the
 * one machine underneath them, which runs everything visitor-facing that is
 * not a site: the collector that receives browser errors, the monitor that
 * checks each site from outside, the boards, the nightly sweeps, and the
 * routine that works the ticket queue.
 *
 * It exists because that machine's failure is the one failure nothing else on
 * this site can report. Every other section reads a database or an API that
 * answers from somewhere else, so a section with nothing in it means an empty
 * table. This machine stopping means the boards stop posting, the collector
 * stops filing and the queue stops filling - and an empty queue reads exactly
 * like a clean night. There was no way to tell those apart without opening a
 * terminal.
 *
 * So the page is built around the two things that answer it, and the routines
 * table is the more important of the two. A machine at four percent load with
 * a stopped social routine looks perfectly healthy from every angle but the
 * one that matters, which is why each routine is asked directly rather than
 * inferred from the machine being up.
 *
 * Every reading carries its own age. A feed that answers cleanly with an hour
 * old body is the failure this page is most likely to meet, because the
 * process serving the reading is itself one of the things that can die - so
 * the age of the reading is checked rather than the success of the request,
 * and a stale one says so across the top of the page instead of quietly
 * describing a moment that has passed.
 */

// The three states a row is in, as a word and the tones that carry it. A badge
// names its worst state `bad` and a tile names the same one `danger`, so each
// state carries both rather than a tile falling back to plain ink on the
// reading that most needs a colour.
const STATE = {
  operational: { label: 'Running', tone: 'good', card: 'good' },
  degraded: { label: 'Behind', tone: 'warn', card: 'warn' },
  down: { label: 'Stopped', tone: 'bad', card: 'danger' },
}

// The same three, said about the machine as a whole rather than about a row.
const OVERALL = {
  operational: { label: 'Healthy', card: 'good' },
  degraded: { label: 'Needs A Look', card: 'warn' },
  down: { label: 'In Trouble', card: 'danger' },
}

// Past this, the reading on screen is a description of a moment that has
// passed rather than of the machine now. The server rebuilds every half minute
// and this page asks every twenty seconds, so five minutes is many times over
// either and is only reached by something actually having stopped.
const STALE_AFTER_MS = 5 * 60_000

// Where the routines table keeps the shape of its last render, so the
// placeholder rows stand where the readings are about to land.
const ROWS_KEY = 'taylorurl_console_server_rows'

// The order the routines table reads in: whatever needs a person first, then
// everything else in the order the server lists it. Twelve rows is more than a
// card shows at once, and a stopped routine sorted to the bottom of a table
// that scrolls is a stopped routine nobody sees. A state the page cannot place
// ranks with the ones that are behind, for the same reason it is drawn as one.
const RANK = { down: 0, degraded: 1, operational: 2 }

// Below the small width the table is one column: each row says its name, its
// state, what it does, and its cadence and timings in a line underneath. Four
// columns at 375px leave the routine's own name about fifty pixels and wrap
// every description to eight lines.
const FROM_SM = 'hidden sm:table-cell'

// The cadence gets a column of its own once the desk is wide enough to give
// it one, which is past the 1280px a laptop gives the console: there the four
// fixed columns leave a routine's name a hundred and fifty pixels. Narrower
// than that it sits under the state.
const FROM_WIDE = 'hidden min-[1360px]:table-cell'

// Every cell sets its content from the top, so a name, a badge and a time all
// start on the same line however many lines the row runs to.
const CELL = `${CELL_TIGHT} align-top`

// The cells of the table in the order its head declares them.
const ROUTINE_CELLS = [
  CELL,
  `${CELL} ${FROM_SM}`,
  `${CELL} ${FROM_WIDE}`,
  `${CELL} ${FROM_SM}`,
  `${CELL} ${FROM_SM}`,
]

/** How long until, in the same units, for something that has not happened yet. */
function until(value, now) {
  if (!value) return null
  const seconds = Math.round((new Date(value).getTime() - now) / 1000)
  if (seconds <= 0) return 'due now'
  if (seconds < 60) return `in ${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `in ${hours}h`
  return `in ${Math.round(hours / 24)}d`
}

/**
 * How long the machine has been up, from the moment it started.
 *
 * A duration rather than a date, because nobody asks what day a server booted.
 * Days and hours, because a machine that has been up eleven days does not need
 * its minutes and one that has been up nine minutes is the interesting case
 * and gets them.
 */
function uptimeSince(bootedAt, now) {
  if (!bootedAt) return '—'
  const minutes = Math.max(0, Math.round((now - new Date(bootedAt).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

/** A moment, written in the studio's own zone the way every other stamp is. */
function when(value) {
  if (!value) return '—'
  return formatInstant(value, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Gigabytes, at the precision a person reading a disk actually wants. */
function gigabytes(value) {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value)} GB`
}

/** Megabytes as gigabytes, for the two memory figures. */
function asGigabytes(mb) {
  if (mb === null || mb === undefined) return '—'
  return `${(mb / 1024).toFixed(1)} GB`
}

/** A percentage's tone: quiet until it is worth looking at. */
function pressureTone(percent, warn, bad) {
  if (percent === null || percent === undefined) return 'plain'
  if (percent >= bad) return 'danger'
  if (percent >= warn) return 'warn'
  return 'plain'
}

/**
 * What each routine last did, and when it does it next.
 *
 * A continuous service has no last run, because it has not stopped; what it has
 * is a moment it started, and saying "last run 11 days ago" of a process that
 * has been running for eleven days would read as a process that had died. So a
 * service is asked when it started and everything else when it last fired.
 */
function lastLine(routine, now) {
  if (routine.since) return `up ${uptimeSince(routine.since, now)}`
  const last = ago(routine.last_run, now)
  if (last) return last
  // A sweep that finds nothing to do leaves nothing behind, so it has no last
  // run and is not meant to. Saying it has never run would report a routine
  // working exactly as designed as one that has never fired.
  if (routine.kind === 'sweep') return 'silent unless it acts'
  return 'no run recorded'
}

/** And when it does it again, for the two kinds that cannot answer that. */
function nextLine(routine, now) {
  // A service that has not stopped is not between runs.
  if (routine.kind === 'service') return 'always on'
  return until(routine.next_run, now) || 'on its schedule'
}

/**
 * When a routine last ran and when it runs next, said once in a line for the
 * phone, where there is no room for the two columns that say it on a desk.
 */
function timingLine(routine, now) {
  const next = routine.kind === 'service' ? null : until(routine.next_run, now)
  return [routine.cadence, lastLine(routine, now), next && `next ${next}`]
    .filter(Boolean)
    .join(' · ')
}

/**
 * A relative time over the clock time it stands for.
 *
 * "4h ago" is what a glance wants and the clock time is what anybody comparing
 * this against a log needs, so both are there and the first is the louder.
 */
function Moment({ line, at }) {
  return (
    <>
      <span className="block text-[13px] tabular-nums">{line}</span>
      {at && (
        <span className="text-paper-faint mt-0.5 block text-[11px] tabular-nums">{when(at)}</span>
      )}
    </>
  )
}

/**
 * Every routine, and whether it is doing what it is meant to.
 *
 * A table rather than a list of cards. Twelve routines is a column to scan
 * down for the one that is not green, and cards put that scan on two axes.
 * Whatever needs a person is sorted to the top and says why under its name,
 * so the answer is on screen without hovering a badge or scrolling the card.
 */
function RoutineTable({ routines, loading, now, placeholder }) {
  const body = useRef(null)

  useEffect(() => {
    if (!loading) rememberRows(ROWS_KEY, body.current)
  }, [loading, routines.length])

  return (
    <Panel
      title="Routines"
      aside={loading ? undefined : `${routines.length} on this machine`}
      loading={loading}
      area="routines"
      note="Everything scheduled to run on the server, whether it is running, and when it last did."
    >
      <PanelBody className="overflow-x-auto">
        <table className="console-table text-[13px]" aria-busy={loading}>
          <thead className="hidden sm:table-header-group">
            <tr>
              <th scope="col" className={TH_TIGHT}>
                Routine
              </th>
              <th
                scope="col"
                className={`${TH_TIGHT} ${FROM_SM} sm:w-[8.5rem] min-[1360px]:w-[7rem]`}
              >
                State
              </th>
              <th scope="col" className={`${TH_TIGHT} ${FROM_WIDE} min-[1360px]:w-[8.5rem]`}>
                Cadence
              </th>
              <th scope="col" className={`${TH_TIGHT} ${FROM_SM} sm:w-[8rem]`}>
                Last Run
              </th>
              <th scope="col" className={`${TH_TIGHT} ${FROM_SM} sm:w-[8rem]`}>
                Next Run
              </th>
            </tr>
          </thead>
          <tbody ref={body}>
            {loading && (
              <SkeletonRows
                cols={ROUTINE_CELLS}
                rows={placeholder.rows}
                height={placeholder.height}
                lastHeight={placeholder.lastHeight}
              />
            )}
            {routines.map(routine => {
              const state = STATE[routine.state] || STATE.degraded
              const trouble = routine.state !== 'operational' && routine.detail
              return (
                <tr key={routine.id} className="border-hair-paper border-t">
                  <td className={CELL}>
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 font-medium text-ink-paper">{routine.label}</span>
                      <span className="sm:hidden">
                        <Badge tone={state.tone} title={routine.detail}>
                          {state.label}
                        </Badge>
                      </span>
                    </span>
                    {/* One line on a desk, where the name is what is scanned
                        and the sentence is there to confirm it; the whole
                        sentence on a phone, where the row has the width to
                        itself. */}
                    <span
                      className="mt-0.5 block text-[12px] leading-snug text-paper-soft sm:truncate"
                      title={routine.does}
                    >
                      {routine.does}
                    </span>
                    {trouble && (
                      <span className="console-trouble mt-1.5">
                        <span className="console-trouble-mark" aria-hidden="true" />
                        {routine.detail}
                      </span>
                    )}
                    <span className="text-paper-faint mt-1.5 block text-[11px] tabular-nums sm:hidden">
                      {timingLine(routine, now)}
                    </span>
                  </td>
                  <td className={`${CELL} ${FROM_SM}`}>
                    <Badge tone={state.tone} title={routine.detail}>
                      {state.label}
                    </Badge>
                    <span className="text-paper-faint mt-1 block text-[11px] leading-snug min-[1360px]:hidden">
                      {routine.cadence}
                    </span>
                  </td>
                  <td className={`${CELL} ${FROM_WIDE} text-paper-mute`}>{routine.cadence}</td>
                  <td className={`${CELL} ${FROM_SM}`}>
                    <Moment line={lastLine(routine, now)} at={routine.last_run} />
                  </td>
                  <td className={`${CELL} ${FROM_SM}`}>
                    {/* A routine on a schedule the machine keeps outside its
                        own timers has no next fire to report, and the cadence
                        beside it is the whole of the answer. A service that has
                        not stopped has no next run at all. Saying either beats
                        an em dash, which reads as broken. */}
                    <Moment line={nextLine(routine, now)} at={routine.next_run} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </PanelBody>
    </Panel>
  )
}

/**
 * One reading against the room there is for it: the figure, what it is out
 * of, and a bar that fills to it.
 *
 * The bar is the same hairline track the share bars elsewhere in the console
 * draw on. It takes the reading's tone, so a card filling up turns the bar
 * amber before anybody has read the number on it.
 */
function Gauge({ label, percent, caption, tone, loading }) {
  const known = typeof percent === 'number'
  const fill = { plain: 'var(--accent)', warn: 'var(--warn)', danger: 'var(--danger-on-paper)' }
  return (
    <div className="px-5 py-3">
      <div className="flex items-baseline gap-2">
        <dt className="text-paper-mute flex-1 text-[13px]">{label}</dt>
        <dd className="flex items-baseline gap-2 text-[13px] font-medium tabular-nums text-ink-paper">
          {loading ? <SkeletonBar className="my-0.5 w-14" /> : known ? `${percent}%` : '—'}
          {!loading && caption && (
            <span className="text-paper-faint text-[12px] font-normal">{caption}</span>
          )}
        </dd>
      </div>
      <span
        aria-hidden="true"
        className="mt-2 block h-1 overflow-hidden rounded-[var(--r-tiny)] bg-[color:var(--paper-hairline-strong)]"
      >
        {!loading && known && (
          <span
            className="block h-full rounded-[var(--r-tiny)] transition-[width] duration-150 ease-out-soft"
            style={{
              width: `${Math.min(100, Math.max(2, percent))}%`,
              backgroundColor: fill[tone] || fill.plain,
            }}
          />
        )}
      </span>
    </div>
  )
}

/**
 * The gradual failures: a card filling up, a board running warm, a supply that
 * cannot keep up.
 *
 * None of these breaks anything on the day it starts, and none of them raises
 * an alert. They are here because the only way any of them was ever noticed
 * was by somebody going and looking.
 */
function CapacityCard({ server, loading }) {
  const disk = server?.disk
  const memory = server?.memory
  const load = server?.load
  const held = server?.throttling
  // A reading that could not be taken is a hole in the report rather than
  // evidence of a healthy board, so it says which it is. What the board has
  // been through since it started goes underneath rather than into the value,
  // where a sentence that long wraps the label beside it.
  const power = !held?.read
    ? 'Not readable on this machine'
    : held.now?.length
      ? held.now[0]
      : held.since_boot?.length
        ? 'Steady now'
        : 'Steady'
  const since = held?.read && !held.now?.length ? held.since_boot?.[0] : null
  return (
    <Panel title="Capacity" loading={loading}>
      <dl className="py-1">
        <Gauge
          label="Load"
          percent={load?.percent}
          caption={load?.cores === undefined ? undefined : `across ${load.cores} cores`}
          tone={pressureTone(load?.percent, 80, 150)}
          loading={loading}
        />
        <Gauge
          label="Disk Used"
          percent={disk?.percent}
          caption={disk?.free_gb === undefined ? undefined : `${gigabytes(disk.free_gb)} free`}
          tone={pressureTone(disk?.percent, 80, 92)}
          loading={loading}
        />
        <Gauge
          label="Memory Used"
          percent={memory?.percent}
          caption={
            memory?.total_mb === undefined ? undefined : `of ${asGigabytes(memory.total_mb)}`
          }
          tone="plain"
          loading={loading}
        />
        <div className="px-5 py-2.5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-paper-mute text-[13px]">Power</dt>
            <dd className="text-right text-[13px] font-medium text-ink-paper">
              {loading ? <SkeletonBar className="my-0.5 w-16" /> : power}
            </dd>
          </div>
          {!loading && since && (
            <dd className="text-paper-faint mt-1 text-[12px] leading-snug">
              {since.charAt(0).toUpperCase() + since.slice(1)}.
            </dd>
          )}
        </div>
      </dl>
    </Panel>
  )
}

/** What the machine is, for whoever has to go and find it. */
function MachineCard({ server, loading }) {
  const host = server?.host
  return (
    <Panel title="Machine" loading={loading}>
      <PanelBody>
        <dl>
          <Metric
            label="Started"
            value={when(host?.booted_at)}
            caption="Central time"
            loading={loading}
          />
          {/* One fact a row. The board, the system on it and the kernel that
              system is running are three separate answers, and a caption hung
              off the second sets two of them side by side in a column narrow
              enough to wrap both. */}
          <Metric label="Hardware" value={host?.model || '—'} loading={loading} />
          <Metric label="System" value={host?.os || '—'} loading={loading} />
          <Metric label="Kernel" value={host?.kernel || '—'} loading={loading} />
        </dl>
      </PanelBody>
    </Panel>
  )
}

export default function ServerPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const { server, error, fetchedAt, loading } = useServerFeed({
    token,
    enabled: Boolean(token),
  })
  const now = useNow(10_000)
  const routines = useMemo(
    () =>
      (server?.routines ?? [])
        .map((routine, at) => ({ routine, at }))
        .sort(
          (a, b) =>
            (RANK[a.routine.state] ?? RANK.degraded) - (RANK[b.routine.state] ?? RANK.degraded) ||
            a.at - b.at
        )
        .map(({ routine }) => routine),
    [server]
  )
  const remembered = recalledRows(ROWS_KEY, 12, ROW_HEIGHT.serverRoutine)

  const overall = OVERALL[server?.overall] || OVERALL.degraded
  const stopped = routines.filter(routine => routine.state === 'down').length
  const behind = routines.filter(routine => routine.state === 'degraded').length
  const host = server?.host
  const temperature = server?.temperature_c

  // The reading's own age, taken from the moment the server says it built it
  // rather than from the moment this page fetched it. A feed can answer
  // instantly with a body nothing has refreshed for an hour, and that is the
  // failure most likely to be met here.
  const builtAt = server?.updated_at ? new Date(server.updated_at).getTime() : null
  const stale = builtAt !== null && now - builtAt > STALE_AFTER_MS

  // Why the headline says what it says.
  //
  // The server works that out for itself and sends the reasons along, which is
  // the only place some of them exist at all: a routine that is behind has a
  // row of its own to show it, and a card filling up or a supply that cannot
  // keep up has nothing but a bar's colour. A tile that turns amber and never
  // says what about is a tile that sends the reader looking through a table
  // where the answer is not.
  const notes = server?.notes ?? []
  const why = notes.length > 1 ? `${notes[0]}, and ${notes.length - 1} more` : notes[0]

  // A page with nothing to draw and a failure to report is the failure, and
  // the tiles above an empty table would state four findings the feed never
  // gave. Everything after this has a reading to draw from.
  if (error && !server) return <SectionNotice>{error}</SectionNotice>

  return (
    <ConsolePage
      areas={
        error || stale
          ? ['note note', 'figures figures', 'routines side']
          : ['figures figures', 'routines side']
      }
      cols="minmax(0,1fr) 20rem"
      rows={error || stale ? 'auto auto minmax(0,1fr)' : 'auto minmax(0,1fr)'}
    >
      {(error || stale) && (
        <Area area="note">
          <ConsoleError>
            {error ||
              `This reading is ${ago(server.updated_at, now)} and the server has not sent a newer one. Everything below describes the machine as it was then.`}
          </ConsoleError>
        </Area>
      )}

      <Area area="figures">
        <m.div {...fadeInUp} className="console-stats" aria-busy={loading}>
          <StatCard
            label="Sunday Server"
            value={loading ? '—' : overall.label}
            // What is wrong, where there is something. A settled machine has
            // nothing to name, so the tile says how fresh the reading is
            // instead, which is the one thing it alone knows.
            caption={
              loading
                ? 'the machine overall'
                : why || (fetchedAt ? `read ${ago(fetchedAt, now)}` : 'the machine overall')
            }
            loading={loading}
            tone={loading || stale ? 'plain' : overall.card}
          />
          <StatCard
            label="Routines"
            value={loading ? '—' : `${routines.length - stopped - behind}/${routines.length}`}
            caption="running as they should"
            loading={loading}
            tone={loading || stopped ? 'danger' : behind ? 'warn' : 'plain'}
          />
          {/* How long it has been up, as a duration rather than a date: a
              machine that restarted nine minutes ago is the interesting case,
              and a boot stamp makes the reader do the subtraction. */}
          <StatCard
            label="Up for"
            value={uptimeSince(host?.booted_at, now)}
            caption={
              host?.booted_at
                ? `since ${when(host.booted_at)}`
                : loading
                  ? 'since it started'
                  : 'start time not reported'
            }
            loading={loading}
          />
          <StatCard
            label="Temperature"
            value={temperature === null || temperature === undefined ? '—' : `${temperature}°C`}
            caption="on the board"
            loading={loading}
          />
        </m.div>
      </Area>

      <RoutineTable routines={routines} loading={loading} now={now} placeholder={remembered} />

      {/* The two cards beside the table hold the height their facts need and
          no more, rather than each stretching to half the column and leaving a
          card of air under four lines. On a short screen the column scrolls
          on its own, the way the table beside it does. */}
      <Area area="side" className="overflow-y-auto [&>*]:flex-shrink-0">
        <CapacityCard server={server} loading={loading} />
        <MachineCard server={server} loading={loading} />
      </Area>
    </ConsolePage>
  )
}
