/**
 * The capture of a prospect's own home page, taken once and kept.
 *
 * The screenshot service renders on demand: the first request for a URL it has
 * not seen answers with a holding image or takes several seconds, and a mail
 * client's image proxy gives up well before that. A message pointing a reader
 * straight at it shows its central piece of evidence to some readers and a
 * broken box to the rest, with nothing to say which.
 *
 * So the capture is taken server-side, where waiting costs nobody anything,
 * and stored. What reaches the reader is a static object on a CDN, which
 * either exists before the message is sent or is not referenced at all.
 */
const BUCKET = 'outreach-shots'

// 800 wide against the 542 the sheet draws it at, which is sharper than the
// box on any display without paying for the full two-times file. The service
// takes the source viewport height rather than an output height, and 750 is
// what returns the 1.6 the sheet's own preview box is cut to.
const SERVICE = 'https://image.thum.io/get/width/800/crop/750/wait/10/'

// The service answers a URL it has never rendered with its own branded holding
// image, an animated GIF, and serves the real capture only to a later request.
// Storing that would put a spinner where the evidence goes, so the first
// answer is read for what it is and asked again.
const HOLDING_TYPE = 'image/gif'
const RETRIES = 3
const RETRY_WAIT_MS = 4000

// How long one request for a capture is given.
//
// The service is asked to let the page settle for ten seconds before it shoots,
// so a real capture cannot answer sooner than that and a bound underneath it
// would abort every render it was waiting on.
const FETCH_TIMEOUT_MS = 12_000

// Every attempt taking its full timeout, with the pauses between them, which is
// how long the ladder runs when nothing shortens it. A caller that knows what
// its own invocation can afford passes less, and this is what it is cutting.
const ALL_ATTEMPTS_MS = RETRIES * FETCH_TIMEOUT_MS + (RETRIES - 1) * RETRY_WAIT_MS

/** Where a stored capture is served from. */
export function shotPath(prospectId) {
  return `${prospectId}.png`
}

/**
 * The public URL of a prospect's stored capture.
 *
 * @param {object} db A Supabase client.
 * @param {string} prospectId The prospect the capture belongs to.
 * @returns {string} An absolute URL.
 */
export function shotUrl(db, prospectId) {
  return db.storage.from(BUCKET).getPublicUrl(shotPath(prospectId)).data.publicUrl
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * One request for the capture, or null when it did not answer with one.
 *
 * A holding image, a refusal and an empty body are all the same answer here:
 * nothing worth storing, try again. The signal is what keeps a render that
 * never finishes from holding the invocation open until the platform ends it.
 */
async function capture(get, website, budgetMs) {
  if (budgetMs <= 0) return null

  let response
  try {
    response = await get(`${SERVICE}${website}`, {
      signal: AbortSignal.timeout(Math.min(FETCH_TIMEOUT_MS, budgetMs)),
    })
  } catch {
    return null
  }

  const type = response.headers.get('content-type') || ''
  if (!response.ok || type.startsWith(HOLDING_TYPE)) return null

  const bytes = Buffer.from(await response.arrayBuffer())
  return bytes.length ? bytes : null
}

/**
 * Takes a prospect's home page capture and stores it, if it is not there yet.
 *
 * Returns the URL a message may point at, or null when no usable capture could
 * be taken. Null is the whole point of the return value: a message that cannot
 * prove it looked at the page leaves the picture out rather than printing a
 * box that will not fill.
 *
 * @param {object} db A Supabase client holding the service role.
 * @param {{ id: string, website: string }} prospect The business and its site.
 * @param {{ budgetMs?: number, get?: typeof fetch }} [options] `budgetMs` is the
 *   share of its own invocation the caller is lending this; attempts stop once
 *   it is spent, whether or not any are left. `get` is the fetch to use.
 * @returns {Promise<string|null>} The stored capture's URL, or null.
 */
/**
 * The capture already on file for a prospect, or null where none is.
 *
 * Nothing is fetched and nothing is rendered: this is the read `ensureShot`
 * opens on, exposed for a caller that wants to show a message as it would go
 * and has no business asking the service to render a page for it.
 *
 * @param {object} db A service-role client.
 * @param {object} prospect Row from `outreach_prospects`.
 * @returns {Promise<string|null>} The capture's public URL, or null.
 */
export async function storedShot(db, prospect) {
  if (!prospect?.id || !prospect?.website) return null
  const path = shotPath(prospect.id)
  const { data: existing } = await db.storage.from(BUCKET).list('', { search: path, limit: 1 })
  return existing?.some(entry => entry.name === path) ? shotUrl(db, prospect.id) : null
}

export async function ensureShot(db, prospect, { budgetMs = ALL_ATTEMPTS_MS, get = fetch } = {}) {
  if (!prospect?.id || !prospect?.website) return null
  const path = shotPath(prospect.id)

  const stored = await storedShot(db, prospect)
  if (stored) return stored

  const deadline = Date.now() + budgetMs
  const remaining = () => deadline - Date.now()

  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    // The service renders in the background after the request that provoked it,
    // so the pause is the thing the next attempt is waiting on. Spending it with
    // no room left to attempt anything afterwards only burns the caller's time,
    // which is why it sits ahead of the attempt it belongs to rather than behind
    // the one that failed.
    if (attempt > 0) {
      if (remaining() <= RETRY_WAIT_MS) break
      await wait(RETRY_WAIT_MS)
    }

    const bytes = await capture(get, prospect.website, remaining())
    if (!bytes) continue

    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: 'image/png', upsert: true })
    if (error) return null
    return shotUrl(db, prospect.id)
  }

  return null
}
