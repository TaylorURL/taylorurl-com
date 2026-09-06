/**
 * What a table's placeholder should look like, remembered from the rows it last
 * stood in for.
 *
 * A placeholder is a claim about content that has not arrived: how many rows,
 * and how tall each one is. Neither can be read off the markup. The count is
 * whatever the account has, and the height depends on the reader's window - a
 * site row is one line at desktop width and two at 900px, and a row carrying a
 * sentence is taller again. Guess either and the page moves when the figures
 * land, which is the one thing a placeholder exists to prevent.
 *
 * So they are measured instead. Once the real rows are on screen their count
 * and their average height go into session storage, and the next load's
 * placeholder is the shape of what this reader actually saw. Only a first visit
 * on a new device works from the caller's fallback.
 *
 * Session storage rather than local: it survives a reload and a move between
 * sections, and it is gone by the next visit, when the window may be a
 * different size and the figures a different length.
 */

/**
 * The shape to draw, from memory where there is any and the caller's guess
 * otherwise. `lastHeight` carries whatever the snapped row height does not
 * account for, so the rows match the real ones and the block still ends where
 * the real block ends.
 */
export function recalledRows(key, rows, height) {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(key) || 'null')
    if (stored?.rows > 0 && stored?.height > 0) {
      const remainder = stored.total
        ? stored.total - (stored.rows - 1) * stored.height
        : stored.height
      return {
        rows: stored.rows,
        height: `${stored.height}px`,
        lastHeight: `${Math.max(1, remainder)}px`,
      }
    }
  } catch {
    // Private browsing refuses the read, and a half-written entry is no better
    // than none; the caller's fallback covers both.
  }
  return { rows, height, lastHeight: height }
}

/**
 * Records what a rendered block of rows turned out to be, for the next load.
 *
 * A `tbody` counts its own rows and a list does not, so the count comes from
 * `rows` where the element has it and from its children otherwise. Reading
 * `rows` alone is silent on anything that is not a table: the write never
 * happens, and the placeholder is stuck on the caller's first-visit guess for
 * every visit after it.
 */
export function rememberRows(key, body) {
  const count = body?.rows?.length ?? body?.children?.length
  if (!count) return
  try {
    // Snapped to the half pixel the browser paints a row at. The raw mean lands
    // between two device pixels, so the placeholder row comes out a tenth short
    // of the row it stands in for and the text inside it sits a fraction high.
    const total = body.getBoundingClientRect().height
    const height = Math.round((total / count) * 2) / 2
    if (height > 0) {
      window.sessionStorage.setItem(key, JSON.stringify({ rows: count, height, total }))
    }
  } catch {
    // Nothing to do - the placeholder falls back to its default next time.
  }
}

/** The same, for a block whose placeholder is one box rather than a row count. */
export function recalledHeight(key, fallback) {
  try {
    const stored = Number(window.sessionStorage.getItem(key))
    if (Number.isFinite(stored) && stored > 0) return `${stored}px`
  } catch {
    // Private browsing refuses the read; the fallback still applies.
  }
  return fallback
}

/** Records a block's rendered height, for the next load. */
export function rememberHeight(key, node) {
  if (!node) return
  try {
    const height = node.getBoundingClientRect().height
    if (height > 0) window.sessionStorage.setItem(key, String(height))
  } catch {
    // Nothing to do - the placeholder falls back to its default next time.
  }
}

/**
 * The same trick for a list, which has no `rows` to count.
 *
 * A ranked list draws its placeholder before it knows how many rows are
 * coming, so the first guess is the caller's and every guess after it is what
 * this reader actually saw.
 */
export function recalledCount(key, fallback) {
  try {
    const stored = Number(window.sessionStorage.getItem(key))
    if (stored > 0) return stored
  } catch {
    // Private browsing refuses the read; the caller's guess covers it.
  }
  return fallback
}

/** Records how many rows a list turned out to have, for the next load. */
export function rememberCount(key, count) {
  if (!count) return
  try {
    window.sessionStorage.setItem(key, String(count))
  } catch {
    // Nothing to do; the next placeholder falls back to the caller's guess.
  }
}
