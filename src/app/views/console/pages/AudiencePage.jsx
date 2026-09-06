import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Upload, X } from 'lucide-react'
import { useSession } from '@hooks/useSession'
import { useAudienceFeed } from '@hooks/useAudienceFeed'
import {
  Area,
  Badge,
  ConsoleError,
  ConsolePage,
  EmptyRow,
  Metric,
  Panel,
  PanelBody,
  PanelFill,
  PanelFoot,
  SectionNotice,
  SkeletonBox,
  SkeletonRows,
  ViewNav,
} from '../ui'
import { useView } from '../lib/views'
import {
  BUTTON,
  CELL_TIGHT,
  CHART_HEIGHT,
  FIELD,
  MONO_LABEL,
  QUIET,
  SELECT,
  TH_TIGHT,
} from '../lib/tokens'
import { fullCount } from '../../analytics/lib/format'
import { ZONE } from '@lib/time/zone.js'
import { StatusDonut } from './AudienceCharts'

/**
 * The mailing list: everyone on it, how each of them arrived, and where each
 * of them stands.
 *
 * The roll is the work and takes the width. The column beside it holds the
 * state of the list as one ring and five figures - how much of it can be
 * written to, and how much of it bounced or complained - so the health of
 * the list and the address being looked up are read in one glance rather
 * than one above the other. A list longer than the screen moves inside its
 * own card, a page at a time, under headings that stay put.
 *
 * The two forms are what act on the list, so each takes that column when its
 * view is open rather than a page of its own: a form the width of a dashboard
 * is mostly empty field, and a form beside the roll shows what it did the
 * moment it did it.
 *
 * Status is a badge rather than a word in a column, so the state of a row is
 * read from the shape of the table rather than from a column of prose.
 *
 * Nothing here is what enforces any of it. The endpoint verifies the session,
 * refuses any account that is not an admin, normalises every address, and
 * holds a removed address off the list for good; this is the surface those
 * rules are worked through.
 */

/**
 * How each status reads, in the order the ring and its figures count them.
 *
 * Each keeps one colour from read to read, so a reader who has learnt which
 * slice is which is not learning it again after every change. They are the
 * first steps of the ramp the shared charts walk, with the accent's own hover
 * step left out, since a slice in that colour cannot be told from the first
 * at legend size.
 */
const STATUS = {
  subscribed: {
    label: 'Subscribed',
    tone: 'good',
    caption: 'receiving what you send',
    color: 'var(--series-1)',
  },
  pending: {
    label: 'Pending',
    tone: 'accent',
    caption: 'waiting on a confirmation',
    color: 'var(--series-3)',
  },
  unsubscribed: {
    label: 'Unsubscribed',
    tone: 'plain',
    caption: 'asked to stop',
    color: 'var(--series-4)',
  },
  bounced: {
    label: 'Bounced',
    tone: 'warn',
    caption: 'the address did not accept',
    color: 'var(--series-5)',
  },
  complained: {
    label: 'Complained',
    tone: 'bad',
    caption: 'marked it as spam',
    color: 'var(--series-6)',
  },
}

const STATUS_ORDER = ['subscribed', 'pending', 'unsubscribed', 'bounced', 'complained']

// The endpoint holds this rule; the figure is here so the panel can say it
// before a file too big for one request is pasted into it.
const IMPORT_LIMIT = 1000

// The column headings a CSV can name, so an export with its columns the other
// way round imports the same as one with them in this order.
const EMAIL_HEADINGS = ['email', 'e-mail', 'email address', 'address']
const NAME_HEADINGS = ['name', 'full name', 'full_name', 'first name']

/**
 * The roll beside the column that reads it or acts on it. The roll has six
 * columns to fit and takes the width; the column is held to what a ring over
 * five figures, or a form of four fields, needs, and no wider, since every
 * rem it takes is one the roll gives up at the narrowest desk width, where
 * the roll and the table's own measure are within a rem of each other.
 */
const COLS = 'minmax(0,1fr) 18rem'

/** The cells of one row, so the placeholder rows fall on the same columns. */
const ROW_CELLS = [
  CELL_TIGHT,
  CELL_TIGHT,
  CELL_TIGHT,
  CELL_TIGHT,
  CELL_TIGHT,
  `${CELL_TIGHT} text-right`,
]

