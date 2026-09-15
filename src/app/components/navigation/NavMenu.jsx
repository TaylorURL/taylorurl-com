import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { NAV_DURATION, NAV_DURATION_SLOW, NAV_EASE } from '@constants/navigation'

/**
 * One group's trigger in the bar.
 *
 * The bar owns the panel and every trigger points at the same one, so this
 * only reports intent: hover, toggle, a keyboard open that should carry focus
 * into the panel, or a step to the trigger on either side. `active` marks the
 * trigger whose group holds the current page, and says so in the rule under
 * the label as well as in the ink, so the bar places the reader without asking
 * anyone to tell two colours apart.
 */
export function NavTrigger({
  group,
  panelId,
  open,
  active,
  onHover,
  onToggle,
  onClose,
  onOpenForKeyboard,
  onStep,
}) {
  const handleKey = event => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpenForKeyboard()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      onStep(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      onStep(-1)
    } else if (event.key === 'Escape') {
      onClose()
    }
  }

  return (
    <li onPointerEnter={event => event.pointerType !== 'touch' && onHover()}>
      <button
        type="button"
        id={`${panelId}-${group.key}`}
        data-nav-trigger={group.key}
        data-active={active}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        aria-current={active ? 'true' : undefined}
        className="nav-link group relative inline-flex items-center gap-1.5 rounded-[var(--r-control)] px-2.5 py-2 text-[14px] font-medium transition-colors duration-[var(--nav-duration)] ease-out-soft xl:px-3"
        onClick={onToggle}
        onKeyDown={handleKey}
      >
        {group.label}
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-[var(--nav-duration)] ease-out-soft ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-2 -bottom-0.5 h-px origin-center bg-accent transition-transform duration-[var(--nav-duration-slow)] ease-out-soft xl:inset-x-3 ${
            open || active ? 'scale-x-100' : 'scale-x-0'
          }`}
        />
      </button>
    </li>
  )
}

/**
 * One destination in the bar, for a site whose menu is not grouped.
 *
 * The same furniture as a trigger minus the parts a trigger needs: no chevron,
 * because nothing opens; no `aria-expanded` or `aria-controls`, because there
 * is no panel to describe; and `aria-current="page"` rather than a group's
 * `aria-current="true"`, because this is the page rather than the group holding
 * it. The rule under the label and the resting ink are shared, so the two bars
 * are the same bar with a different number of things in it.
 */
export function NavBarLink({ to, href, label, active }) {
  // A row pointing at the other site is an anchor, because the two sites are
  // separate deployments on separate origins and the router cannot reach across.
  // It stays in the same tab and takes no external-link arrow: those say "this
  // leaves us", and it does not — it is the same company, one door along.
  const Row = href ? 'a' : Link
  const link = href ? { href } : { to, 'aria-current': active ? 'page' : undefined }

  return (
    <li>
      <Row
        {...link}
        data-active={active}
        className="nav-link group relative inline-flex items-center rounded-[var(--r-control)] px-2.5 py-2 text-[14px] font-medium transition-colors duration-[var(--nav-duration)] ease-out-soft xl:px-3"
      >
        {label}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-2 -bottom-0.5 h-px origin-center bg-accent transition-transform duration-[var(--nav-duration-slow)] ease-out-soft xl:inset-x-3 ${
            active ? 'scale-x-100' : 'scale-x-0'
          }`}
        />
      </Row>
    </li>
  )
}

/**
 * The link an entry opens. A row pointing off the site is an anchor rather
 * than a route, and everything else about it is the row beside it, so the
 * element is the only thing that changes.
 */
const linkFor = (entry, isActive) =>
  entry.href
    ? { as: 'a', href: entry.href, target: '_blank', rel: 'noopener noreferrer' }
    : { as: Link, to: entry.to, 'aria-current': isActive(entry.to) ? 'page' : undefined }

/**
 * A tile: the destination as a small card, led by its capture where it has
 * one and by its mark where it does not. The tiles are the group's headline
 * parts - the two ways a site is bought, the three studies, the free tools,
 * the article shelves - and a card is what gives each of them the room a row
 * cannot.
 */
function NavTile({ entry, isActive, onCloseAll }) {
  const { as: Row, ...link } = linkFor(entry, isActive)
  return (
    <Row {...link} onClick={onCloseAll} className="nav-tile">
      {entry.shot ? (
        <img
          src={entry.shot}
          alt=""
          width="1200"
          height="750"
          loading="lazy"
          decoding="async"
          className="nav-tile-shot"
        />
      ) : (
        entry.mark && <entry.mark className="nav-tile-mark" />
      )}
      <span className="nav-tile-name">
        {entry.label}
        {entry.href && <ArrowUpRight className="nav-away" aria-hidden="true" />}
      </span>
      {entry.summary && <span className="nav-tile-line">{entry.summary}</span>}
    </Row>
  )
}

