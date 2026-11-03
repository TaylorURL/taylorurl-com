/*
 * The class strings the account screens share, apart from their components so
 * each component file exports nothing but components.
 *
 * The screens are in the site's "Refined" look: a filled card for the form, a
 * filled block for anything the form says back, blue text links, and no
 * outline on any of it.
 */

/** A small blue text link: "Forgot Password", "Sign In". */
export const AUTH_LINK =
  "relative inline-flex items-center font-medium text-[color:var(--link)] transition-colors duration-150 hover:text-ink before:absolute before:-inset-y-3 before:inset-x-0 before:content-['']"

/** The quieter link beside it: "Cancel". */
export const AUTH_QUIET = 'text-ink-mute transition-colors duration-150 hover:text-ink'

/** The line under a field carrying the way out of it, at the field's right edge. */
export const AUTH_ASIDE = 'mt-2.5 flex items-center justify-end gap-5 text-[14px]'

/**
 * What a screen says back in place of a field: a link on its way, a link that
 * has run out. A filled block one step up from the card, not a ruled box.
 */
export const AUTH_NOTE =
  'rounded-[12px] bg-[var(--card-hi)] px-4 py-3 text-[15px] leading-relaxed text-ink-soft'
