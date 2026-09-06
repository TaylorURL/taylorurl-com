import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { SiteIcon } from './SiteIcon'

// Below this a filter field is furniture: the whole list is on screen and
// typing into it is slower than looking.
const FILTER_FROM = 12

/**
 * The scope chooser: which site the section underneath is answering about.
 *
 * It sits where the scope was already stated, under the section's name, so the
 * line that says "tiretracker.app" is the control that changes it rather than a
 * label with the control somewhere else. A console that names its scope in one
 * place and moves it in another makes a reader hunt for the second.
 *
 * Every site the account can see is here, and so is the account itself. A
 * reader picks one site, or several, or all of them, and that is the only thing
 * deciding what each section draws.
 *
 * Picking a row replaces the scope with that one site, which is the common
 * move; holding the row's own checkbox adds it to the scope instead, so
 * building a comparison of two out of three is two clicks rather than a mode to
 * enter first. The panel stays open while boxes are ticked, because a
 * comparison is assembled rather than chosen, and closes on a plain pick.
 *
 * An account with one site gets no chooser: the shell has already scoped to it,
 * and a menu with a single entry is a step rather than a choice.
 */
export function ConsoleScope({ sites, siteIds, label, onPickSite, onToggleSite }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const holder = useRef(null)

  const held = siteIds || []
  const scoped = held.length === 1 ? sites.find(site => site.site_id === held[0]) : null
  const everything = !held.length
  const filtering = sites.length >= FILTER_FROM
  const needle = filter.trim().toLowerCase()
  const shown = useMemo(
    () => (needle ? sites.filter(site => site.name.toLowerCase().includes(needle)) : sites),
    [needle, sites]
  )

  useEffect(() => {
    if (!open) {
      setFilter('')
      return undefined
    }
    const away = event => {
      if (!holder.current?.contains(event.target)) setOpen(false)
    }
    const key = event => {
      if (event.key !== 'Escape') return
      setOpen(false)
      // Closing with the keyboard puts the reader back on the control they
      // opened, rather than at the top of the document.
      holder.current?.querySelector('.console-scope-button')?.focus()
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  // The arrows walk the rows the eye is already walking. Without them the list
  // is reachable only by tabbing through every site above the one wanted.
  const walk = event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const rows = Array.from(holder.current?.querySelectorAll('.console-scope-row') || [])
    if (!rows.length) return
    event.preventDefault()
    const at = rows.indexOf(document.activeElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    rows[(at + step + rows.length) % rows.length]?.focus()
  }

  const pick = next => {
    onPickSite(next)
    setOpen(false)
  }

  // Ticking a box builds the scope up rather than replacing it, so the panel
  // stays where it is and the reader sees the count change as they go.
  const toggle = (event, id) => {
    event.stopPropagation()
    onToggleSite(id)
  }

  if (sites.length < 2) return <p className="console-scope-plain">{label}</p>

  return (
    <div className="console-scope" ref={holder} onKeyDown={walk}>
      <button
        type="button"
        className="console-scope-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Scope: ${label}. Change it.`}
        onClick={() => setOpen(shut => !shut)}
      >
        {scoped ? (
          <SiteIcon host={scoped.name} name={scoped.name} />
        ) : (
          <span className="console-site-icon console-site-icon-all" aria-hidden="true" />
        )}
        <span className="truncate">{label}</span>
        <ChevronDown className="console-scope-chevron" strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div className="console-scope-panel" role="menu" aria-label="Scope">
          {filtering && (
            <div className="console-scope-filter">
              <Search className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={filter}
                onChange={event => setFilter(event.target.value)}
                placeholder="Filter sites"
                aria-label="Filter sites"
                autoComplete="off"
              />
            </div>
          )}

          <div className="console-scope-list">
            {!needle && (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={everything}
                className="console-scope-row"
                onClick={() => pick(null)}
              >
                <span className="console-site-icon console-site-icon-all" aria-hidden="true" />
                <span>All Sites</span>
                <span className="console-scope-note">{sites.length} tracked</span>
                {everything && (
                  <Check className="console-account-check" strokeWidth={2.25} aria-hidden="true" />
                )}
              </button>
            )}
            {shown.map(site => {
              const on = held.includes(site.site_id)
              return (
                <button
                  key={site.site_id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  className="console-scope-row"
                  onClick={() => pick(site.site_id)}
                >
                  {/* The box adds this site to the scope and leaves the rest of
                      it standing; the row around it replaces the scope with
                      this site alone. Two answers to two different questions,
                      in the order a reader asks them. */}
                  <span
                    role="checkbox"
                    tabIndex={-1}
                    aria-checked={on}
                    aria-label={
                      on ? `Take ${site.name} out of the scope` : `Add ${site.name} to the scope`
                    }
                    className="console-scope-box"
                    data-on={on}
                    onClick={event => toggle(event, site.site_id)}
                  >
                    {on && <Check strokeWidth={3} aria-hidden="true" />}
                  </span>
                  <SiteIcon host={site.name} name={site.name} />
                  <span className="truncate">{site.name}</span>
                  {site.live > 0 && (
                    <span className="console-scope-note is-live">{site.live} on</span>
                  )}
                </button>
              )
            })}
            {needle && !shown.length && <p className="console-scope-none">No site matches that.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