/**
 * A row: the mark, the name, and - unless the section sets its rows dense -
 * the line under it. A row with no mark keeps the column by taking the mark's
 * slot empty.
 */
function NavRow({ entry, dense, isActive, onCloseAll }) {
  const { as: Row, ...link } = linkFor(entry, isActive)
  const line = !dense && entry.summary
  return (
    <Row {...link} onClick={onCloseAll} className="nav-entry" data-dense={!line}>
      {entry.mark ? (
        <entry.mark className="nav-entry-mark" />
      ) : (
        <span className="nav-entry-mark" aria-hidden="true" />
      )}
      <span className="nav-entry-text">
        <span className="nav-entry-name">
          {entry.label}
          {entry.href && <ArrowUpRight className="nav-away" aria-hidden="true" />}
        </span>
        {line && <span className="nav-entry-line">{entry.summary}</span>}
      </span>
    </Row>
  )
}

/**
 * One headed part of a group, placed on the body's grid where the data says:
 * `span` is how many tracks it takes and `rows` how many rows, so a tall
 * column can stand beside two short ones stacked. Tiles or rows, by `kind`.
 */
function NavSection({ section, wide, isActive, onCloseAll }) {
  const pick = key => (wide ? (section[`${key}Wide`] ?? section[key]) : section[key])
  const span = pick('span')
  const rows = pick('rows')
  return (
    <div
      className="nav-section"
      style={{
        gridColumn: span ? `span ${span}` : undefined,
        gridRow: rows ? `span ${rows}` : undefined,
      }}
    >
      <p className="nav-section-head section-label-sm">{section.head}</p>
      {section.kind === 'tiles' ? (
        <ul className="nav-tiles" style={{ '--nav-per': pick('per') ?? 2 }}>
          {section.items.map(entry => (
            <li key={(entry.to ?? entry.href) + entry.label} className="flex min-w-0">
              <NavTile entry={entry} isActive={isActive} onCloseAll={onCloseAll} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="nav-entries">
          {section.items.map(entry => (
            <li key={(entry.to ?? entry.href) + entry.label}>
              <NavRow
                entry={entry}
                dense={section.dense}
                isActive={isActive}
                onCloseAll={onCloseAll}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * The cover: the group's own page, standing down the left edge of the sheet.
 * It is on the left because that is where reading starts, and the one sentence
 * saying what the whole group is for belongs before the list of its parts.
 * The upper field carries a photograph of the kind of place the group is
 * about, and the words and the way in sit at the foot, so the cover reads top
 * to bottom like a title page.
 */
function NavCover({ group, isActive, onCloseAll }) {
  const feature = group.feature
  const { as: Row, ...link } = linkFor(feature, isActive)
  return (
    <Row
      {...link}
      onClick={onCloseAll}
      data-tone={feature.tone}
      data-photo={Boolean(feature.image)}
      className="nav-cover"
    >
      {/* The photograph, under everything, fading into the sheet's own
          surface where the words are. It is drawn only while the group is
          held, so a page whose menu is never opened never fetches it. */}
      {feature.image && (
        <img
          src={feature.image}
          alt=""
          width="832"
          height="1100"
          loading="lazy"
          decoding="async"
          className="nav-cover-photo"
        />
      )}
      <span className="nav-cover-field" aria-hidden="true">
        {!feature.image && feature.mark && <feature.mark className="nav-cover-mark" />}
      </span>
      <span className="nav-cover-words">
        <span className="nav-cover-eyebrow section-label-sm">{group.label}</span>
        <span className="nav-cover-head">{feature.summary}</span>
        {/* The other listings the same business is reviewed on, as marks
            alone in their own colours. The card already links to one of them
            and the section beside it links to every one by name; what the row
            adds is that the proof is held in several places, none of which
            is this site. */}
        {feature.marks?.length > 0 && (
          <span className="nav-cover-sources">
            {feature.marks.map(source => (
              <source.mark key={source.key} className="h-4 w-4" />
            ))}
            <span className="sr-only">
              Also reviewed on {feature.marks.map(source => source.label).join(', ')}
            </span>
          </span>
        )}
        <span className="nav-cover-cta">
          {feature.label}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </span>
    </Row>
  )
}

/**
 * The cover's share of the sheet: a quarter and a little, between the width a
 * photograph needs to read and the width past which one sentence is standing
 * in a field.
 */
const COVER_MIN = 272
const COVER_MAX = 416
const COVER_SHARE = 0.26

/**
 * The sheet every group opens: one card hanging under the bar, the width of
 * the bar's own row, so its left edge is the wordmark's and its right edge is
 * the action's.
 *
 * Width it has, and the group fills it: the cover takes its share and grows
 * with the screen, and the body takes the group's wide layout once it has the
 * room for one - the same parts in one row rather than two. Opening lifts the
 * sheet in from a few pixels above its place; switching groups keeps it
 * mounted, crossfades the content, and lets the height follow the new group,
 * so travel between triggers reads as one card changing shape rather than as
 * one panel closing and another opening.
 *
 * Arrow keys walk every destination in reading order, Home and End jump to
 * either end, Escape closes and hands focus back to the trigger, and tabbing
 * past either end leaves rather than cycling. A closed sheet is inert, which
 * is what keeps its destinations out of the tab order and out of the
 * accessibility tree, and takes no pointer, so the faded card is not a pane
 * of glass over the page. It is not hidden by `visibility` as well: a sheet
 * hidden that way cannot take focus on the frame it opens, which is the frame
 * a keyboard opens it on.
 */
export function NavPanelViewport({ group, panelId, onClose, onCloseAll, panelRef, isActive }) {
  const reducedMotion = useReducedMotion()
  // The last group that was open, kept through the fade so the sheet does not
  // empty a frame before it goes. Taken while rendering rather than after: a
  // sheet opened from the keyboard hands focus to its first destination on the
  // frame it opens, and a destination that arrives a render later is not there
  // to take it.
  const [held, setHeld] = useState(group)
  const anchorRef = useRef(null)
  const measureRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [room, setRoom] = useState(0)
  const open = Boolean(group)

  if (group && group !== held) setHeld(group)

  // The room a sheet has: the shell's width less the inset on either side.
  useEffect(() => {
    const anchor = anchorRef.current
    const shell = anchor?.parentElement
    if (!shell) return
    const measure = () => setRoom(shell.clientWidth - anchor.offsetLeft * 2)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(shell)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    const measure = () => setSize({ width: el.offsetWidth, height: el.offsetHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [held])

  const width = held ? room : 0
  const cover = Math.min(COVER_MAX, Math.max(COVER_MIN, Math.round(width * COVER_SHARE)))
  const wide = Boolean(held) && width - cover >= (held.wideAt ?? Infinity)

  // The live group's destinations. While one group fades out under the next,
  // the sheet holds both, and a walk that counted the leaving group's links
  // would step focus onto a row about to be removed.
  const items = () =>
    Array.from(panelRef.current?.querySelectorAll(`[data-nav-group="${held?.key}"] a`) || [])

  const focusItem = index => {
    const all = items()
    if (!all.length) return
    all[(index + all.length) % all.length].focus()
  }

  const handleKey = event => {
    const all = items()
    const at = all.indexOf(document.activeElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      focusItem(at + 1)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      focusItem(at - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusItem(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusItem(all.length - 1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Tab') {
      const leaving = event.shiftKey ? at <= 0 : at >= all.length - 1
      if (leaving) onCloseAll()
    }
  }

  const slow = { duration: NAV_DURATION_SLOW, ease: NAV_EASE }
  const quick = { duration: NAV_DURATION, ease: NAV_EASE }

  return (
    <div ref={anchorRef} className="nav-sheet-anchor hidden lg:block">
      <m.div
        id={panelId}
        ref={panelRef}
        inert={!open}
        aria-labelledby={held ? `${panelId}-${held.key}` : undefined}
        initial={false}
        animate={open ? 'open' : 'closed'}
        variants={{
          open: { opacity: 1, y: 0, scale: 1, width: size.width, height: size.height },
          closed: { opacity: 0, y: -8, scale: 0.985, width: size.width, height: size.height },
        }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { width: slow, height: slow, opacity: quick, y: quick, scale: quick }
        }
        style={{ pointerEvents: open ? 'auto' : 'none' }}
        className="nav-sheet"
        onKeyDown={handleKey}
      >
        <div ref={measureRef} style={{ width }}>
          <AnimatePresence mode="popLayout" initial={false}>
            {held && (
              <m.div
                key={held.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reducedMotion ? 0 : NAV_DURATION, ease: NAV_EASE }}
                data-nav-group={held.key}
                className="nav-sheet-content"
                style={{ width, gridTemplateColumns: `${cover}px minmax(0, 1fr)` }}
              >
                {held.feature && (
                  <NavCover group={held} isActive={isActive} onCloseAll={onCloseAll} />
                )}
                <div
                  className="nav-body"
                  style={{
                    gridTemplateColumns: `repeat(${(wide ? held.gridWide : null) ?? held.grid ?? 2}, minmax(0, 1fr))`,
                  }}
                >
                  {held.columns.map(section => (
                    <NavSection
                      key={section.head}
                      section={section}
                      wide={wide}
                      isActive={isActive}
                      onCloseAll={onCloseAll}
                    />
                  ))}
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </m.div>
    </div>
  )
}
