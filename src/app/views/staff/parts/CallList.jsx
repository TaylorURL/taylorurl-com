import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Phone } from 'lucide-react'
import { useCallDesk } from '@hooks/console/useCallDesk'
import { useCallsFeed } from '@hooks/console/useCallsFeed'
import { dialHref, placeOf, tellingTerms, whyListed } from '@lib/outreach/prospects/calls.js'
import { CALL_SORTS } from '@lib/outreach/prospects/callPrefs.js'
import {
  callerName,
  heldByOther,
  onPhoneNow,
  saidSince,
} from '@lib/outreach/prospects/callPresence.js'
import { useStaff } from '../lib/context'
import { usePortalNav } from '../lib/nav'
import { callDay, callLine, callMoment, marksFor } from '../lib/call'

/** The three things somebody opens this list to look at. */
const LIST_VIEWS = Object.freeze([
  { key: 'list', label: 'To Call' },
  { key: 'resting', label: 'Resting' },
  { key: 'finished', label: 'Finished' },
])

/** How many businesses a page holds. */
const TAKE = 25

/** How many placeholder rows stand in while the first read is out. */
const GHOSTS = 6

/**
 * The businesses to ring, in the order to ring them, and what happened when
 * they were rung.
 *
 * The cold email engine next door ends at an address, and about a fifth of what
 * the map sweep finds has none: the listing names no website at all, or names a
 * Facebook page, an Instagram profile, a Linktree or a Square booking page whose
 * only published address belongs to the platform. Those rows stop at
 * 'unreachable' and the pipeline is done with them - and they are the strongest
 * leads on the table, because the thing being sold is the thing they visibly do
 * not have. Every one of them carries the phone number the same search returned.
 * This is the list they are rung from.
 *
 * THE CALLS ARE NOT LOGGED HERE. The Call Center is the one screen that files a
 * call: one business, the script beside it, and no way past it but a logged
 * call. This is the list behind that screen - what is on it, why each business
 * sorts where it does, who is on a number this minute, and every call anybody
 * has placed. A business picked out here is handed to the Call Center by name,
 * which is the whole reason a list of fifteen hundred is worth reading rather
 * than working from the top down.
 *
 * Four things this list has to do that a column of names does not.
 *
 * SAY WHY EACH BUSINESS IS HERE. `skip_reason` is the enrichment job's own words
 * for why it gave up, and it is also the first thing to say on the call, so the
 * row that opens leads with it.
 *
 * SAY WHY THEY SORT. The score is an integer out of a hundred and its
 * decomposition is the score function's own return value, so the reasons in the
 * row and the figure beside them read one object and cannot drift into two
 * arithmetics. The largest term is how the listing reads against the middle
 * listing in its own trade, because review counts are not comparable across
 * trades: a restaurant collects reviews from every table it turns and a machine
 * shop from the two customers a year who think to leave one.
 *
 * SAY WHO IS ON A NUMBER RIGHT NOW. Suppression only ever works backwards - a
 * business comes off the list once a call to it has been recorded, and the whole
 * of a double call happens in the four minutes before anybody records anything.
 * So the line above the rows says who is on the phone and what with, and the row
 * itself says so again beside its own number, where it is read in the second
 * before somebody dials.
 *
 * WORK ON A PHONE. A caller reads this standing up, so it is rows that fold
 * rather than a table that scrolls sideways: the name, where it is and what it
 * scored on the face of the row, and everything else a press away.
 *
 * Nothing here sends anything and nothing here edits anything.
 *
 * @param {{Shell: React.ComponentType}} props
 */
