/**
 * A business's own photos off its Google listing, as addresses a browser can
 * load without the key.
 *
 * The call screen shows a caller what a business looks like before they ring
 * it: the storefront, the trucks, the work. Google holds those photos against
 * the listing the map sweep found the business through, and the place id on the
 * row is what reaches them. It takes two kinds of request. The listing is asked
 * for its photos and nothing else, which keeps the read in the cheapest Place
 * Details tier; then each photo shown is asked for an address, which Google
 * answers with a googleusercontent link that carries no key. So the key stays
 * on the server, and what the browser is handed is good for as long as a
 * caller is on the business.
 *
 * Google asks that a photo is shown with the names of whoever took it, so the
 * authors travel with every photo.
 *
 * Server only. It reads the key and calls Google, and neither belongs in the
 * console's bundle.
 */

const PLACE_DETAILS = 'https://places.googleapis.com/v1/places/'
const PLACES_BASE = 'https://places.googleapis.com/v1/'

/**
 * How many photos a business is shown with.
 *
 * Every photo is a billed request of its own, and four fill the space the call
 * screen gives them. A listing's first photos are the ones its owner or Google
 * chose to lead with, so four is also most of what tells a caller anything.
 */
export const PHOTOS_SHOWN = 4

/** How wide a photo is asked for, which is twice the width it is drawn at. */
const PHOTO_WIDTH = 640

/** How long any one request to Google is given before the read goes on without it. */
const PLACES_TIMEOUT_MS = 8_000

/**
 * The photos on one Google listing, as up to `take` loadable addresses.
 *
 * A photo whose address will not come back is left out rather than failing the
 * others. The listing itself refusing is thrown, with Google's status and
 * without its body, since the body can echo the request and the request
 * carries the key.
 *
 * @param {string} placeId The listing's Google place id.
 * @param {{key: string, fetcher?: typeof fetch, take?: number}} options
 * @returns {Promise<Array<{uri: string, width: number|null, height: number|null,
 *   by: Array<{name: string, uri: string|null}>}>>}
 */
export async function placePhotos(placeId, { key, fetcher = fetch, take = PHOTOS_SHOWN }) {
  const listing = await fetcher(`${PLACE_DETAILS}${encodeURIComponent(placeId)}`, {
    signal: AbortSignal.timeout(PLACES_TIMEOUT_MS),
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'photos' },
  })
  if (!listing.ok) throw new Error(`places answered ${listing.status}`)

  const body = await listing.json()
  const photos = (Array.isArray(body?.photos) ? body.photos : [])
    .filter(photo => typeof photo?.name === 'string' && photo.name)
    .slice(0, take)

  const found = await Promise.allSettled(photos.map(photo => photoAt(photo, { key, fetcher })))
  return found.filter(one => one.status === 'fulfilled' && one.value).map(one => one.value)
}

/**
 * One photo as the address Google serves it from, or null where none came back.
 *
 * `skipHttpRedirect` is what makes this an address rather than an image: the
 * media endpoint otherwise answers with a redirect to the picture, and the
 * picture is what the browser should be fetching, not this function.
 */
async function photoAt(photo, { key, fetcher }) {
  const answer = await fetcher(
    `${PLACES_BASE}${photo.name}/media?maxWidthPx=${PHOTO_WIDTH}&skipHttpRedirect=true`,
    {
      signal: AbortSignal.timeout(PLACES_TIMEOUT_MS),
      headers: { 'X-Goog-Api-Key': key },
    }
  )
  if (!answer.ok) return null
  const body = await answer.json()
  if (typeof body?.photoUri !== 'string' || !body.photoUri) return null
  return {
    uri: body.photoUri,
    width: photo.widthPx ?? null,
    height: photo.heightPx ?? null,
    by: (photo.authorAttributions ?? [])
      .filter(author => author?.displayName)
      .map(author => ({ name: author.displayName, uri: author.uri ?? null })),
  }
}
