/**
 * The campaign a visit arrived on, held for as long as the visit might turn
 * into an inquiry.
 *
 * The tags only ever exist on the address a reader first opens. The router
 * replaces the query string on the first navigation, and the analytics tracker
 * reads `location.search` afresh on every pageview, so the second page of a
 * visit already carries nothing. A form filled in on the fourth page has no
 * campaign in front of it at the moment it is sent, so the tags have to come
 * from somewhere other than the address the sender is on.
 *
 * So the tags are copied out of the entry address once and kept. The store is
 * `localStorage` rather than the tab's own: a prospect who opens the link on
 * Monday and writes on Wednesday is the case worth catching, and a session
 * store forgets before then.
 *
 * The newest tagged arrival wins. A prospect who was sent two messages and
 * clicked the second is answering the second, and crediting the first because
 * it came first would put the count on the wrong opener.
 */

/** Where the held campaign lives. */
const KEY = 'tu_campaign'

/**
 * How long a campaign is still worth crediting. Past this the arrival and the
 * inquiry are two separate visits that happen to share a browser, and reading
 * them as one is a claim the data does not support.
 */
export const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000

/** The tags carried, in the spelling both the URL and the database use. */
export const CAMPAIGN_FIELDS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
]

/**
 * The identifiers an ad platform writes on a click of its own.
 *
 * Separate from the tags above because they answer a separate question and go
 * to a separate place. A tag says which message an arrival came from and is
 * read by a person in a console; a click identifier names one click in one ad
 * account, is meaningless anywhere else, and is the only thing that lets a sale
 * reported from the server be credited back to the ad that produced it.
 *
 * All four, because which one a click carries is the platform's choice and not
 * the advertiser's: `gclid` on the web, `gbraid` and `wbraid` where the browser
 * gives Google no identifier to write one against, and `fbclid` from Meta.
 *
 * They are held for the same reason the tags are. The identifier exists only on
 * the address the reader opened, the router replaces that address on the first
 * navigation, and a buyer reaches the payment page several pages later.
 */
export const CLICK_FIELDS = ['gclid', 'gbraid', 'wbraid', 'fbclid']

/** Everything an arrival is worth keeping, tags and click identifiers alike. */
const HELD_FIELDS = [...CAMPAIGN_FIELDS, ...CLICK_FIELDS]

/**
 * Room for a real tag and nothing beyond it. These values reach a database
 * column and a log line, and their length is not something the visitor chose.
 */
const LIMIT = 200

/** The browser's own store, where there is one. */
function browserStore() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // A browser set to block site data throws on the accessor itself rather
    // than answering empty, so reaching it is what has to be guarded.
    return null
  }
}

/** One tag, flattened to a single line and cut to its limit. */
function tag(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, LIMIT)
}

/**
 * Whether an arrival is worth crediting anything to.
 *
 * `utm_source` decides it, or a click identifier does. A link tagged with a
 * medium and no source says where a reader came in but not from what, which is
 * not an attribution, and treating it as one would displace a real campaign
 * already held. An identifier with no tags beside it is the opposite case and
 * the commonest one there is: an ad account tags its own clicks and nothing
 * else, so a paid arrival routinely carries an identifier and no source.
 *
 * @param {object} found
 * @returns {boolean}
 */
function credited(found) {
  return Boolean(found.utm_source) || CLICK_FIELDS.some(field => found[field])
}

/**
 * The campaign an address carries, or null where it carries none.
 *
 * @param {string} search A query string, with or without its leading `?`.
 * @returns {object|null}
 */
export function campaignIn(search) {
  let params
  try {
    params = new URLSearchParams(search || '')
  } catch {
    return null
  }
  const found = {}
  for (const field of HELD_FIELDS) found[field] = tag(params.get(field))
  return credited(found) ? found : null
}

/**
 * Copies the campaign off an address into the store, where there is one to
 * copy. An untagged address leaves whatever is held alone: most pages of a
 * visit are untagged, and clearing on each of them would lose the campaign one
 * navigation after it arrived.
 *
 * @param {string} search The entry address's query string.
 * @param {{now?: number, store?: object}} [where]
 * @returns {object|null} What was written, or null where nothing was.
 */
export function rememberCampaign(search, { now = Date.now(), store = browserStore() } = {}) {
  const found = campaignIn(search)
  if (!found || !store) return null
  try {
    store.setItem(KEY, JSON.stringify({ ...found, at: now }))
  } catch {
    // A full or refused store costs this visit its attribution and nothing
    // else, so the page carries on rather than failing in front of a reader.
    return null
  }
  return found
}

/**
 * The campaign held for this browser, where one is still worth crediting.
 *
 * @param {{now?: number, store?: object}} [where]
 * @returns {object|null}
 */
export function campaignHeld({ now = Date.now(), store = browserStore() } = {}) {
  if (!store) return null
  let held
  try {
    held = JSON.parse(store.getItem(KEY) || 'null')
  } catch {
    return null
  }
  if (!held || typeof held !== 'object') return null
  if (!Number.isFinite(held.at) || now - held.at > LOOKBACK_MS || held.at > now) return null

  const found = {}
  for (const field of HELD_FIELDS) found[field] = tag(held[field])
  return credited(found) ? found : null
}
