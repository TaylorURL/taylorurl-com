import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { fadeInUp } from '@constants/animations'

/**
 * THE FIGURE STRIP — one figure given the room, the rest held behind it.
 *
 * A strip of eight or ten figures at one weight is eight or ten things to
 * decide between, and the reader decides by reading all of them. So one is
 * promoted to reading size and given the space to answer the questions it
 * raises - a chart where the figure has a history, the parts it is made of
 * where it is a share of something, the bar it is meant to clear where it has
 * one - and the rest stand under it as tiles.
 *
 * Which figure holds the lede is a rule rather than a placement:
 *
 *   1. anything marked urgent takes it, so nobody has to notice the red tile
 *      in position nine - red is never in position nine
 *   2. otherwise whichever one the reader last promoted
 *   3. otherwise the one the section pinned
 *
 * A section hands this a list of records and nothing else. The count is not
 * fixed anywhere: two figures and twelve are the same call, and the column
 * track under the tiles is chosen by dividing rather than filling, so the last
 * row is never a set of stretched leftovers.
 */

// Writing the flight into the DOM before the browser paints is what keeps the
// promoted card from appearing at its destination and then jumping back to
// start. On the server there is no layout to read and no paint to beat.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

// The house ceiling on any one piece of motion. The flight is the longest
// thing in here and it still lands inside it.
const FLIGHT_MS = 420

const CHART_W = 320
const CHART_H = 116

/**
 * The column count that splits N tiles evenly.
 *
 * Ten tiles across a six-wide track is six and then four stretched to the same
 * width, which is the row that reads as a mistake. Ten across a five-wide
 * track is five and five. Rows are picked first and the count divided into
 * them, never the other way round. The floor keeps two figures from becoming
 * two slabs the width of the console.
 */
function columnsFor(count, max = 6, min = 3) {
  if (count <= 0) return min
  const rows = Math.ceil(count / max)
  return Math.max(min, Math.min(max, Math.ceil(count / rows)))
}

/**
 * One track for every set on the strip.
 *
 * Sets sized separately is the fault this replaces: six traffic figures at one
 * width sitting above four health figures at another reads as two components
 * that happen to be stacked. The widest set picks the track and the shorter
 * ones leave their tail empty.
 */
function columnsForSets(sizes, max, min) {
  return sizes.reduce((widest, size) => Math.max(widest, columnsFor(size, max, min)), min)
}

/** The figures gathered into their sets, in the order the section listed them. */
function bySet(figures) {
  const order = []
  const held = new Map()
  for (const figure of figures) {
    const key = figure.set || ''
    if (!held.has(key)) {
      held.set(key, { key, name: figure.set || null, aside: figure.setAside || null, members: [] })
      order.push(key)
    }
    held.get(key).members.push(figure)
  }
  return order.map(key => held.get(key))
}

/* ------------------------------------------------------------------------ *
 * The room under the promoted figure
 * ------------------------------------------------------------------------ */