/** One row of a CSV, split on commas with quoted cells kept whole. */
function splitRow(line) {
  const cells = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      cells.push(cell)
      cell = ''
    } else {
      cell += char
    }
  }
  cells.push(cell)
  return cells.map(value => value.trim())
}

/**
 * A pasted or uploaded CSV as the rows the endpoint takes.
 *
 * A first line naming its columns decides which cell holds the address and
 * which holds the name; a first line carrying an address is a row like any
 * other. Each row keeps its line number so a rejected one can be pointed at.
 */
function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/)
  let emailAt = 0
  let nameAt = 1
  let from = 0

  const heading = lines.findIndex(line => line.trim())
  if (heading >= 0) {
    const cells = splitRow(lines[heading]).map(cell => cell.toLowerCase())
    if (!cells.some(cell => cell.includes('@'))) {
      const email = cells.findIndex(cell => EMAIL_HEADINGS.includes(cell))
      const name = cells.findIndex(cell => NAME_HEADINGS.includes(cell))
      emailAt = email >= 0 ? email : 0
      nameAt = name >= 0 && name !== emailAt ? name : emailAt === 0 ? 1 : 0
      from = heading + 1
    }
  }

  const rows = []
  for (let index = from; index < lines.length; index += 1) {
    if (!lines[index].trim()) continue
    const cells = splitRow(lines[index])
    rows.push({ line: index + 1, email: cells[emailAt] || '', name: cells[nameAt] || '' })
  }
  return rows
}

/** What an import did, in one line. */
function importSummary(result) {
  const parts = [`${result.added} added`]
  if (result.already) parts.push(`${result.already} already on the list`)
  if (result.suppressed) parts.push(`${result.suppressed} suppressed`)
  const refused = result.refused?.length || 0
  if (refused) {
    parts.push(refused === 1 ? '1 line was not an address' : `${refused} lines were not addresses`)
  }
  return `${parts.join(', ')}.`
}

