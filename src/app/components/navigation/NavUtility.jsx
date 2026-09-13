import { useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { Phone, Search, UserRound } from 'lucide-react'
import { COMPANY_PHONE, COMPANY_PHONE_HREF, NAV_DURATION, NAV_EASE } from '@constants/navigation'
import { HAS_ACCOUNTS } from '@constants/routes'
import { useDismiss } from '@hooks/chrome/useDismiss'
import { useModifierLabel } from '@utils/keyboard'
import { warm } from '@utils/lazyWithRetry'

/**
 * The bar's way in to the search, dressed as the field it opens.
 *
 * It prints the shortcut it answers to, because this is the only place on the
 * site that says the shortcut is there and a binding nobody is told about is a
 * binding nobody presses.
 *
 * The modifier is filled in after mounting rather than read during the first
 * render. There is no platform to read on the server, and a Windows machine
 * that answered for itself straight away would render markup disagreeing with
 * what it was sent, which React repairs by throwing the tree away.
 */
export function NavSearchButton({ className, labelClass, markClass, shortcut = false, onOpen }) {
  const modifier = useModifierLabel()

  return (
    <button
      type="button"
      className={className}
      onClick={onOpen}
      onPointerEnter={() => warm(() => import('./SiteSearch'))}
      onFocus={() => warm(() => import('./SiteSearch'))}
      aria-label="Search"
      aria-keyshortcuts="Meta+K Control+K"
    >
      <Search className={markClass} strokeWidth={1.75} aria-hidden="true" />
      <span className={labelClass}>Search</span>
      {shortcut && <kbd className="nav-search-kbd">{`${modifier}K`}</kbd>}
    </button>
  )
}

/**
 * The account, as one segment rather than two links.
 *
 * Logging in is plumbing: a reader needs it once and then never again, and a
 * word carrying its own tap target sits at the end of a bar that already ends
 * in the action the page is for. Behind one mark it costs the width of a mark,
 * and the pair a signed-in reader wants instead - their console and the way out
 * - lands in the same place under the same press.
 *
 * The mark is drawn whether or not the stored session has been read, so the
 * bar does not change width underneath a pointer on the way to it; only the
 * rows wait, and they are behind a press that cannot land inside the first
 * frame.
 */
function NavAccount({ signedIn, firstName, checking, open, onToggle, onClose, onSignOut }) {
  const menuId = useId()
  const holder = useRef(null)
  const reducedMotion = useReducedMotion()

  useDismiss(open, holder, '.nav-account-trigger', onClose)

  const handleKey = event => {
    if (event.key !== 'ArrowDown') return
    event.preventDefault()
    onToggle(true)
    // One frame, so the rows have rendered before focus moves into them.
    window.requestAnimationFrame(() => holder.current?.querySelector('.nav-account-row')?.focus())
  }

  return (
    <div className="nav-account" ref={holder}>
      <button
        type="button"
        className="nav-cluster-item nav-account-trigger"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="true"
        aria-label="Account"
        onClick={() => onToggle(!open)}
        onKeyDown={handleKey}
      >
        <UserRound className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && !checking && (
          <m.div
            id={menuId}
            className="nav-account-menu"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-6px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-6px)' }}
            transition={{ duration: reducedMotion ? 0 : NAV_DURATION, ease: NAV_EASE }}
          >
            {signedIn ? (
              <>
                <p className="section-label-sm nav-account-name">{firstName || 'Account'}</p>
                <Link className="nav-account-row" to="/console" onClick={onClose}>
                  Console
                </Link>
                <button
                  type="button"
                  className="nav-account-row"
                  onClick={() => {
                    onClose()
                    onSignOut()
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link className="nav-account-row" to="/login" onClick={onClose}>
                Log In
              </Link>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * The quiet end of the bar: search, the number and the account inside one
 * hairline ring, divided into segments.
 *
 * Four separate controls at the end of a row that already carries six triggers
 * is four things asking to be read before the one that matters. Ringed
 * together they read as a single piece of furniture, and the filled action
 * stands on its own beside them, which is what keeps the bar ending in one
 * loud thing.
 *
 * The number is the segment that grows: below the wide step it is the mark
 * alone, because a phone is dialled from the phone and a desk reader is
 * reaching for the form. It comes back as digits once there is room for them.
 */
export function NavUtility({
  signedIn,
  firstName,
  checking,
  accountOpen,
  onAccountToggle,
  onAccountClose,
  onSignOut,
  onOpenSearch,
}) {
  return (
    <div className="nav-cluster">
      <NavSearchButton
        className="nav-cluster-item"
        labelClass="hidden 2xl:inline"
        markClass="h-[18px] w-[18px] shrink-0"
        shortcut
        onOpen={onOpenSearch}
      />
      <a
        href={COMPANY_PHONE_HREF}
        className="nav-cluster-item"
        aria-label={`Call ${COMPANY_PHONE}`}
      >
        <Phone className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span className="hidden xl:inline">{COMPANY_PHONE}</span>
      </a>
      {/* Not drawn at all where there is nothing to sign in to, rather than
          drawn and hidden: a mark that opens a menu offering Log In is the bar
          making a claim, and the claim is contradicted by this site's own
          privacy page. The segment goes with it, so the cluster ends at the
          number instead of at a mark that does nothing. */}
      {HAS_ACCOUNTS && (
        <NavAccount
          signedIn={signedIn}
          firstName={firstName}
          checking={checking}
          open={accountOpen}
          onToggle={onAccountToggle}
          onClose={onAccountClose}
          onSignOut={onSignOut}
        />
      )}
    </div>
  )
}
