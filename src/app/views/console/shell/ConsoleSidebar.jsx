import { ChevronsLeft, Lock } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { GROUPS, sectionHref } from '../lib/sections'
import { ConsoleAccount } from './ConsoleAccount'

/**
 * The console's own navigation: a full-height column beside the work, not a box
 * inside it.
 *
 * A dashboard is read by somebody who came to look at one figure and then two
 * more, so the menu is furniture rather than a destination. It holds the left
 * edge at every scroll position, files its sections under four headings so
 * the eye lands on a shape instead of a list, and marks the open one with an
 * accent wash rather than a solid fill, which stays legible when the row is
 * also hovered.
 *
 * Collapsed it keeps the marks and drops the words, which is what makes the
 * column worth having on a laptop: the figures get two hundred pixels back and
 * the section is still one click away.
 *
 * A locked section is still in the menu and still a link: it goes to the sign-in
 * page and comes back to the section afterwards. Leaving it out instead would
 * make the signed-out console a shorter, different console rather than the same
 * one waiting on an account.
 */

function Item({ section, collapsed }) {
  const { locked, mark: Mark } = section
  return (
    <NavLink
      to={locked ? '/login' : sectionHref(section)}
      state={locked ? { from: sectionHref(section) } : undefined}
      end={!section.path}
      title={
        collapsed
          ? section.label
          : locked
            ? `${section.description} Sign in to open it.`
            : section.description
      }
      className="console-nav-item"
      data-locked={locked ? 'true' : undefined}
      data-collapsed={collapsed ? 'true' : undefined}
    >
      <span className="console-nav-mark" aria-hidden="true">
        {Mark ? <Mark className="h-[18px] w-[18px]" /> : null}
      </span>
      {!collapsed && <span className="console-nav-label truncate">{section.label}</span>}
      {!collapsed && locked && (
        <Lock aria-hidden="true" className="ml-auto h-3 w-3 flex-shrink-0" strokeWidth={2} />
      )}
      {locked && <span className="sr-only">needs an account</span>}
    </NavLink>
  )
}

/**
 * The column. `collapsed` is held by the frame rather than here, because the
 * grid beside it has to change width in the same frame.
 */
export function ConsoleSidebar({
  sections,
  collapsed,
  onToggle,
  email,
  role,
  sites,
  siteIds,
  scopeLabel,
  onPickSite,
  onToggleSite,
  onSignOut,
  canPreview,
  preview,
  onPreview,
  theme,
  onCycleTheme,
}) {
  return (
    <nav
      id="console-sections"
      aria-label="Console sections"
      className="console-sidebar"
      data-collapsed={collapsed}
    >
      {/* The brand row is exactly the height of the bar beside it, so the one
          rule under both runs unbroken across the window. Two rules at two
          heights meeting at the rail's edge is the first thing an eye finds on
          a dashboard, and it finds it before it finds any figure. */}
      <div className="console-sidebar-head">
        <Link to="/" className="console-brand" title="TaylorURL">
          {/* The wordmark carries the name on its own, so the column drops to
              the leading glyph rather than shrinking six letters past reading
              when the rail narrows. */}
          <img
            src={collapsed ? '/images/taylorurl-mark.png' : '/images/taylorurl-wordmark.png'}
            alt="TaylorURL"
            width={collapsed ? 300 : 874}
            height={collapsed ? 300 : 262}
            className={collapsed ? 'console-brand-glyph' : 'console-brand-logo'}
            draggable={false}
          />
          {!collapsed && (
            <>
              <span className="console-brand-rule" aria-hidden="true" />
              <span className="console-brand-word">Console</span>
            </>
          )}
        </Link>
      </div>

      <ConsoleAccount
        email={email}
        role={role}
        collapsed={collapsed}
        theme={theme}
        onCycleTheme={onCycleTheme}
        sites={sites}
        siteIds={siteIds}
        scopeLabel={scopeLabel}
        onPickSite={onPickSite}
        onToggleSite={onToggleSite}
        onSignOut={onSignOut}
        canPreview={canPreview}
        preview={preview}
        onPreview={onPreview}
      />

      <div className="console-sidebar-scroll">
        {GROUPS.map(group => {
          const rows = sections.filter(section => section.group === group)
          if (!rows.length) return null
          return (
            <div key={group} className="console-nav-group">
              {!collapsed && <p className="console-nav-group-head">{group}</p>}
              <ul>
                {rows.map(section => (
                  <li key={section.id}>
                    <Item section={section} collapsed={collapsed} />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {/* The width control lives down here rather than in the head, because the
          narrow rail is the width of one mark and a second control beside the
          brand does not fit in it. */}
      <div className="console-sidebar-foot">
        <button
          type="button"
          onClick={onToggle}
          className="console-foot-button console-collapse"
          aria-label={collapsed ? 'Widen the Menu' : 'Narrow the Menu'}
          title={collapsed ? 'Widen the Menu' : 'Narrow the Menu'}
        >
          <ChevronsLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {!collapsed && <span>Narrow</span>}
        </button>
      </div>
    </nav>
  )
}
