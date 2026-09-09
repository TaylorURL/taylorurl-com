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
 * The one panel every group opens into, living inside the shell so the bar and
 * the directory are a single surface.
 *
 * Opening animates the region's height from zero; switching groups keeps the
 * region mounted, crossfades the content, and lets the height follow the new
 * columns, so travel between triggers never replays the entrance. A group sets
 * how many columns the panel runs, and the feature card holds a rail of its own
 * beside them, so a group of two columns and a group of four read as the same
 * furniture at two widths.
 *
 * Arrow keys walk every destination in reading order, Home and End jump to
 * either end, Escape closes and hands focus back to the trigger, and tabbing
 * past either end leaves rather than cycling. A closed panel is inert, which
 * is what keeps its destinations out of the tab order and out of the
 * accessibility tree whatever the collapse is doing to their height, and it is
 * the whole of that job: a panel hidden by `visibility` as well cannot take
 * focus on the frame it opens, which is the frame a keyboard opens it on.
 */
export function NavPanelViewport({ group, panelId, onClose, onCloseAll, panelRef, isActive }) {
  const reducedMotion = useReducedMotion()
  // The last group that was open, kept through the collapse so the panel does
  // not empty a frame before it closes. It is taken while rendering rather than
  // after: a panel opened from the keyboard hands focus to its first
  // destination on the frame it opens, and a destination that arrives a render
  // later is not there to take it.
  const [held, setHeld] = useState(group)
  const measureRef = useRef(null)
  const [height, setHeight] = useState(0)
  const open = Boolean(group)

  if (group && group !== held) setHeld(group)

  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    const measure = () => setHeight(el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [held])

  const items = () => Array.from(panelRef.current?.querySelectorAll('a') || [])

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

  return (
    <m.div
      id={panelId}
      ref={panelRef}
      inert={!open}
      aria-labelledby={held ? `${panelId}-${held.key}` : undefined}
      initial={false}
      animate={open ? 'open' : 'closed'}
      variants={{
        open: { height, opacity: 1 },
        closed: { height: 0, opacity: 0 },
      }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              height: { duration: NAV_DURATION_SLOW, ease: NAV_EASE },
              opacity: { duration: NAV_DURATION, ease: NAV_EASE },
            }
      }
      className="overflow-hidden"
      onKeyDown={handleKey}
    >
      <div ref={measureRef} className="nav-pad nav-panel-pad relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {held && (
            <m.div
              key={held.key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : NAV_DURATION, ease: NAV_EASE }}
              className="nav-panel-layout"
              data-feature={Boolean(held.feature)}
            >
              <div
                className="nav-panel-columns"
                style={{ '--nav-panel-columns': held.columns.length }}
              >
                {held.columns.map(column => (
                  <div key={column.head} className="flex min-w-0 flex-col">
                    <p className="nav-panel-head section-label-sm mb-4">{column.head}</p>
                    <ul className="nav-panel-column-list flex flex-col">
                      {column.items.map(entry => {
                        // A row pointing off the site is an anchor rather than
                        // a route. Everything else about it is the row beside
                        // it, so the element is the only thing that changes.
                        const Row = entry.href ? 'a' : Link
                        const link = entry.href
                          ? { href: entry.href, target: '_blank', rel: 'noopener noreferrer' }
                          : {
                              to: entry.to,
                              'aria-current': isActive(entry.to) ? 'page' : undefined,
                            }
                        return (
                          <li key={(entry.to ?? entry.href) + entry.label}>
                            <Row {...link} onClick={onCloseAll} className="nav-panel-item">
                              <span className="nav-panel-label">{entry.label}</span>
                              {entry.href && (
                                <ArrowUpRight
                                  className="nav-panel-away h-3.5 w-3.5 shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                            </Row>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>

              {held.feature &&
                (() => {
                  // The feature panel takes the same choice the rows do.
                  const FeatureRow = held.feature.href ? 'a' : Link
                  const featureLink = held.feature.href
                    ? { href: held.feature.href, target: '_blank', rel: 'noopener noreferrer' }
                    : {
                        to: held.feature.to,
                        'aria-current': isActive(held.feature.to) ? 'page' : undefined,
                      }
                  return (
                    <FeatureRow
                      {...featureLink}
                      onClick={onCloseAll}
                      data-tone={held.feature.tone}
                      className="nav-panel-feature group/feature relative flex h-full flex-col overflow-hidden rounded-[var(--r-card)] p-6"
                    >
                      {/* The group's own mark, drawn at the size of the card
                          and bled off its corner rather than set at the top
                          like a bullet. A rail the height of the columns has
                          room the words do not need, and a 40px drawing alone
                          in it read as something left behind; the same drawing
                          at the card's own scale is what the card is made of.
                          It is the sign the group already carries, so nothing
                          here is invented to fill a space. */}
                      {held.feature.mark && !held.feature.shots && (
                        <held.feature.mark className="nav-panel-watermark" aria-hidden="true" />
                      )}
                      {/* Everything the card says sits at its foot, so a rail
                          the height of the columns beside it reads as one
                          composition rather than as a card with a hole under
                          it. */}
                      <span className="relative mt-auto flex flex-col gap-3">
                        {held.feature.shots && (
                          <span className="grid grid-cols-3 gap-1.5">
                            {held.feature.shots.map(shot => (
                              <img
                                key={shot.src}
                                src={shot.src}
                                alt=""
                                width="1200"
                                height="750"
                                loading="lazy"
                                decoding="async"
                                className="nav-panel-shot block w-full"
                              />
                            ))}
                          </span>
                        )}
                        {/* The other listings the same business is reviewed on,
                            as marks alone. The card already links to one of them
                            and the column beside it links to every one by name,
                            so a second set of links here would be the third way
                            to the same four pages. What the row adds is the one
                            thing the name does not: that the proof is held in
                            several places, none of which is this site. */}
                        {held.feature.marks?.length > 0 && (
                          <span className="nav-panel-sources flex items-center gap-3 pb-1">
                            {held.feature.marks.map(source => (
                              <source.mark key={source.key} className="h-4 w-4" />
                            ))}
                            <span className="sr-only">
                              Also reviewed on{' '}
                              {held.feature.marks.map(source => source.label).join(', ')}
                            </span>
                          </span>
                        )}
                        {/* The sentence is the card's headline rather than a
                            note under a label, because the label is now the way
                            in and says only where it goes. */}
                        <span className="nav-panel-feature-head">{held.feature.summary}</span>
                        <span className="nav-panel-cta">
                          {held.feature.label}
                          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-[var(--nav-duration)] ease-out-soft group-hover/feature:-translate-y-0.5 group-hover/feature:translate-x-0.5" />
                        </span>
                      </span>
                    </FeatureRow>
                  )
                })()}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </m.div>
  )
}
