import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Eye, LogOut, Search, Settings, SunMoon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SiteIcon } from './SiteIcon'

/**
 * The account, at the head of the column, with everything belonging to it
 * behind one control.
 *
 * The panel is a switcher first. Under the account sit the sites this reader
 * can open, with a check against the one in scope, because changing scope is
 * the thing done most often and a select in the bar above the work is a second
 * place to look for it. The person signed in and the way out are their own
 * block at the foot: they answer who is reading rather than what is being read.
 *
 * It is a surface rather than a tint - the card ground, its own lift - so
 * nothing of the column shows through a panel covering it.
 *
 * The list of sites is the one part that has no length. An account with three
 * sites and an account with forty both open the same panel, so the switcher
 * scrolls inside its own block while the account above it and the way out below
 * it hold still. Without that the panel grows to whatever the account happens to
 * own and the sign-out row ends up under the bottom of the window, which is the
 * one row a reader most needs to be able to reach.
 *
 * Past a dozen sites, picking one by eye is reading a list rather than choosing
 * from a menu, so a filter appears at that point and not before it.
 *
 * One row in it is not the account's own business but the studio's: an admin can
 * ask to be shown the console the way a client sees it. It sits here rather than
 * in the bar because it changes who the console thinks is reading, which is the
 * question this whole panel answers, and it is taken away for the length of the
 * preview so that what an admin opens while previewing is exactly what a client
 * opens. The way back out is the strip across the top, which is the one thing on
 * that screen a client never has.
 */

/** The number of sites past which the list is worth filtering rather than reading. */
const FILTER_FROM = 12

/** The letter drawn on the tile, taken from the address the account signs in with. */
function initialOf(email) {
  return String(email ?? '?')
    .trim()
    .charAt(0)
    .toUpperCase()
}

export function ConsoleAccount({
  email,
  role,
  collapsed,
  theme,
  onCycleTheme,
  canPreview,
  preview,
  onPreview,
  sites = [],
  siteIds,
  scopeLabel,
  onPickSite,
  onToggleSite,
  onSignOut,
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const holder = useRef(null)

  // A panel left open behind a click elsewhere is one the reader dismisses
  // twice. Escape closes it and hands focus back to the control that opened it.
  useEffect(() => {
    if (!open) return undefined
    const away = event => {
      if (!holder.current?.contains(event.target)) setOpen(false)
    }
    const key = event => {
      if (event.key !== 'Escape') return
      setOpen(false)
      holder.current?.querySelector('.console-account-button')?.focus()
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  // A filter left behind from the last open is a list that comes back missing
  // rows for a reason nothing on screen explains.
  useEffect(() => {
    if (!open) setFilter('')
  }, [open])

  if (!email) return null

  const held = siteIds || []
  const scoped = held.length === 1 ? sites.find(site => site.site_id === held[0]) : null
  const label = scopeLabel || (scoped ? scoped.name : 'All Sites')
  const filtering = sites.length >= FILTER_FROM
  const needle = filter.trim().toLowerCase()
  const shown = needle ? sites.filter(site => site.name.toLowerCase().includes(needle)) : sites

  const pick = nextId => {
    onPickSite?.(nextId)
    setOpen(false)
  }

  return (
    <div className="console-account-holder" ref={holder} data-collapsed={collapsed || undefined}>
      <button
        type="button"
        className="console-account-button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={collapsed ? `Account, scoped to ${label}` : undefined}
        title={collapsed ? label : undefined}
        onClick={() => setOpen(is => !is)}
      >
        <span className="console-account-tile" aria-hidden="true">
          {initialOf(email)}
        </span>
        {!collapsed && (
          <span className="console-account-who">
            <span className="console-account-name">TaylorURL</span>
            <span className="console-account-role">{label}</span>
          </span>
        )}
        {!collapsed && (
          <ChevronsUpDown
            className="console-account-chevron"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div className="console-account-panel" role="menu">
          <div className="console-account-card">
            <span className="console-account-tile console-account-tile-lg" aria-hidden="true">
              {initialOf(email)}
            </span>
            <span className="console-account-who">
              <span className="console-account-card-name">TaylorURL</span>
              <span className="console-account-card-role">{email}</span>
            </span>
            <span className="console-account-badge">{role === 'admin' ? 'Admin' : 'Client'}</span>
          </div>

          <div className="console-account-rows">
            <Link
              to="/console/settings"
              role="menuitem"
              className="console-account-row"
              onClick={() => setOpen(false)}
            >
              <Settings className="console-account-glyph" strokeWidth={1.75} aria-hidden="true" />
              <span>Settings</span>
            </Link>
            <button
              type="button"
              role="menuitem"
              className="console-account-row"
              onClick={onCycleTheme}
            >
              <SunMoon className="console-account-glyph" strokeWidth={1.75} aria-hidden="true" />
              <span>Theme</span>
              <span className="console-account-value">{theme}</span>
            </button>
            {/* Offered on the real role and taken away by the drawn one, which
                is what makes the panel an admin opens while previewing the same
                panel a client opens. A row reading "Leave Preview" here would
                be the one thing on that screen a client has no equivalent of,
                and the whole rehearsal would be of a console nobody is
                shown. */}
            {canPreview && !preview ? (
              <button
                type="button"
                role="menuitem"
                className="console-account-row"
                onClick={() => {
                  setOpen(false)
                  onPreview?.()
                }}
              >
                <Eye className="console-account-glyph" strokeWidth={1.75} aria-hidden="true" />
                <span>Preview as Client</span>
              </button>
            ) : null}
          </div>

          {sites.length > 0 && (
            <div className="console-account-rows console-account-switch">
              <p className="console-account-head" id="console-account-sites">
                Sites
              </p>

              {filtering && (
                <div className="console-account-filter">
                  <Search
                    className="h-3.5 w-3.5 flex-shrink-0"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
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

              <div
                className="console-account-list"
                role="group"
                aria-labelledby="console-account-sites"
              >
                {!needle && (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={!held.length}
                    className="console-account-row"
                    onClick={() => pick(null)}
                  >
                    <span className="console-site-icon console-site-icon-all" aria-hidden="true" />
                    <span>All Sites</span>
                    {!held.length && (
                      <Check
                        className="console-account-check"
                        strokeWidth={2.25}
                        aria-hidden="true"
                      />
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
                      className="console-account-row"
                      onClick={() => pick(site.site_id)}
                    >
                      {/* The box adds this site beside whatever is already in
                          scope; the row replaces the scope with this one. */}
                      <span
                        role="checkbox"
                        tabIndex={-1}
                        aria-checked={on}
                        aria-label={
                          on
                            ? `Take ${site.name} out of the scope`
                            : `Add ${site.name} to the scope`
                        }
                        className="console-scope-box"
                        data-on={on}
                        onClick={event => {
                          event.stopPropagation()
                          onToggleSite?.(site.site_id)
                        }}
                      >
                        {on && <Check strokeWidth={3} aria-hidden="true" />}
                      </span>
                      <SiteIcon host={site.name} name={site.name} />
                      <span className="truncate">{site.name}</span>
                    </button>
                  )
                })}
                {needle && !shown.length && (
                  <p className="console-account-none">No site matches that.</p>
                )}
              </div>
            </div>
          )}

          <div className="console-account-rows">
            <button
              type="button"
              role="menuitem"
              className="console-account-row console-account-leave"
              onClick={() => {
                setOpen(false)
                onSignOut()
              }}
            >
              <LogOut className="console-account-glyph" strokeWidth={1.75} aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
