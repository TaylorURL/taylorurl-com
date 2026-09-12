import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { m } from 'framer-motion'
import { X } from 'lucide-react'
import { fadeInUp } from '@constants/animations'
import { faultMessage } from '@utils/faults'
import { MONO_LABEL, ROW_HEIGHT } from './lib/tokens'

/**
 * The console's shared furniture: the card, the placeholder rows,
 * the empty row, the share bar, the ranked list, the side panel a section's
 * controls fold into, and the notice a section shows when it has nothing to
 * show.
 *
 * Every section is built from these rather than each defining its own, which is
 * what keeps every section looking like one dashboard. The card is the unit:
 * one raised surface, a ruled head carrying a name and one line of context, and
 * whatever the section puts inside it. Nothing in a section draws its own
 * border.
 *
 * The strip of figures every section opens with is not in here. It is one
 * component with a rule of its own about which figure is promoted, which is
 * more than furniture, and it lives in `Figures.jsx`.
 */

export function Panel({
  title,
  aside,
  tools,
  note,
  children,
  className = '',
  busy,
  loading,
  area,
  style,
}) {
  return (
    <m.section
      {...fadeInUp}
      aria-busy={busy || loading}
      className={`console-card ${className}`}
      style={area ? { '--area': area, ...style } : style}
    >
      {/* The title holds one line and the aside drops below it when there is no
          room, rather than the two sharing a row until the heading breaks
          mid-word - which is what a long aside does to a short title at 375px. */}
      <header className="console-card-head">
        <h2>{title}</h2>
        {/* What the card says about itself and what works it, together at the
            far end of the head - so the head is a name at one edge and
            everything else at the other, however many of them there are.

            An aside is a count of what is in the card, and a count of nothing
            read while the read is still out says the card is empty. It waits
            here rather than in each section, so no section can forget it, and
            it holds a placeholder of its own so the head does not change
            height when the figure lands. A control is not a reading and waits
            for nothing: the placeholder stands in for the figure alone, and
            anything in `tools` is there from the first frame. */}
        {(loading || aside || tools) && (
          <div className="flex min-w-0 items-center gap-3">
            {loading ? (
              <p>
                <SkeletonBar className="w-16" />
              </p>
            ) : (
              aside && <p>{aside}</p>
            )}
            {tools}
          </div>
        )}
        {/* How the card is worked, for whoever is working it. It wraps onto its
            own line inside the head rather than standing between the head and
            the body, so a card that says how to use itself is still one ruled
            block rather than two. It never waits on the read: what a card is
            for does not depend on what the read comes back with, and a line
            that appears a second late is a line nobody was looking at when it
            arrived. */}
        {note && <p className="console-card-note">{note}</p>}
      </header>
      {children}
    </m.section>
  )
}

/**
 * One pulsing bar, the width of whatever it stands in for.
 *
 * Every placeholder in the console is built from this rather than each section
 * spelling out its own pulse, so they all wait at the same rate and in the same
 * colour, and a reader learns the shape once.
 */
export function SkeletonBar({ className = '', height = 'h-3' }) {
  return (
    <span
      aria-hidden="true"
      className={`block ${height} animate-pulse rounded-[var(--r-tiny)] bg-paper-soft/15 ${className}`}
    />
  )
}

/**
 * The box a chart, a donut or a map fills, held at the chart's own height so
 * nothing under it moves when the series arrives.
 */
export function SkeletonBox({ height, className = '' }) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      <span
        aria-hidden="true"
        className="block w-full animate-pulse rounded-[var(--r-tiny)] bg-paper-soft/15"
        style={{ height }}
      />
    </div>
  )
}

/**
 * Placeholder rows in the shape of a ranked list: a name against a figure, on
 * the list's own rhythm, so the card is the same height before and after.
 */
export function SkeletonList({ rows = 5 }) {
  return (
    <ul className="flex flex-col gap-px p-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, row) => (
        <li key={row} className="flex items-center justify-between gap-3 px-3 py-1.5">
          <SkeletonBar className={row % 2 ? 'w-40' : 'w-28'} />
          <SkeletonBar className="w-10 flex-shrink-0" />
        </li>
      ))}
    </ul>
  )
}

/**
 * One headline figure.
 *
 * The strip of these under the topbar is the first thing read on every section,
 * so the number carries the weight and everything around it stays quiet: a
 * label above at label scale, the figure at display scale in tabular figures so
 * a column of them lines up, and one line of context under it saying what the
 * number counts. `pulse` marks the one figure that is a live count rather than
 * a total for the window.
 */