function linePath(points, width, height, pad) {
  const values = points.map(point => point.value)
  const low = Math.min(...values)
  const high = Math.max(...values)
  const span = high - low || 1
  const step = points.length > 1 ? width / (points.length - 1) : 0
  const placed = points.map((point, at) => [
    at * step,
    pad + (height - pad * 2) * (1 - (point.value - low) / span),
  ])
  const line = placed
    .map(([x, y], at) => `${at ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ')
  return { line, area: `${line} L${width.toFixed(2)} ${height} L0 ${height} Z`, placed }
}

/**
 * The history of a figure, drawn.
 *
 * It draws itself on when the promoted figure changes and never on a read. The
 * console re-reads every section on a timer, and a chart that grows from
 * nothing on each read is a chart that is never still long enough to be read -
 * which is the decision `ANIMATE` already holds for every recharts chart in
 * here. Promotion is a thing the reader did, so it is allowed a beat.
 */
function Chart({ figure, drawKey, reduced }) {
  const points = figure.room.points
  const [at, setAt] = useState(null)
  const fillId = useRef(`figure-fill-${Math.random().toString(36).slice(2, 9)}`).current
  const geometry = useMemo(() => linePath(points, CHART_W, CHART_H, 6), [points])

  useEffect(() => setAt(null), [drawKey])

  const held = at === null ? null : points[at]
  const marker = at === null ? null : geometry.placed[at]

  return (
    <figure className="figures-chart" data-motion={reduced ? 'off' : 'on'} key={drawKey}>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        onMouseLeave={() => setAt(null)}
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="figures-chart-area" d={geometry.area} fill={`url(#${fillId})`} />
        <line
          className="figures-chart-base"
          x1="0"
          y1={CHART_H}
          x2={CHART_W}
          y2={CHART_H}
          vectorEffect="non-scaling-stroke"
        />
        <path className="figures-chart-line" d={geometry.line} vectorEffect="non-scaling-stroke" />
        {marker && (
          <>
            <line
              className="figures-chart-guide"
              x1={marker[0]}
              y1="0"
              x2={marker[0]}
              y2={CHART_H}
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              className="figures-chart-knot"
              cx={marker[0]}
              cy={marker[1]}
              rx="4"
              ry="3.2"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
        {/* The buckets are read by pointing at them, so each one owns the
            column of the chart nearest it rather than the line itself, which
            is a few pixels wide and impossible to hit. */}
        {geometry.placed.map(([x], index) => {
          const half = points.length > 1 ? CHART_W / (points.length - 1) / 2 : CHART_W / 2
          return (
            <rect
              key={points[index].at}
              x={Math.max(0, x - half)}
              y="0"
              width={half * 2}
              height={CHART_H}
              fill="transparent"
              onMouseEnter={() => setAt(index)}
            />
          )
        })}
      </svg>
      <figcaption className="figures-chart-ticks">
        {points.map((point, index) => (
          <span key={point.at} data-on={index === (at ?? points.length - 1) ? 'yes' : 'no'}>
            {point.at}
          </span>
        ))}
      </figcaption>
      <p className="figures-chart-readout" data-shown={held ? 'yes' : 'no'} aria-hidden="true">
        <span>{held?.at}</span>
        <b>{held?.text}</b>
      </p>
    </figure>
  )
}

/** What a figure is made of, where it is one share of something. */
function Parts({ figure, promoted }) {
  const whole = figure.room.parts.reduce((sum, part) => sum + Math.max(0, part.value), 0)
  return (
    <div className="figures-parts">
      <div className="figures-parts-bar" aria-hidden="true">
        {figure.room.parts.map(part => (
          <span
            key={part.label}
            data-lit={part.key && part.key === promoted ? 'yes' : 'no'}
            data-tone={part.tone || 'plain'}
            style={{ '--share': `${whole ? (Math.max(0, part.value) / whole) * 100 : 0}%` }}
          />
        ))}
      </div>
      <ul className="figures-parts-key">
        {figure.room.parts.map(part => (
          <li key={part.label} data-tone={part.tone || 'plain'}>
            <b>{part.text}</b>
            {part.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Where a figure stands against the thing it is measured out of. */
function Progress({ figure }) {
  const { at, of, target, note } = figure.room
  const ceiling = Math.max(of || 0, at || 0, target || 0) || 1
  // A bar to clear that sits at the end of the track is the end of the track,
  // and drawing it there is a mark on the edge of the card saying nothing. It
  // is only worth drawing where the figure can run past it.
  const marked = target && target < ceiling
  return (
    <div className="figures-progress">
      <div className="figures-progress-bar" aria-hidden="true">
        <span className="figures-progress-fill" style={{ '--to': `${(at / ceiling) * 100}%` }} />
        {marked ? (
          <span
            className="figures-progress-mark"
            style={{ '--at': `${(target / ceiling) * 100}%` }}
          />
        ) : null}
      </div>
      <p className="figures-progress-note">{note}</p>
    </div>
  )
}

function Room({ figure, promoted, drawKey, reduced }) {
  if (!figure.room) return null
  if (figure.room.kind === 'series' && figure.room.points?.length > 1) {
    return <Chart figure={figure} drawKey={drawKey} reduced={reduced} />
  }
  if (figure.room.kind === 'parts' && figure.room.parts?.length) {
    return <Parts figure={figure} promoted={promoted} />
  }
  if (figure.room.kind === 'progress') return <Progress figure={figure} />
  return null
}

/* ------------------------------------------------------------------------ *
 * The two shapes a figure is drawn in
 * ------------------------------------------------------------------------ */

function Label({ figure, live }) {
  return (
    <>
      {figure.pulse && live && <span className="figures-dot" aria-hidden="true" />}
      {figure.gloss ? (
        <span className="figures-gloss" tabIndex={0} data-gloss={figure.gloss}>
          {figure.label}
        </span>
      ) : (
        figure.label
      )}
    </>
  )
}

function Lede({ figure, promoted, hold, reduced }) {
  // A bar of parts names every one of them under itself, and a section listing
  // those same parts as facts prints each of them twice a few pixels apart.
  // The key is the fact list when there is one.
  const facts = figure.room?.kind === 'parts' ? [] : figure.facts || []
  return (
    <article
      className="figures-lede"
      ref={hold}
      data-tone={figure.tone || 'plain'}
      data-room={figure.room ? figure.room.kind : 'none'}
    >
      <div className="figures-lede-read">
        <p className="figures-lede-label">
          <Label figure={figure} live={!figure.loading} />
          {figure.window && <span className="figures-window">{figure.window}</span>}
        </p>
        {/* The figure holds the height of its own line box whether it has
            landed or not, or six tiles resolving at once pull the page up
            under the reader. */}
        <p className="figures-lede-value" key={figure.loading ? 'waiting' : 'landed'}>
          {figure.loading ? <span aria-hidden="true" className="figures-skeleton" /> : figure.value}
        </p>
        {figure.caption && <p className="figures-lede-caption">{figure.caption}</p>}
        {facts.length > 0 && !figure.loading && (
          <ul className="figures-facts">
            {facts.map(([value, of]) => (
              <li key={of}>
                <b>{value}</b>
                {of}
              </li>
            ))}
          </ul>
        )}
      </div>
      {!figure.loading && (
        <Room figure={figure} promoted={promoted} drawKey={figure.key} reduced={reduced} />
      )}
    </article>
  )
}

function Tile({ figure, onPromote, hold }) {
  return (
    <button
      type="button"
      className="figures-tile"
      ref={hold}
      data-tone={figure.tone || 'plain'}
      onClick={() => onPromote(figure.key)}
    >
      {/* Spans rather than paragraphs: a button may only carry phrasing
          content, and a block of prose inside one is markup no parser is
          obliged to keep in the shape it was written. */}
      <span className="figures-tile-label">
        <Label figure={figure} live={!figure.loading} />
      </span>
      <span className="figures-tile-value" key={figure.loading ? 'waiting' : 'landed'}>
        {figure.loading ? <span aria-hidden="true" className="figures-skeleton" /> : figure.value}
      </span>
      <span className="figures-tile-caption">{figure.caption}</span>
      <span className="figures-tile-open" aria-hidden="true">
        Open
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------------ *
 * The strip
 * ------------------------------------------------------------------------ */

export function Figures({ figures, pinned, busy, note }) {
  const shown = useMemo(() => figures.filter(Boolean), [figures])
  const [picked, setPicked] = useState(null)
  const reduced = useReducedMotion()

  const ledeRef = useRef(null)
  const tiles = useRef(new Map())
  // Where the two cards that are about to swap places were standing when the
  // reader asked for the swap.
  const flight = useRef(null)

  // An urgent figure takes the lede on arrival, so nobody has to notice the
  // red tile in position nine. It does not hold it against the reader: a strip
  // that answers a click by staying where it is reads as broken, and the tile
  // it came from is still red. The pick survives a read but not the figure
  // leaving the strip.
  const urgent = shown.find(figure => figure.urgent)
  const held = picked && shown.some(figure => figure.key === picked) ? picked : null
  const pin = pinned && shown.some(figure => figure.key === pinned) ? pinned : shown[0]?.key
  const ledeKey = held || (urgent ? urgent.key : pin)

  const lede = shown.find(figure => figure.key === ledeKey) || shown[0]
  const rest = shown.filter(figure => figure.key !== lede?.key)

  const promote = useCallback(
    key => {
      if (key === ledeKey) return
      flight.current = {
        into: tiles.current.get(key)?.getBoundingClientRect() || null,
        outOf: ledeRef.current?.getBoundingClientRect() || null,
        leaving: ledeKey,
      }
      setPicked(key)
    },
    [ledeKey]
  )

  // The promoted card travels from the tile it was, and the card it displaced
  // travels back into the tile it becomes, so the reader keeps hold of which
  // figure they are looking at. Asked for less motion, the two simply swap.
  useIsomorphicLayoutEffect(() => {
    const leg = flight.current
    flight.current = null
    if (!leg || reduced) return

    const fly = (element, from) => {
      if (!element || !from || typeof element.animate !== 'function') return
      const to = element.getBoundingClientRect()
      if (!to.width || !to.height) return
      element.animate(
        [
          {
            transformOrigin: 'top left',
            transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${
              from.width / to.width
            }, ${from.height / to.height})`,
            opacity: 0.45,
          },
          { transformOrigin: 'top left', transform: 'none', opacity: 1 },
        ],
        { duration: FLIGHT_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      )
    }

    fly(ledeRef.current, leg.into)
    fly(tiles.current.get(leg.leaving), leg.outOf)
  }, [ledeKey, reduced])

  if (!lede) return null

  const sets = bySet(rest)
  const named = sets.length > 1 || Boolean(sets[0]?.name)
  const cols = columnsForSets(
    sets.map(set => set.members.length),
    6,
    3
  )

  return (
    <m.div {...fadeInUp} className="figures" aria-busy={busy}>
      {note && <p className="figures-note">{note}</p>}
      <Lede figure={lede} promoted={lede.key} hold={ledeRef} reduced={reduced} />
      {rest.length > 0 && (
        <div className="figures-support" style={{ '--cols': cols }}>
          {sets.map(set => (
            <Fragment key={set.key}>
              {named && set.name && (
                <p className="figures-set">
                  {set.name}
                  {set.aside && <span className="figures-window">{set.aside}</span>}
                </p>
              )}
              {set.members.map(figure => (
                <Tile
                  key={figure.key}
                  figure={figure}
                  onPromote={promote}
                  hold={node => {
                    if (node) tiles.current.set(figure.key, node)
                    else tiles.current.delete(figure.key)
                  }}
                />
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </m.div>
  )
}
