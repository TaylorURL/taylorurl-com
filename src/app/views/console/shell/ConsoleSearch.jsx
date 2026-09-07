import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Lock, Search } from 'lucide-react'
import { sectionHref } from '../lib/sections'
import { SiteIcon } from '../SiteIcon'

/**
 * One field that reaches everything the console holds.
 *
 * The column lists the sections and the account panel lists the sites, which
 * means the two things a reader moves between live in two different places and
 * neither is reachable from the keyboard. This is the one control that answers
 * both: type three letters of a section or a domain and press return.
 *
 * It opens over the page rather than sitting in the bar as a live field. A
 * field in a bar is a field the reader tabs into by accident on the way to the
 * window picker, and it has to be narrow enough to leave room for the controls
 * beside it, which is not enough room to read a result in. The bar carries the
 * button that opens this, at the width a field would have had, so the affordance
 * is where it is looked for and the room is where it is needed.
 *
 * A locked section is still a result. A signed-out reader searching for Traffic
 * should find it and be told it needs an account, rather than be shown a
 * console that appears not to have one.
 */

/** How a row is acted on: a section is opened, a site is put in scope. */
const SECTION = 'section'
const SITE = 'site'

/**
 * Whether a query matches, and how well.
 *
 * A leading match ranks above one in the middle, so typing "st" puts Status
 * over Sites rather than leaving the order to the catalogue. Anything that
 * does not contain the query at all is out.
 */
function score(text, needle) {
  const haystack = text.toLowerCase()
  const at = haystack.indexOf(needle)
  if (at < 0) return null
  return at === 0 ? 0 : 1
}

export function ConsoleSearch({ open, onClose, sections, sites, siteIds, onPickSite }) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const field = useRef(null)
  const list = useRef(null)
  const navigate = useNavigate()

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const found = []

    for (const section of sections) {
      const rank = needle ? score(`${section.label} ${section.description}`, needle) : 0
      if (rank === null) continue
      found.push({
        kind: SECTION,
        id: `section:${section.id}`,
        label: section.label,
        detail: section.description,
        locked: section.locked,
        section,
        rank,
      })
    }

    for (const site of sites) {
      const rank = needle ? score(site.name, needle) : 0
      if (rank === null) continue
      found.push({
        kind: SITE,
        id: `site:${site.site_id}`,
        label: site.name,
        detail: (siteIds || []).includes(site.site_id) ? 'Already in scope' : 'Show only this site',
        site,
        rank,
      })
    }

    // Sections lead when nothing has been typed, because that is the list the
    // reader would otherwise be scanning the column for. Once there is a query
    // the better match leads whichever kind it is.
    return found
      .sort((first, second) => {
        if (needle && first.rank !== second.rank) return first.rank - second.rank
        if (first.kind !== second.kind) return first.kind === SECTION ? -1 : 1
        return 0
      })
      .slice(0, 12)
  }, [query, sections, sites, siteIds])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
    // Focused on mount and again on the next frame. The first call is what makes
    // the panel usable the instant it opens; the second is the one that wins
    // when the browser restores focus to whatever opened it. Waiting only for
    // the frame leaves the field unfocused in any context where the frame does
    // not come, and a search panel that has to be clicked into is one the
    // keyboard cannot reach at all.
    field.current?.focus()
    const id = requestAnimationFrame(() => field.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => setCursor(0), [query])

  // The highlighted row is kept in view, so holding the arrow key runs down the
  // list rather than off the bottom of it.
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor, rows])

  if (!open) return null

  const act = row => {
    if (!row) return
    onClose()
    if (row.kind === SITE) {
      onPickSite(row.site.site_id)
      return
    }
    if (row.locked) {
      navigate('/login', { state: { from: sectionHref(row.section) } })
      return
    }
    navigate(sectionHref(row.section))
  }

  const onKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor(at => (rows.length ? (at + 1) % rows.length : 0))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor(at => (rows.length ? (at - 1 + rows.length) % rows.length : 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      act(rows[cursor])
    }
  }

  // Straight onto the body, because the console frame isolates itself and a
  // z-index inside an isolated element cannot rise past the chrome outside it.
  return createPortal(
    <div
      data-theme="console"
      className="console-search"
      role="dialog"
      aria-modal="true"
      aria-label="Search the console"
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="console-search-card">
        <div className="console-search-field">
          <Search className="h-4 w-4 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
          <input
            ref={field}
            type="text"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search sections and sites"
            aria-label="Search sections and sites"
            aria-controls="console-search-results"
            autoComplete="off"
            spellCheck="false"
          />
          <kbd>Esc</kbd>
        </div>

        <ul id="console-search-results" ref={list} role="listbox" className="console-search-list">
          {rows.map((row, index) => (
            <li key={row.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === cursor}
                data-active={index === cursor}
                className="console-search-row"
                onMouseMove={() => setCursor(index)}
                onClick={() => act(row)}
              >
                <span className="console-search-mark" aria-hidden="true">
                  {row.kind === SITE ? (
                    <SiteIcon host={row.label} name={row.label} />
                  ) : row.section.mark ? (
                    <row.section.mark className="h-[18px] w-[18px]" />
                  ) : null}
                </span>
                <span className="console-search-text">
                  <span className="console-search-label">{row.label}</span>
                  <span className="console-search-detail">{row.detail}</span>
                </span>
                {row.locked && (
                  <Lock className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
                )}
                {index === cursor && (
                  <CornerDownLeft
                    className="h-3.5 w-3.5 flex-shrink-0"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                )}
              </button>
            </li>
          ))}
          {!rows.length && <p className="console-search-none">Nothing here matches that.</p>}
        </ul>
      </div>
    </div>,
    document.body
  )
}
