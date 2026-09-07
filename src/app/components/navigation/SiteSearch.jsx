import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, CornerDownLeft, Search } from 'lucide-react'
import { SEARCH_ENTRIES, SEARCH_STARTERS } from '@data/pages/searchIndex'
import { rankEntries, splitMatch } from '@utils/search'

// Eight rows is what fits over the fold on a phone with the field above them.
// A list longer than the box that holds it turns a search into a scroll, which
// is the thing the reader opened the search to avoid.
const RESULT_LIMIT = 8

/**
 * The label under a row, saying what the reader is about to open. A page's
 * summary is the better sentence where it has one; a section name is what is
 * left when it does not, and it is still worth more than nothing -- a bare list
 * of names makes the reader open one to find out whether it was the right one.
 */
const rowNote = entry => entry.summary || entry.section

/** The matched span, marked, so a row can say why it is in the list. */
function Marked({ text, query }) {
  const { before, hit, after } = splitMatch(text, query)
  if (!hit) return text
  return (
    <>
      {before}
      <mark className="site-search-hit">{hit}</mark>
      {after}
    </>
  )
}

/**
 * The site's search, over every page the public site has.
 *
 * It is mounted only while it is open and reached through `import()`, so the
 * index it carries -- which is the blog in full -- is a chunk that lands when
 * somebody searches rather than one every visitor pays for on arrival. That is
 * also why there is no exit animation: the component is gone the frame it
 * closes, and animating a thing that has already been unmounted would mean
 * keeping the whole of it mounted for the sake of a fade.
 *
 * The field is a combobox over a listbox, which is what lets the reader keep
 * typing while the arrow keys walk the rows underneath: focus never leaves the
 * input, and the row a press would open is named by `aria-activedescendant`
 * rather than by having been focused. Rows are still real links, so the
 * ordinary browser things -- middle click, open in a new tab, copy the address
 * -- all work on them.
 */
export default function SiteSearch({ onClose }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const fieldRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()

  const results = useMemo(
    () => (query.trim() ? rankEntries(SEARCH_ENTRIES, query, RESULT_LIMIT) : SEARCH_STARTERS),
    [query]
  )
  const active = results[cursor]

  // A new query is a new list, and a cursor left where it was points at
  // whichever row happens to have landed in that position.
  useEffect(() => setCursor(0), [query])

  // The page is handed back the focus it had. Without this a reader who opened
  // the search from the keyboard, found nothing and closed it is returned to
  // the top of the document, which on a page this long is a scroll back to
  // where they were standing.
  useEffect(() => {
    const opener = document.activeElement
    // Twice: once now, and once on the next frame for the case where the
    // portal's own mount moves focus after this effect has run.
    fieldRef.current?.focus()
    const frame = requestAnimationFrame(() => fieldRef.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
  }, [])

  // The page holds still under the dialog, and is put back exactly where it
  // was. The root is what scrolls here, so the root is what is held; releasing
  // the clamp without restoring the offset drops the reader wherever it left
  // them, which is a jump they did not ask for on the way out of a search.
  useEffect(() => {
    const held = window.scrollY
    const root = document.documentElement
    const heldOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      root.style.overflow = heldOverflow
      document.body.style.overflow = ''
      window.scrollTo({ top: held, behavior: 'instant' })
    }
  }, [])

  // The row a press would open is kept in view. `nearest` rather than a scroll
  // to centre, so walking down a list only moves it when the cursor has reached
  // an edge instead of sliding the whole list under every press.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor, query])

  const open = entry => {
    if (!entry) return
    onClose()
    if (entry.href) window.open(entry.href, '_blank', 'noopener,noreferrer')
    else navigate(entry.to)
  }

  const step = delta => {
    if (!results.length) return
    setCursor(at => (at + delta + results.length) % results.length)
  }

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      step(1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      step(-1)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      open(active)
    }
  }

  // Portalled to the body rather than rendered inside the bar. The bar is a
  // fixed, stacking-context-forming element, and a layer inside one cannot rise
  // past the chrome outside it however high its z-index is set.
  return createPortal(
    <div
      className="site-search"
      onPointerDown={event => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search TaylorURL"
        className="site-search-card"
        onKeyDown={handleKeyDown}
      >
        <div className="site-search-field">
          <Search className="site-search-glyph h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
          <input
            ref={fieldRef}
            type="search"
            role="combobox"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search services, trades, towns, and articles"
            aria-label="Search the site"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={active ? `${listId}-${cursor}` : undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            className="site-search-input"
          />
          <button type="button" className="site-search-dismiss" onClick={onClose}>
            Esc
          </button>
        </div>

        {results.length ? (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Results"
            className="site-search-list"
          >
            {results.map((entry, index) => {
              const Row = entry.href ? 'a' : Link
              const link = entry.href
                ? { href: entry.href, target: '_blank', rel: 'noopener noreferrer' }
                : { to: entry.to }
              return (
                <li key={entry.id}>
                  <Row
                    {...link}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === cursor}
                    data-active={index === cursor}
                    className="site-search-row"
                    onClick={onClose}
                    onMouseMove={() => setCursor(index)}
                  >
                    {entry.mark ? (
                      <entry.mark
                        className="site-search-mark h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <span className="site-search-mark-gap shrink-0" aria-hidden="true" />
                    )}
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="site-search-label truncate">
                        <Marked text={entry.label} query={query} />
                      </span>
                      <span className="site-search-note truncate">{rowNote(entry)}</span>
                    </span>
                    {entry.href ? (
                      <ArrowUpRight
                        className="site-search-tail h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <CornerDownLeft
                        className="site-search-tail h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </Row>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="site-search-empty">
            No page matches that. Try a service, a trade, a town, or a word from an article.
          </p>
        )}

        {/* Live for a screen reader that cannot see the list change under a
            field it never left. Polite, so it waits for a pause in the typing
            rather than interrupting every keystroke. */}
        <span aria-live="polite" className="sr-only">
          {query.trim()
            ? `${results.length} ${results.length === 1 ? 'result' : 'results'}`
            : 'Type to search'}
        </span>
      </div>
    </div>,
    document.body
  )
}
