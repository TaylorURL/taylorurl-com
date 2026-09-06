import { SITE } from '../../../../../lib/site/current.js'

/**
 * The pages this site does not count as visits, read a second time over the
 * rows that were recorded before it stopped counting them.
 *
 * The tracker reads the same declaration off its own script tag in
 * `index.html` and files nothing for a path that matches, so from that deploy
 * forward the console is not in its own figures. What a deploy cannot do is
 * unsay the fortnight before it. Those rows are in the table, the console was
 * over a third of everything recorded, and they sit at the top of every page
 * ranking for as long as the window reaches back to them - which on a 30-day
 * window is most of a month of reading the studio's own workspace as though it
 * were the site's traffic.
 *
 * So the rule is applied to what is drawn as well as to what is collected. It
 * takes rows out of the page breakdowns and nothing else: the window's totals
 * come from the collector already added up, and a figure this cannot correct
 * is better left alone than quietly made to disagree with the chart above it.
 * The rankings and the table are what named the workspace by path, and they
 * are what this answers for.
 *
 * The rows the collector sends are the fifty most read, so dropping fifteen of
 * them leaves thirty-five rather than reaching for the next fifteen. That is
 * the window healing as it rolls rather than a list to go and refill.
 *
 * `scripts/check-traffic-ignore.js` holds this and the tag together. They are
 * one rule written twice, and a rule that only half moved would leave the
 * console hiding pages the tracker is still counting, or counting pages it has
 * stopped filing.
 */
export const IGNORE_RULE = '/console,/login,!/console/status'

/** A path with its trailing slashes off, so `/console` and `/console/` are one. */
function bare(where) {
  return String(where ?? '').replace(/\/+$/, '') || '/'
}

/** Whether a path is the prefix itself, or something underneath it. */
function under(where, prefix) {
  return Boolean(prefix) && (where === prefix || where.startsWith(`${prefix}/`))
}

const declared = IGNORE_RULE.split(',')
  .map(entry => entry.trim())
  .filter(Boolean)
const ignored = declared.filter(entry => !entry.startsWith('!')).map(bare)
const excepted = declared.filter(entry => entry.startsWith('!')).map(entry => bare(entry.slice(1)))

/**
 * Whether a path on this site is a visit.
 *
 * An exception wins over the entry it sits under, because it is the narrower of
 * the two statements: `/console` is the workspace, `/console/status` is the
 * board the home page sends readers to by name and is a page like any other.
 *
 * The hash comes off first. The tracker judges `location.pathname`, which never
 * carries one, while the path it files is the pathname and the hash together,
 * so a row has to be read the way the hit was judged rather than as it was
 * stored.
 */
export function counted(path) {
  const where = bare(String(path ?? '').split('#')[0])
  if (excepted.some(entry => under(where, entry))) return true
  return !ignored.some(entry => under(where, entry))
}

/** A hostname to compare on: lower case, and with any `www.` off the front. */
function registrable(host) {
  return String(host ?? '')
    .toLowerCase()
    .replace(/^www\./, '')
}

// The site the rule belongs to. One tracker serves every site TaylorURL looks
// after and each declares its own paths, so `rootriseholdings.com/login` is a
// client's sign-in page with sixty views on it rather than a page of this
// console, and hiding it would be taking a row out of somebody else's figures.
// The declaration above is this site's, and this site is the only one it is
// applied to.
//
// Compared with the `www.` off both sides: the collector registers this site as
// `taylorurl.com` and it serves itself at `www.taylorurl.com`, and a hostname
// written down here a second time would be a third answer to a question the
// registry already answers.
const OURS = registrable(new URL(SITE.origin).host)

/**
 * The page rows to draw.
 *
 * A row names its site only when the read spans more than one, so a scoped read
 * hands the site in as `scopeName`. A row that names no site and arrives with no
 * scope is kept: this is a display filter, and showing a page that should have
 * been dropped is a smaller wrong than dropping one that should have been shown.
 */
export function countedPages(pages, scopeName) {
  return (pages || []).filter(row => {
    const site = row.site ?? scopeName
    return !site || registrable(site) !== OURS || counted(row.path)
  })
}

/**
 * The same, over a whole breakdown payload.
 *
 * The payload comes back unchanged when it holds nothing to drop, so the
 * sections that hang an effect on it are not handed a new object on every poll
 * for a filter that did nothing.
 */
export function withCountedPages(payload, scopeName) {
  if (!payload) return null
  const pages = countedPages(payload.pages, scopeName)
  return pages.length === (payload.pages?.length ?? 0) ? payload : { ...payload, pages }
}