export default function CallList({ Shell }) {
  const { token, userId } = useStaff()
  const nav = usePortalNav()
  const desk = useCallDesk({ token, userId, enabled: Boolean(token) })

  const [view, setView] = useState('list')
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [town, setTown] = useState('')
  const [trade, setTrade] = useState('')
  const [sort, setSort] = useState('best')
  const [page, setPage] = useState(1)

  // A fetch per keystroke re-reads the whole callable set and the whole calls
  // table, so the typing and the question are two states with a pause between.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed), 250)
    return () => clearTimeout(timer)
  }, [typed])

  // A new question selects different businesses, and page four of the last one
  // is no part of it.
  useEffect(() => {
    setPage(1)
  }, [view, search, town, trade, sort])

  const filters = useMemo(
    () => ({ view, search, town, trade, sort, take: TAKE, page }),
    [view, search, town, trade, sort, page]
  )
  const feed = useCallsFeed({ token, enabled: Boolean(token), filters })

  // `shown` is the answer to the question being asked, or the last one that
  // landed while that answer is on its way. A view picked or a page turned used
  // to replace a correct list with grey bars for as long as it took to re-rank
  // every callable business; the businesses did not stop existing while that
  // happened, so they stay on screen and the head says the list is a question
  // behind.
  const rows = feed.shown?.rows ?? []
  const matched = feed.shown?.matched ?? 0
  const pages = feed.retained?.pages ?? 1
  const towns = feed.retained?.towns ?? []
  const trades = feed.retained?.trades ?? []
  const totals = feed.retained?.totals ?? null

  const calling = useMemo(() => onPhoneNow(desk.presence ?? []), [desk.presence])

  const aside = feed.loading ? null : (
    <span className="staff-badge">
      {feed.behind ? 'Reading' : `${matched.toLocaleString('en-US')} listed`}
    </span>
  )

  return (
    <Shell title="Call List" back={{ to: nav.hrefFor('portal'), label: 'Portal' }} aside={aside}>
      {/* Who is on the phone, and what with. It sits above the rows rather than
          in a card somewhere on the page because it is read in the second
          before somebody presses a number. It waits for the read: "nobody is on
          a call" drawn from a guess is the one sentence that would make
          somebody dial. */}
      <div className="staff-part">
        <h3>On The Phone</h3>
        {desk.loading ? (
          <p className="staff-read">Loading</p>
        ) : calling.length ? (
          <ul className="staff-onphone-list">
            {calling.map(row => (
              <li key={row.user_id}>
                <b>{row.user_id === userId ? 'You' : callerName(row)}</b>
                <span>{row.business?.name || 'a business'}</span>
                <span className="staff-aside">{saidSince(row.on_phone_since)}</span>
                {/* Your own claim, and the way to give it back. A number held
                    by a tab that was left open reads to everybody else as a
                    call in progress until the beat expires, and the person who
                    can say otherwise is the one looking at their own name. */}
                {row.user_id === userId && (
                  <button type="button" className="staff-quiet" onClick={desk.dropNumber}>
                    Hang Up
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="staff-read">Nobody is on a call.</p>
        )}
        <p className="staff-read">
          Read this before you dial. Anyone named here is already on that business.
        </p>
      </div>

      {totals && (
        <dl className="staff-counts">
          <div>
            <dd>{totals.call}</dd>
            <dt>To Call</dt>
          </div>
          <div>
            <dd>{totals.due}</dd>
            <dt>Due Back</dt>
          </div>
          <div>
            <dd>{totals.resting}</dd>
            <dt>Resting</dt>
          </div>
          <div>
            <dd>{totals.booked + totals.closed}</dd>
            <dt>Finished</dt>
          </div>
        </dl>
      )}

      <div className="staff-controls">
        <div className="staff-tags">
          {LIST_VIEWS.map(one => (
            <button
              key={one.key}
              type="button"
              className="staff-tag"
              aria-pressed={view === one.key}
              onClick={() => setView(one.key)}
            >
              {one.label}
            </button>
          ))}
        </div>

        <input
          className="staff-input"
          type="search"
          value={typed}
          onChange={event => setTyped(event.target.value)}
          placeholder="Name, town or trade"
          aria-label="Search the Call List"
        />

        <div className="staff-picks">
          <label className="staff-pick">
            <span className="staff-label">Town</span>
            <select
              className="staff-select"
              value={town}
              onChange={event => setTown(event.target.value)}
            >
              <option value="">Every town</option>
              {towns.map(one => (
                <option key={one} value={one}>
                  {one}
                </option>
              ))}
            </select>
          </label>
          <label className="staff-pick">
            <span className="staff-label">Trade</span>
            <select
              className="staff-select"
              value={trade}
              onChange={event => setTrade(event.target.value)}
            >
              <option value="">Every trade</option>
              {trades.map(one => (
                <option key={one} value={one}>
                  {one}
                </option>
              ))}
            </select>
          </label>
          <label className="staff-pick">
            <span className="staff-label">Order</span>
            <select
              className="staff-select"
              value={sort}
              onChange={event => setSort(event.target.value)}
              // Resting sorts by whichever comes back soonest and Finished by
              // whichever ended last, and neither is a choice: an order picked
              // here would be an order the endpoint ignores.
              disabled={view !== 'list'}
            >
              {CALL_SORTS.map(one => (
                <option key={one.id} value={one.id}>
                  {one.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {feed.error ? (
        <div className="staff-spent">
          <h2>The list did not load</h2>
          <p>{feed.error}</p>
        </div>
      ) : feed.loading ? (
        <div className="staff-rows" aria-busy="true">
          {Array.from({ length: GHOSTS }, (unused, at) => (
            <div className="staff-row staff-row-ghost" key={at}>
              <span className="staff-ghost staff-ghost-name" />
              <span className="staff-ghost staff-ghost-where" />
            </div>
          ))}
        </div>
      ) : rows.length ? (
        <div className="staff-rows">
          {rows.map(row => (
            <Business
              key={row.id}
              row={row}
              held={heldByOther(desk.held, row.id, userId)}
              to={nav.hrefFor('calls', { on: row.id })}
            />
          ))}
        </div>
      ) : (
        <div className="staff-spent">
          <h2>Nothing here</h2>
          <p>
            {view === 'resting'
              ? 'Nothing is resting. Every business either waits for a call or is finished with.'
              : view === 'finished'
                ? 'Nothing has come off the list yet.'
                : search || town || trade
                  ? 'No business matches that. Widen it and look again.'
                  : 'Every available lead has been called. Leads on callback return when their time comes.'}
          </p>
        </div>
      )}

      {pages > 1 && (
        <div className="staff-pager">
          <button
            type="button"
            className="staff-quiet"
            onClick={() => setPage(at => Math.max(1, at - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft aria-hidden="true" />
            Back
          </button>
          <span className="staff-label">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            className="staff-quiet"
            onClick={() => setPage(at => Math.min(pages, at + 1))}
            disabled={page >= pages}
          >
            Next
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      )}
    </Shell>
  )
}

/**
 * One business, folded.
 *
 * The face of the row is what decides whether to ring it: the name, where it
 * is, where it sits on the list and what it scored. Everything that explains
 * those - why it is listed at all, which terms carried the score, and every
 * call already placed - is one press underneath, because a list of twenty-five
 * businesses each explaining itself is a list nobody reaches the bottom of.
 *
 * A business somebody else is on the phone with says so instead of offering its
 * number. The claim is not a lock and the endpoints do not treat it as one - it
 * expires on its own and a caller can always dial from their own handset - but a
 * row that quietly offers a number a colleague is already speaking into is the
 * one failure a shared queue produces on its own.
 *
 * @param {{row: object, held: object|null, to: string}} props
 */
function Business({ row, held, to }) {
  const place = placeOf(row.place)
  const reasons = tellingTerms(row.terms)

  return (
    <details className="staff-row">
      <summary>
        <span className="staff-row-head">
          <b>{row.name}</b>
          <span className="staff-row-score" title="Out of a hundred">
            {row.score}
          </span>
        </span>
        <span className="staff-row-where">
          {[row.trade, row.town].filter(Boolean).join(' in ') || 'Trade not on file'}
        </span>
        <span className="staff-marks">
          {place && (
            <span className="staff-badge" data-tone={place.tone}>
              {place.label}
            </span>
          )}
          {marksFor(row).map(mark => (
            <span key={mark.key} className="staff-badge" data-tone={mark.tone}>
              {mark.label}
            </span>
          ))}
          {held && (
            <span className="staff-badge" data-tone="warn">
              {callerName(held)} Is On This
            </span>
          )}
        </span>
      </summary>

      <div className="staff-row-body">
        {held ? (
          <p className="staff-read">
            {callerName(held)} has been on this number {saidSince(held.on_phone_since)}. Leave it
            with them and take the next one.
          </p>
        ) : (
          <div className="staff-row-acts">
            <a className="staff-dial" href={dialHref(row.phone)}>
              <Phone aria-hidden="true" />
              {row.phone}
            </a>
            <Link className="staff-btn" to={to}>
              Open in Call Center
            </Link>
          </div>
        )}

        <p className="staff-read">{whyListed(row)}</p>

        {reasons.length > 0 && (
          <div className="staff-marks">
            {reasons.map(term => (
              <span
                key={term.id}
                className="staff-badge"
                data-tone={term.points < 0 ? 'bad' : 'plain'}
              >
                {term.chip}
              </span>
            ))}
          </div>
        )}

        <dl className="staff-pairs">
          <div>
            <dt>Address</dt>
            <dd>{row.address || 'Not on file'}</dd>
          </div>
          <div>
            <dt>Reviews</dt>
            <dd>{row.rating ? `${row.rating} from ${row.rating_count ?? 0}` : 'Not on file'}</dd>
          </div>
          <div>
            <dt>Website</dt>
            <dd>{row.site_kind === 'social' ? 'Social page only' : 'None'}</dd>
          </div>
          <div>
            {/* A time the owner named is a different fact from a rest running
                out, and reading the first as the second is how a caller rings
                somebody an hour before they asked to be rung. */}
            <dt>{row.callback_at ? 'Callback' : 'Available'}</dt>
            <dd>
              {row.callback_at
                ? callMoment(row.callback_at)
                : row.ready_at
                  ? callMoment(row.ready_at)
                  : 'Now'}
            </dd>
          </div>
        </dl>

        <div className="staff-part">
          <h3>Call History</h3>
          {row.calls?.length ? (
            <dl className="staff-record">
              {row.calls.map(call => (
                <div key={call.id}>
                  <dt>{callDay(call.called_at)}</dt>
                  <dd>
                    {callLine(call)}
                    {call.note ? `. ${call.note}` : ''}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="staff-read">No calls yet.</p>
          )}
        </div>
      </div>
    </details>
  )
}
