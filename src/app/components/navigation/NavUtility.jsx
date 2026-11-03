import { Search } from 'lucide-react'
import { useModifierLabel } from '@utils/keyboard'
import { warm } from '@utils/lazyWithRetry'

/**
 * The bar's way in to the search.
 *
 * It warms the search chunk when a pointer or the keyboard reaches it, so the
 * press that follows opens a panel that has already arrived. `shortcut` prints
 * the key it answers to, which is the only place the site says the shortcut is
 * there.
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
