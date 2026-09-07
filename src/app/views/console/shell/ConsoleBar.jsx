import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Keyboard, LogIn, Menu, Search, SunMoon, X } from 'lucide-react'
import { ConsoleScope } from './ConsoleScope'
import { MODIFIER } from '../lib/useConsoleShortcuts'

/**
 * The console's top rail.
 *
 * It answers one question and offers one way out, and both are in one place
 * rather than spread across the window.
 *
 * On the left, what is being read: the section's name, the site the figures
 * belong to, and the window they cover. The last two are one question asked
 * twice - whose figures, over what period - so they stand together immediately
 * after the name, in the order a reader asks them, and both are drawn as
 * controls. The scope is the most consequential thing on the page, since every
 * figure below is scoped by it, and a control drawn as a subtitle is a control
 * a reader has to hover to find.
 *
 * On the right, the way to anywhere else: one field that reaches every section
 * and every site from wherever the reader is standing.
 *
 * Both groups anchor to an edge and the slack falls between them. A control
 * floated in the middle of a wide monitor is a long trip from wherever the
 * cursor is, and the middle is the one part of a bar nobody reaches into.
 */

const WINDOWS = [
  { days: 1, label: '24h', spoken: 'Last 24 hours' },
  { days: 7, label: '7d', spoken: 'Last 7 days' },
  { days: 30, label: '30d', spoken: 'Last 30 days' },
  { days: 90, label: '90d', spoken: 'Last 90 days' },
]

/**
 * The period the figures cover.
 *
 * Four windows, all four visible, one press to any of them, which is what a
 * segmented control is for and why this is not a menu. Below the width that
 * fits four buttons the same four sit behind one, because the period is not an
 * optional control: a bar that drops it at a breakpoint leaves a phone reading
 * one window forever.
 *
 * Both shapes are always in the document and CSS chooses between them, so the
 * bar draws the same on the server as in the browser and nothing has to measure
 * the window to decide which is right.
 */