/**
 * A section's controls, against the right edge, over the work they act on.
 *
 * A control that is set once and read from after that does not earn a column
 * of the page for the whole visit. The switches, the lists and the job board
 * behind a button leave the section showing what it found rather than what it
 * was configured with, and the panel opens beside the table instead of above
 * it, so nothing the reader was looking at moves to make room.
 *
 * Straight onto the body, because the console frame isolates itself and a
 * z-index inside an isolated element cannot rise past the chrome outside it.
 * The console's token scope goes with it, since a portal leaves the shell that
 * carries it behind.
 *
 * Focus goes to the close button on open and back to whatever opened the panel
 * on close, so a panel opened from the keyboard is a panel the keyboard can
 * leave.
 */
export function SidePanel({ open, title, aside, note, onClose, children, loading }) {
  const closer = useRef(null)

  // Opening and closing is all this effect answers to. Hanging it on the close
  // handler as well would hand focus back to the button that opened the panel
  // every time the section behind it re-read, which is every few seconds while
  // a job runs and every keystroke in a field inside it.
  useEffect(() => {
    if (!open) return undefined
    const opener = document.activeElement
    closer.current?.focus()
    return () => {
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const key = event => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      data-theme="console"
      className="console-side"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="console-side-card">
        <header>
          <div className="grid min-w-0 gap-0.5">
            <h2>{title}</h2>
            {/* A panel is opened at the moment the question changes - a filter
                picked, a setting read - so its own head is the most likely
                thing in the console to be counting an answer that has not
                arrived. */}
            {loading ? (
              <p>
                <SkeletonBar className="w-20" />
              </p>
            ) : (
              aside && <p>{aside}</p>
            )}
            {/* What the panel is for, in a line, the same way a card carries
                one. A panel is opened from a control somewhere else on the
                page, so it is the one surface a reader arrives at without
                having read anything about it first. */}
            {note && <p className="console-card-note">{note}</p>}
          </div>
          <button type="button" ref={closer} aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>
        <div className="console-side-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}

/**
 * Placeholder rows in the shape of the ones replacing them: same cell count,
 * same row height, same column alignment, so nothing shifts when the figures
 * arrive. Hidden from screen readers, which have nothing to read here.
 *
 * A table whose columns give way as the page narrows hands its cells' classes
 * in a list rather than a count, because a placeholder holding cells the head
 * above it has dropped is a table drawn one width while it loads and another
 * once the rows land - which is the shift this exists to prevent.
 */
/**
 * One figure on its own, for a page whose strip is a plain row of them.
 *
 * The figure strip in `Figures.jsx` promotes one figure and holds the rest
 * behind it, which is what a section with a lede figure wants. A page whose
 * figures are peers - no one of them the reason the page is open - reads
 * better as a flat row, and this is that row's card.
 */
export function StatCard({ label, value, caption, tone = 'plain', pulse, loading }) {
  return (
    <div className="console-stat" data-tone={tone}>
      <p className="console-stat-label">
        {pulse && <span className="console-stat-dot" aria-hidden="true" />}
        {label}
      </p>
      {/* The value holds a minimum height of its own line box, or the
          placeholder comes out a few pixels shorter than the number it stands
          in for and six cards of that pull the whole page up as they resolve.
          Keying on the state makes the figure a new element when it replaces
          the placeholder, which is what lets it animate in rather than
          appear. */}
      <p className="console-stat-value" key={loading ? 'waiting' : 'landed'}>
        {loading ? <span aria-hidden="true" className="console-stat-skeleton" /> : value}
      </p>
      <p className="console-stat-caption">{caption}</p>
    </div>
  )
}

export function SkeletonRows({ cols, rows, height = ROW_HEIGHT.plain, lastHeight = height }) {
  const cells = Array.isArray(cols) ? cols : Array.from({ length: cols }, () => 'px-5')
  return Array.from({ length: rows }).map((_, row) => (
    <tr
      key={row}
      className="border-hair-paper border-t"
      style={{ height: row === rows - 1 ? lastHeight : height }}
      aria-hidden="true"
    >
      {cells.map((cell, at) => (
        <td key={at} className={cell}>
          <span
            aria-hidden="true"
            className="block h-3 w-full max-w-[9rem] animate-pulse rounded-[var(--r-tiny)] bg-paper-soft/15"
          />
        </td>
      ))}
    </tr>
  ))
}

/**
 * The one row a table draws when it has none of its own.
 *
 * It takes the same `cols` the placeholder above it takes, and for the same
 * reason: a table whose columns give way as the page narrows describes them as
 * a list of classes rather than as a count, and both shapes have to reach the
 * same table. A count spans that many columns; a list spans as many as it
 * holds. Spanning more columns than the head has drawn is harmless either way,
 * since the row is one sentence across whatever is there.
 */
export function EmptyRow({ cols, children }) {
  return (
    <tr className="border-hair-paper border-t">
      <td
        colSpan={Array.isArray(cols) ? cols.length : cols}
        className="px-5 py-10 text-center text-[13px] text-paper-soft"
      >
        {children}
      </td>
    </tr>
  )
}

/** A share bar behind a table figure, so a column of numbers reads as a ranking. */
export function ShareBar({ value, peak }) {
  return (
    <span
      aria-hidden="true"
      className="mt-2 block h-1 rounded-[var(--r-tiny)] bg-[color:var(--paper-hairline)]"
    >
      <span
        className="block h-full rounded-[var(--r-tiny)] bg-accent transition-[width] duration-150 ease-out-soft"
        style={{ width: `${peak ? Math.max(2, (value / peak) * 100) : 0}%` }}
      />
    </span>
  )
}

/**
 * A ranked list, where the share is the row's own ground rather than a rule
 * under it.
 *
 * `markOf` is optional and returns whatever stands before the name - a site's
 * own icon, most often. A ranking of sites reads faster with them, and a
 * ranking of paths or browsers has nothing to put there, so the caller decides
 * rather than the list. `dense` closes the rows up for a card that has to show
 * a longer ranking in the height it was given.
 *
 * A hairline bar under a name puts three things in a row's height - the name,
 * the figure, and a mark for the share - and on a wide card the name and the
 * figure end up a foot apart with a thread stretched between them. Filling the
 * row instead gives the width back to the ranking: the row is as long as its
 * share, the name sits on it, and the figure closes it, so the shape is read
 * before any of the words are.
 */
export function RankedList({
  rows,
  nameOf,
  valueOf,
  formatValue,
  empty,
  markOf,
  loading,
  expected = 5,
  dense,
}) {
  // A list that has not been answered for yet is not a list with nothing in
  // it, and saying "no referrers recorded" while the read is still out states
  // a finding the console does not have. `expected` is how long the reader
  // last saw it, so the card does not resize when the rows land.
  if (loading) return <SkeletonList rows={expected} />
  if (!rows.length) {
    return <p className="px-5 py-10 text-center text-[13px] text-paper-soft">{empty}</p>
  }
  const peak = Math.max(1, ...rows.map(valueOf))
  return (
    <ul className="flex flex-col gap-px p-2">
      {rows.map(row => (
        <li
          key={nameOf(row)}
          className={`relative flex items-center justify-between gap-3 overflow-hidden rounded-[var(--console-radius-sm)] px-3 text-[13px] transition-colors duration-150 ease-out-soft hover:bg-[color:var(--console-row-hover)] ${dense ? 'py-1' : 'py-1.5'}`}
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-[var(--console-radius-sm)] bg-[color:var(--wash-accent)] transition-[width] duration-300 ease-out-soft"
            style={{ width: `${Math.max(1.5, (valueOf(row) / peak) * 100)}%` }}
          />
          {markOf && <span className="relative flex-shrink-0">{markOf(row)}</span>}
          <span className="relative truncate">{nameOf(row)}</span>
          <span className="relative flex-shrink-0 font-mono tabular-nums text-paper-soft">
            {formatValue(valueOf(row))}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Panels side by side rather than stacked.
 *
 * A ranked list of ten names is three hundred pixels of content, and a section
 * that gives each one the full width of the work region spends a screen height
 * on what would fit in a third of it - so the reader scrolls past three cards to
 * compare two figures that could have been level with each other. Two or three
 * across is the dashboard's shape; one column is what a phone gets.
 */
export function PanelGrid({ children, columns = 2, area }) {
  const track = columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
  return (
    <div
      className={`grid min-h-0 gap-4 lg:h-full lg:auto-rows-[minmax(0,1fr)] [&>*]:min-h-0 [&>*]:min-w-0 ${track}`}
      style={area ? { '--area': area } : undefined}
    >
      {children}
    </div>
  )
}

/**
 * One state, said in a word and a colour.
 *
 * A dashboard states the same handful of conditions on every section - passing,
 * waiting, refused - and a reader who has learned the shape once reads the next
 * one without reading the word.
 */
export function Badge({ tone = 'plain', title, children }) {
  return (
    <span className="console-badge" data-tone={tone} title={title}>
      {children}
    </span>
  )
}

/**
 * A label against its value, for the facts a section states rather than ranks.
 *
 * A figure with a name beside it is a table of two columns, and building one out
 * of a real table puts a head over it that repeats what every label already
 * says.
 */
export function Metric({ label, value, caption, loading }) {
  return (
    <div className="console-metric">
      <dt>{label}</dt>
      <dd>
        {loading ? <SkeletonBar className="my-1 w-14" /> : value}
        {caption && <span>{loading ? <SkeletonBar className="mt-1 w-20" /> : caption}</span>}
      </dd>
    </div>
  )
}

/**
 * The part of a card that moves when there is more than fits.
 *
 * At the desk width a card is exactly the cell it was given and no taller, so
 * a list longer than the cell has to move inside it. The head and the foot
 * stay put and this scrolls between them, which keeps a long table against
 * its own column headings. On a phone the card is as tall as its contents and
 * this is simply the contents.
 */
export function PanelBody({ children, className = '' }) {
  return <div className={`console-card-body ${className}`}>{children}</div>
}

/**
 * The part of a card a chart fills.
 *
 * A chart measures the box it stands in, so the box takes whatever the card
 * has left after its head and foot and the chart draws into that. Every chart
 * in the console takes `fill` to draw this way; the fixed heights are for a
 * phone, where the card has no height of its own to give.
 *
 * `minHeight` is the floor the chart keeps on a phone, where the card is as
 * tall as its contents and the box would otherwise collapse to nothing. At
 * the desk width the box is whatever the card has left, and a floor there
 * would push the card's foot out of a cell that is a few pixels short rather
 * than draw the chart a few pixels shorter.
 */
export function PanelFill({ children, className = '', minHeight = 120 }) {
  return (
    <div className={`console-card-fill ${className}`} style={{ '--fill-floor': `${minHeight}px` }}>
      {children}
    </div>
  )
}

/** The block a card closes on: a note, a total, or the control that acts on it. */
export function PanelFoot({ children, className = '' }) {
  return <div className={`console-card-foot ${className}`}>{children}</div>
}

/** What a notice falls back to when the failure behind it was not written for a reader. */
const NOT_READ = 'That did not load. Try again in a moment.'

/**
 * A notice as a reader should get it.
 *
 * The two notices below draw whatever the section hands them, and what a
 * section hands them is whatever its feed put in `error` - a Postgres refusal,
 * a status line, a body some upstream service chose. These are the last thing
 * between that and the screen and every console page renders through them, so
 * the reading is done once here rather than in each of a dozen sections. A
 * sentence a section wrote itself carries none of the marks of machine text
 * and comes back out of the door unchanged, which is the point: only the
 * unread text is replaced.
 *
 * Only a string goes through. A section that builds its notice out of a figure
 * and some prose hands over an array of nodes, and that is a sentence the page
 * composed on purpose rather than a value it caught.
 */
function readable(children) {
  return typeof children === 'string' ? faultMessage(children, NOT_READ) : children
}

/**
 * What a section says when a read failed with nothing behind it, when it
 * succeeded with nothing in it, or when there is no site in scope to ask about.
 * Three different sentences, because they are three different situations.
 */
export function SectionNotice({ children, area }) {
  return (
    <Panel title="Nothing to Show" area={area}>
      <p className="px-5 py-10 text-center text-[13px] text-paper-soft">{readable(children)}</p>
    </Panel>
  )
}

/**
 * The rows, columns and areas a board is laid out on, as the variables the
 * stylesheet reads at the desk width and ignores below it.
 *
 * `areas` is a list of rows, each a string of area names, the way
 * `grid-template-areas` reads them. A card names its area with the `area`
 * prop, and anything that is not a card stands in an `Area`.
 */
function boardStyle({ areas, cols, rows, gap }) {
  const style = {}
  if (areas) style['--board-areas'] = areas.map(row => `"${row}"`).join(' ')
  if (cols) style['--board-cols'] = cols
  if (rows) style['--board-rows'] = rows
  // A page whose rows have to close up against each other says so and carries
  // the air itself. It is written straight onto the element rather than into a
  // variable, because a variable would inherit into any board laid out inside
  // the page and quietly close that up too.
  if (gap !== undefined) style.gap = gap
  return style
}

/**
 * The page a console section fills.
 *
 * At the desk width the page is the whole of the room under the figures and
 * never scrolls: a section names its rows, its columns and its areas here and
 * every card is exactly the cell it was given. A section is therefore laid
 * out to fit the screen rather than stacked down it, and what does not fit
 * moves inside its own card. On a phone the same page is one column of cards
 * on the region's own rhythm, and the variables are never read.
 *
 * A grid item sizes to its content before it sizes to its track, so a wide
 * chart or a table inside one pushes the column past the viewport instead of
 * scrolling inside its own card. Letting every card shrink is what keeps the
 * page itself from scrolling sideways.
 */
export function ConsolePage({ children, areas, cols, rows, gap, className = '' }) {
  return (
    <div className={`console-page ${className}`} style={boardStyle({ areas, cols, rows, gap })}>
      {children}
    </div>
  )
}

/**
 * A board inside a page, on the same terms: a grid of cells that fills the
 * room it was given at the desk width and stacks below it. A page is one of
 * these; this is for the part of a page that has its own arrangement, such as
 * a view that lays out differently from the view beside it.
 */
export function Board({ children, areas, cols, rows, area, className = '' }) {
  const style = boardStyle({ areas, cols, rows })
  if (area) style['--area'] = area
  return (
    <div className={`console-board ${className}`} style={style}>
      {children}
    </div>
  )
}

/**
 * Anything that is not a card, standing in a named cell of a board.
 *
 * A card names its own area. A row of tabs, a list beside a reading, a chart
 * outside a card - anything else - stands in one of these, which is the cell
 * and nothing more. It is a column, so whatever it holds can fill it.
 */
export function Area({ children, area, className = '' }) {
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-col gap-4 ${className}`}
      style={area ? { '--area': area } : undefined}
    >
      {children}
    </div>
  )
}

/**
 * What a section says when the read behind it failed.
 *
 * The wording is the section's, because only the section knows what it was
 * asking for. Everything around the wording is here, because a failure that
 * looked different in each section would read as a different kind of failure.
 */
export function ConsoleError({ children, area }) {
  if (!children) return null
  return (
    <p
      className={`${MONO_LABEL} console-card px-5 py-3 text-[color:var(--warn)]`}
      role="status"
      style={area ? { '--area': area } : undefined}
    >
      {readable(children)}
    </p>
  )
}

/**
 * A list of things beside the one of them being looked at.
 *
 * The rail puts a narrow column of controls next to the work. This is the
 * other arrangement: the list is the narrow column and the work is whatever
 * has been picked out of it, which is the shape anything read one at a time
 * takes. A message, a document, a record - the list is the way to it, the
 * reading is the thing itself, and the reading takes the room.
 *
 * The list holds its own scroll once there is width for two columns, so moving
 * down a long list does not carry the thing being read off the top of the
 * screen. Below that width there is no second column to keep still, and the
 * two stack in the order they read in. The two columns begin at the desk
 * width, narrow at first and wider as the window allows, because that is
 * where the region stops scrolling and a reading stacked under its list
 * would be a reading nothing can reach.
 */
export function ConsoleSplit({ list, children, area }) {
  return (
    <div
      className="grid min-h-0 items-start gap-4 lg:h-full lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-stretch xl:grid-cols-[24rem_minmax(0,1fr)] 2xl:grid-cols-[28rem_minmax(0,1fr)]"
      style={area ? { '--area': area } : undefined}
    >
      <div className="grid min-h-0 min-w-0 gap-4 lg:h-full lg:auto-rows-[minmax(0,1fr)] [&>*]:min-h-0">
        {list}
      </div>
      <div className="grid min-h-0 min-w-0 gap-4 lg:h-full lg:auto-rows-[minmax(0,1fr)] [&>*]:min-h-0">
        {children}
      </div>
    </div>
  )
}

/**
 * The views a section splits into, as a row of tabs under its figures.
 *
 * A section with more than one thing to show - a queue, a list, a set of
 * letters, a job board - is read one thing at a time, and a page that stacks
 * all of them is a page scrolled through to find the one wanted. The row
 * names each and marks the open one, and the open one is held in the address
 * by `useView`, so the back button and a link both land on a view rather than
 * on the front of a section.
 *
 * Every tab is on screen at every width. The row wraps where it runs out of
 * room rather than sliding the last of them off the edge, because a tab that
 * has to be scrolled to is a view a reader does not know the section has.
 *
 * A count beside a name is the one figure worth carrying onto the tab: what
 * is waiting in that view. It waits for the read like every other figure, so
 * a tab is never counted at nought before the answer lands.
 */
export function ViewNav({ views, current, onPick, label, loading }) {
  return (
    <nav className="console-views" aria-label={label}>
      {views.map(view => (
        <button
          key={view.key}
          type="button"
          onClick={() => onPick(view.key)}
          aria-current={current === view.key ? 'page' : undefined}
        >
          <span className="console-views-name">{view.label}</span>
          {view.count === undefined ? null : view.loading || loading ? (
            <SkeletonBar className="w-5" height="h-2.5" />
          ) : (
            <span className="console-views-count">{view.count}</span>
          )}
        </button>
      ))}
    </nav>
  )
}