/** The day an address arrived, in the shortest form that still names it. */
function joined(stamp) {
  if (!stamp) return '—'
  return new Date(stamp).toLocaleDateString('en-US', {
    timeZone: ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** A status as a badge, so a column of them reads as states rather than words. */
function StatusBadge({ status }) {
  const known = STATUS[status]
  return <Badge tone={known ? known.tone : 'plain'}>{known ? known.label : status}</Badge>
}

/** A status's name against the colour its slice is drawn in. */
function StatusLabel({ name }) {
  const known = STATUS[name]
  return (
    <span className="inline-flex items-center gap-2" title={known.caption}>
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded"
        style={{ background: known.color }}
      />
      {known.label}
    </span>
  )
}

/** The list, and the two ways onto it. */
const AUDIENCE_VIEWS = [
  { key: 'people', label: 'Subscribers' },
  { key: 'add', label: 'Add Someone' },
  { key: 'import', label: 'Import CSV' },
]

export default function AudiencePage() {
  const { session } = useSession()
  const token = session?.access_token ?? null

  const [status, setStatus] = useState('')
  const [segment, setSegment] = useState('')
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  // A read per keystroke would spend a request on every prefix of an address.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), 250)
    return () => clearTimeout(timer)
  }, [typed])

  // A new filter selects a different set of rows, so page four of the last one
  // is not a page of this one.
  useEffect(() => setPage(0), [status, segment, search])

  const filters = useMemo(
    () => ({ status, segment, search, page }),
    [status, segment, search, page]
  )
  const { data, retained, error, loading, acting, act } = useAudienceFeed({
    token,
    enabled: Boolean(token),
    filters,
  })

  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newSegment, setNewSegment] = useState('')
  const [consent, setConsent] = useState(false)

  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [importSegment, setImportSegment] = useState('')
  const [imported, setImported] = useState(null)
  const filePicker = useRef(null)

  const [arming, setArming] = useState(null)
  const [view, go] = useView(AUDIENCE_VIEWS)

  const people = data?.people || []
  const counts = data?.counts || {}
  const total = data?.total || 0
  const matching = data?.matching || 0
  const size = data?.size || people.length || 1
  // The segment list and the pager describe the question rather than answer
  // it, so they stand on the last read while the next one runs. Otherwise
  // picking a segment empties the list holding the segment that was picked,
  // and pressing Next unmounts the control that was pressed.
  const segments = retained?.segments || []
  const paged = retained?.matching || 0
  const pageSize = retained?.size || size
  const pages = Math.max(1, Math.ceil(paged / pageSize))
  const filtering = Boolean(status || segment || search)
  // Every status count and every segment is taken over the whole list unless
  // it is long enough to have been read to a ceiling. Saying so is what keeps
  // a breakdown over part of the list from reading as one over all of it.
  const sampled = Boolean(data && data.summarised < total)
  // What the counts were taken over, which is what each of them is a share
  // of: the whole list, or the most recent stretch of one past the ceiling.
  const counted = data?.summarised || 0
  const share = value => (counted ? `${Math.round((value / counted) * 100)}%` : '—')
  const standing = STATUS_ORDER.map(name => ({
    name: STATUS[name].label,
    count: counts[name] || 0,
    color: STATUS[name].color,
  }))

  const submitAdd = async event => {
    event.preventDefault()
    const answer = await act(
      { action: 'add', email: newEmail, name: newName, segment: newSegment, consent },
      'add'
    )
    if (!answer) return
    setNewEmail('')
    setNewName('')
    setConsent(false)
  }

  const readFile = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    setCsv(await file.text())
    setFileName(file.name)
    setImported(null)
  }

  const submitImport = async event => {
    event.preventDefault()
    const answer = await act(
      { action: 'import', rows: parseCsv(csv), segment: importSegment },
      'import'
    )
    if (!answer) return
    setCsv('')
    setFileName('')
    setImported(answer)
  }

  // A refusal with nothing behind it is the whole answer, so it is shown in
  // place of the page rather than above an empty one.
  if (error && !data) return <SectionNotice>{error}</SectionNotice>

  return (
    <ConsolePage
      areas={error ? ['error error', 'nav nav', 'roll side'] : ['nav nav', 'roll side']}
      cols={COLS}
      rows={error ? 'auto auto minmax(0,1fr)' : 'auto minmax(0,1fr)'}
    >
      {/* A failure takes a row of its own only while there is one to state,
          since an empty row still carries the gap on either side of it. */}
      {error ? (
        <Area area="error">
          <ConsoleError>{error}</ConsoleError>
        </Area>
      ) : null}

      <Area area="nav">
        <ViewNav
          views={[
            { key: 'people', label: 'Subscribers', count: total, loading },
            { key: 'add', label: 'Add Someone' },
            { key: 'import', label: 'Import CSV' },
          ]}
          current={view}
          onPick={go}
          label="Subscriber views"
        />
      </Area>

      <Panel
        title="Subscribers"
        loading={loading}
        aside={filtering ? `${fullCount(matching)} matching` : `${fullCount(total)} on the list`}
        area="roll"
      >
        <div className="border-hair-paper flex flex-wrap items-center gap-2 border-b px-5 py-3">
          <label className="min-w-[11rem] flex-1">
            <span className="sr-only">Search Addresses</span>
            <input
              type="search"
              value={typed}
              onChange={event => setTyped(event.target.value)}
              placeholder="Search by email"
              className={FIELD}
            />
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select
              value={status}
              onChange={event => setStatus(event.target.value)}
              className={SELECT}
            >
              <option value="">Every Status</option>
              {STATUS_ORDER.map(name => (
                <option key={name} value={name}>
                  {STATUS[name].label}
                </option>
              ))}
            </select>
          </label>
          {/* A list with no segments in it has nothing for this to narrow
              to, and a chooser with one choice is a control that does
              nothing. */}
          {segments.length ? (
            <label>
              <span className="sr-only">Segment</span>
              <select
                value={segment}
                onChange={event => setSegment(event.target.value)}
                className={SELECT}
              >
                <option value="">Every Segment</option>
                {segments.map(name => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <PanelBody className="overflow-x-auto">
          {/* The columns are measured rather than shared out, so an address
              takes the width an address needs and the state, the segment and
              the date follow it instead of being flung to the far edge of the
              card. What is left over falls to the column holding the control,
              which is the one thing that belongs at the edge. Together they
              come to what the roll has beside the column on a 1280 screen, so
              the table only moves sideways on one narrower than that. */}
          <table className="console-table min-w-[42rem] text-[13px]" aria-busy={loading}>
            <thead>
              <tr>
                <th scope="col" className={`${TH_TIGHT} w-[12rem]`}>
                  Person
                </th>
                <th scope="col" className={`${TH_TIGHT} w-[6.5rem]`}>
                  Status
                </th>
                <th scope="col" className={`${TH_TIGHT} w-[5.5rem]`}>
                  Segment
                </th>
                <th scope="col" className={`${TH_TIGHT} w-[5.5rem]`}>
                  Source
                </th>
                <th scope="col" className={`${TH_TIGHT} w-[6.5rem]`}>
                  Joined
                </th>
                <th scope="col" className={`${TH_TIGHT} text-right`}>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows cols={ROW_CELLS} rows={8} />
              ) : people.length ? (
                people.map(person => {
                  const key = `person:${person.id}`
                  return (
                    <tr key={person.id} className="border-hair-paper border-t align-top">
                      <td className={CELL_TIGHT}>
                        <span
                          className="block truncate font-medium text-ink-paper"
                          title={person.email}
                        >
                          {person.email}
                        </span>
                        {person.name && (
                          <span className={`${MONO_LABEL} text-paper-faint block truncate`}>
                            {person.name}
                          </span>
                        )}
                      </td>
                      <td className={CELL_TIGHT}>
                        <StatusBadge status={person.status} />
                      </td>
                      <td className={`${CELL_TIGHT} truncate text-paper-soft`}>
                        {person.segment || '—'}
                      </td>
                      <td className={`${CELL_TIGHT} ${MONO_LABEL} text-paper-faint truncate`}>
                        {person.source || '—'}
                      </td>
                      <td className={`${CELL_TIGHT} whitespace-nowrap text-paper-soft`}>
                        {joined(person.created_at)}
                      </td>
                      <td className={`${CELL_TIGHT} text-right`}>
                        {arming === person.id ? (
                          <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={acting === key}
                              onClick={() => {
                                setArming(null)
                                act({ action: 'remove', id: person.id }, key)
                              }}
                              className={`${QUIET} text-[color:var(--danger)] hover:text-[color:var(--danger)]`}
                            >
                              Remove
                            </button>
                            <button type="button" onClick={() => setArming(null)} className={QUIET}>
                              Keep
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={acting === key}
                            onClick={() => setArming(person.id)}
                            className="text-paper-faint inline-flex h-7 w-7 cursor-pointer items-center justify-center hover:text-[color:var(--danger)] disabled:opacity-40"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only">Remove {person.email}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : filtering ? (
                <EmptyRow cols={6}>
                  No addresses match this filter. Widen the search or pick another status.
                </EmptyRow>
              ) : (
                <EmptyRow cols={6}>
                  Nobody is on the list yet. Add someone by hand, or import a CSV of addresses.
                </EmptyRow>
              )}
            </tbody>
          </table>
        </PanelBody>

        {/* The note and the pager share the foot, so a list of several pages
            closes on one block rather than two. */}
        <PanelFoot>
          <p className="min-w-0 flex-1 basis-[20rem] leading-relaxed">
            Removing someone deletes their row and holds their address off the list, so a later
            import cannot put them back.
          </p>
          {pages > 1 && (
            <span className="inline-flex items-center gap-2">
              <span className={`${MONO_LABEL} text-paper-faint`}>
                Page {fullCount(page + 1)} of {fullCount(pages)}
              </span>
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
          )}
        </PanelFoot>
      </Panel>

      {view === 'people' ? (
        <Panel
          title="Where They Stand"
          loading={loading}
          aside={sampled ? `the ${fullCount(counted)} most recent` : 'every address on record'}
          area="side"
        >
          {/* The ring takes whatever the card has left over the five rows
              under it, and the rows are the legend: each status against its
              count and its share, on the same colour as its slice. */}
          <PanelFill minHeight={CHART_HEIGHT.traffic}>
            {loading ? (
              <SkeletonBox className="flex flex-col [&>span]:flex-1" />
            ) : counted ? (
              <StatusDonut rows={standing} total={counted} fill />
            ) : (
              <p className="flex items-center justify-center px-5 text-center text-[13px] text-paper-soft">
                Nobody is on the list yet.
              </p>
            )}
          </PanelFill>
          <dl className="border-hair-paper border-t">
            {STATUS_ORDER.map(name => (
              <Metric
                key={name}
                label={<StatusLabel name={name} />}
                value={fullCount(counts[name])}
                caption={share(counts[name] || 0)}
                loading={loading}
              />
            ))}
          </dl>
          {sampled && (
            <PanelFoot>
              <p className="leading-relaxed">
                The counts and the segments are taken over the {fullCount(counted)} most recent of{' '}
                {fullCount(total)}.
              </p>
            </PanelFoot>
          )}
        </Panel>
      ) : null}

      {view === 'add' ? (
        // The card ends where its fields end rather than stretching to the
        // foot of the column, so the button sits under the last field instead
        // of a hand's width below it.
        <Panel title="Add Someone" area="side" className="lg:self-start">
          <form onSubmit={submitAdd}>
            <div className="grid gap-3 px-5 py-4">
              <label className="grid gap-1.5">
                <span className={`${MONO_LABEL} text-paper-faint`}>Email Address</span>
                <input
                  required
                  type="email"
                  value={newEmail}
                  onChange={event => setNewEmail(event.target.value)}
                  placeholder="name@example.com"
                  className={FIELD}
                />
              </label>

              <label className="grid gap-1.5">
                <span className={`${MONO_LABEL} text-paper-faint`}>Name</span>
                <input
                  type="text"
                  value={newName}
                  onChange={event => setNewName(event.target.value)}
                  placeholder="optional"
                  className={FIELD}
                />
              </label>

              <label className="grid gap-1.5">
                <span className={`${MONO_LABEL} text-paper-faint`}>Segment</span>
                <input
                  type="text"
                  list="audience-segments"
                  value={newSegment}
                  onChange={event => setNewSegment(event.target.value)}
                  placeholder="optional"
                  className={FIELD}
                />
              </label>

              <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-paper-soft">
                <input
                  required
                  type="checkbox"
                  checked={consent}
                  onChange={event => setConsent(event.target.checked)}
                  className="mt-1 h-3.5 w-3.5 flex-shrink-0 accent-[color:var(--accent-fill)]"
                />
                <span>This person asked to hear from us and their consent is on record.</span>
              </label>
            </div>

            <PanelFoot>
              <button type="submit" disabled={acting === 'add'} className={BUTTON}>
                <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                {acting === 'add' ? 'Adding' : 'Add Subscriber'}
              </button>
            </PanelFoot>
          </form>
        </Panel>
      ) : null}

      {view === 'import' ? (
        <Panel
          title="Import CSV"
          aside={`up to ${fullCount(IMPORT_LIMIT)} rows at a time`}
          area="side"
        >
          {/* The box the rows are pasted into takes whatever the card has
              left, so a file of a few hundred lines is read in the card rather
              than through a slot four lines tall. */}
          <form onSubmit={submitImport} className="flex min-h-0 flex-1 flex-col">
            <PanelBody className="flex flex-col gap-3 px-5 py-4">
              <label className="flex min-h-0 flex-1 flex-col gap-1.5">
                <span className={`${MONO_LABEL} text-paper-faint`}>Rows</span>
                <textarea
                  value={csv}
                  onChange={event => setCsv(event.target.value)}
                  placeholder="email,name"
                  className={`${FIELD} min-h-[7rem] flex-1 resize-none font-mono text-[12px]`}
                />
              </label>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  ref={filePicker}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={readFile}
                  className="sr-only"
                />
                <button type="button" onClick={() => filePicker.current?.click()} className={QUIET}>
                  <Upload className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  Choose File
                </button>
                <span className="min-w-0 flex-1 truncate text-[12px] text-paper-soft">
                  {fileName || 'a file fills the box above'}
                </span>
              </div>

              <label className="grid gap-1.5">
                <span className={`${MONO_LABEL} text-paper-faint`}>Segment</span>
                <input
                  type="text"
                  list="audience-segments"
                  value={importSegment}
                  onChange={event => setImportSegment(event.target.value)}
                  placeholder="optional"
                  className={FIELD}
                />
              </label>

              {imported && (
                <p className="text-[13px] leading-relaxed text-paper-soft" role="status">
                  {importSummary(imported)}
                </p>
              )}
            </PanelBody>

            <PanelFoot>
              <button type="submit" disabled={acting === 'import'} className={BUTTON}>
                <Upload className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                {acting === 'import' ? 'Importing' : 'Import CSV'}
              </button>
            </PanelFoot>
          </form>
        </Panel>
      ) : null}

      {/* One list of segments for both fields and the filter, so a segment
          already in use is offered rather than typed again. */}
      <datalist id="audience-segments">
        {segments.map(name => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </ConsolePage>
  )
}
