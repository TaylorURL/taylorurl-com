import { useMediaQuery } from '@hooks/useMediaQuery'

/**
 * Whether the screen is a desk rather than a phone, read once and kept current.
 *
 * Two things on these screens change shape between the two rather than merely
 * reflowing, and a stylesheet can reach neither. The script on the call screen
 * is a fold a thumb opens on a phone and a column that is simply there on a
 * desk, and a `<details>` cannot be opened by a rule; the team list is a stack
 * of cards on a phone and a table on a desk, and those are different markup
 * rather than the same markup laid out twice. So the screen has to know which it
 * is drawing for.
 *
 * @param {string} [query] The width a desk starts at.
 * @returns {boolean}
 */
export function useDesk(query = '(min-width: 1024px)') {
  return useMediaQuery(query, { readWhileRendering: true })
}