function WindowPicker({ days, onPick }) {
  const [open, setOpen] = useState(false)
  const holder = useRef(null)
  const here = WINDOWS.find(option => option.days === days) || WINDOWS[1]

  useEffect(() => {
    if (!open) return undefined
    const away = event => {
      if (!holder.current?.contains(event.target)) setOpen(false)
    }
    const key = event => {
      if (event.key !== 'Escape') return
      setOpen(false)
      holder.current?.querySelector('.console-window-mini')?.focus()
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const pick = next => {
    onPick(next)
    setOpen(false)
  }

  return (
    <div className="console-window" ref={holder}>
      <div className="console-segmented console-window-wide" role="group" aria-label="Window">
        {WINDOWS.map(option => (
          <button
            key={option.days}
            type="button"
            onClick={() => onPick(option.days)}
            aria-pressed={days === option.days}
            aria-label={option.spoken}
          >
            {option.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="console-window-mini"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Window: ${here.spoken}. Change it.`}
        onClick={() => setOpen(shut => !shut)}
      >
        <span>{here.label}</span>
        <ChevronDown className="console-scope-chevron" strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div className="console-menu" role="menu" aria-label="Window">
          {WINDOWS.map(option => (
            <button
              key={option.days}
              type="button"
              role="menuitemradio"
              aria-checked={days === option.days}
              className="console-menu-row"
              onClick={() => pick(option.days)}
            >
              <span>{option.spoken}</span>
              {days === option.days && (
                <Check className="console-menu-check" strokeWidth={2.25} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * @param {object} props
 * @param {string} props.title - the section's name, as the heading
 * @param {string} [props.group] - the part of the menu it sits in, as the crumb
 * @param {boolean} props.drawer - whether the phone's menu is open
 * @param {() => void} props.onDrawer
 * @param {boolean} props.chooseScope - whether the scope is a choice on this section
 * @param {string} props.scopeLine - what to say when it is not
 * @param {boolean} props.traffic - whether this section reads the traffic feeds
 * @param {boolean} props.publicOnly - a reader with no session
 */
export function ConsoleBar({
  title,
  group,
  drawer,
  onDrawer,
  sites,
  siteIds,
  scopeLabel,
  onPickSite,
  onToggleSite,
  chooseScope,
  scopeLine,
  days,
  onPickWindow,
  traffic,
  publicOnly,
  reading,
  onSearch,
  onShortcuts,
  onTheme,
  theme,
  signInTo,
}) {
  // A section whose group repeats its own name gets no crumb. "Traffic / Traffic"
  // is a breadcrumb that has told the reader nothing twice.
  const crumb = group && group !== title ? group : null

  return (
    <header className="console-topbar" data-reading={reading ? 'true' : 'false'}>
      <div className="console-topbar-inner">
        {/* What is being read: the name of it, then the two controls that say
            whose figures and over what period. One group, in reading order. */}
        <div className="console-context">
          <button
            type="button"
            className="console-drawer-toggle"
            aria-label={drawer ? 'Close the Menu' : 'Open the Menu'}
            aria-expanded={drawer}
            aria-controls="console-sections"
            onClick={onDrawer}
          >
            {drawer ? (
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>

          {/* The crumb is the only structural cue on screen once the column is
              narrowed, and that setting survives a reload, so a reader who
              collapsed the rail a week ago still knows which part of the
              console they are standing in. */}
          <div className="console-title">
            {crumb && (
              <span className="console-crumb" aria-hidden="true">
                {crumb}
                <span className="console-crumb-mark">/</span>
              </span>
            )}
            <h1>{title}</h1>
          </div>

          <span className="console-bar-sep" aria-hidden="true" />

          {/* The two together, so a phone can drop them onto a line of their
              own without splitting a pair that answers one question. Wider
              than that the wrapper is `display: contents` and they are the
              context row's own children. */}
          <div className="console-narrowers">
            {chooseScope ? (
              <ConsoleScope
                sites={sites}
                siteIds={siteIds}
                label={scopeLabel}
                onPickSite={onPickSite}
                onToggleSite={onToggleSite}
              />
            ) : (
              <p className="console-scope-plain">{scopeLine}</p>
            )}

            {!publicOnly && traffic && <WindowPicker days={days} onPick={onPickWindow} />}
          </div>
        </div>

        {/* The way out of here. */}
        <div className="console-tools">
          {/* The field belongs to the bar rather than to an account, so a
              signed-out reader gets it too: the sections they cannot open yet
              are still worth finding, and finding one is how they learn the
              console has it. It states its own key, which is the only way a
              modified shortcut is ever discovered. */}
          <button
            type="button"
            className="console-search-open"
            onClick={onSearch}
            aria-haspopup="dialog"
            aria-label={`Search sections and sites. ${MODIFIER}K`}
          >
            <Search className="h-4 w-4 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>Search</span>
            <kbd aria-hidden="true">{MODIFIER}K</kbd>
          </button>

          {publicOnly && (
            <>
              {/* A signed-out reader has no account panel, and the theme is set
                  inside it. Without this the one setting the console offers a
                  visitor is unreachable for the one visitor who is not signed
                  in. */}
              <button
                type="button"
                className="console-icon-button"
                onClick={onTheme}
                aria-label={`Theme: ${theme}. Change it.`}
                title={`Theme: ${theme}`}
              >
                <SunMoon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </button>

              <Link to="/login" state={{ from: signInTo }} className="console-signin">
                <LogIn className="h-4 w-4 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
                <span>Sign In</span>
              </Link>
            </>
          )}

          <span className="console-bar-sep console-bar-sep-tools" aria-hidden="true" />

          {/* The keyboard is three keys, two of them modified, so a control
              that says so is the only thing that makes them findable. It is
              also the least of the bar's business, which is why it sits past
              the rule, after everything the reader came for. */}
          <button
            type="button"
            className="console-icon-button console-keyboard"
            onClick={onShortcuts}
            aria-label="Keyboard Shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
